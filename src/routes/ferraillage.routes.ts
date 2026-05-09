import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "@/db";
import {
  FerAcierType,
  Prisma,
  SubModuleKey as PrismaSubModuleKey,
} from "@prisma/client";
import { attFerraillageRouter } from "./attFerraillage.routes";

export const ferraillageRouter = Router();

type AuthedRequest = Request & { userId?: string };

const rapportSummarySelect = {
  id: true,
  chantierName: true,
  responsable: true,
  acierType: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { etats: true, restants: true, niveaux: true } },
} satisfies Prisma.FerRapportSelect;

type RaportSummaryRecord = Prisma.FerRapportGetPayload<{ select: typeof rapportSummarySelect }>;

const rapportDetailInclude = {
  etats: { orderBy: { createdAt: "desc" } },
  restants: { orderBy: { createdAt: "desc" } },
  lignes: {
    where: { niveauId: null },
    orderBy: { createdAt: "asc" },
  },
  niveaux: {
    orderBy: { sortOrder: "asc" },
    include: {
      sousTraitants: { orderBy: { sortOrder: "asc" } },
      diametres: {
        orderBy: { diametre: { mm: "asc" } },
        include: { diametre: { select: { mm: true } } },
      },
      lignes: {
        orderBy: { createdAt: "asc" },
      },
    },
  },
} satisfies Prisma.FerRapportInclude;

type RapportDetailRecord = Prisma.FerRapportGetPayload<{ include: typeof rapportDetailInclude }>;

const niveauDetailInclude = {
  sousTraitants: { orderBy: { sortOrder: "asc" } },
  diametres: {
    orderBy: { diametre: { mm: "asc" } },
    include: { diametre: { select: { mm: true } } },
  },
  lignes: {
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.FerNiveauInclude;

type NiveauDetailRecord = Prisma.FerNiveauGetPayload<{ include: typeof niveauDetailInclude }>;
type LigneDetailRecord = Prisma.FerLigneGetPayload<Record<string, never>>;

async function requireFerraillage(req: AuthedRequest, res: Response) {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }

  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionId: true },
  });

  const subscriptionId = u?.subscriptionId ?? null;
  if (!subscriptionId) {
    res.status(403).json({ error: "Plan selection required", code: "PLAN_REQUIRED" });
    return null;
  }

  const sub = await prisma.subModule.findUnique({
    where: { key: PrismaSubModuleKey.FERRAILLAGE },
    select: { id: true, isActive: true },
  });

  if (!sub || !sub.isActive) {
    res.status(403).json({ error: "Ferraillage not available", code: "SUBMODULE_INACTIVE" });
    return null;
  }

  const enabled = await prisma.subscriptionSubModule.findUnique({
    where: { subscriptionId_subModuleId: { subscriptionId, subModuleId: sub.id } },
    select: { subscriptionId: true },
  });

  if (!enabled) {
    res.status(403).json({ error: "Ferraillage not enabled", code: "SUBMODULE_NOT_ENABLED" });
    return null;
  }

  return { userId, subscriptionId, subModuleId: sub.id };
}

function normalizeResponsable(v?: string | null) {
  return (v ?? "").trim();
}

function pickResponsable(
  responsable?: string | null,
  legacySousTraitant?: string | null,
) {
  const next = normalizeResponsable(responsable);
  if (next) return next;
  return normalizeResponsable(legacySousTraitant);
}

function nullableString(v?: string | null) {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

function optionalString(v?: string | null) {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

function uniqueInts(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }

  return out;
}

function mapRapportSummary(item: RaportSummaryRecord) {
  return {
    ...item,
    responsable: nullableString(item.responsable),
  };
}

function safeParseJson<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapProjectLigne(item: LigneDetailRecord) {
  return {
    id: item.id,
    rapportId: item.rapportId,
    niveauId: item.niveauId,
    designation: item.designation,
    nomenclature: item.nomenclature,
    nb: item.nb,
    hauteur: item.hauteur,
    forme: item.forme,
    diametreMm: item.diametreMm,
    payload: safeParseJson<Record<string, unknown>>(item.payloadJson, {}),
    qtyByMm: safeParseJson<Record<string, number>>(item.qtyByMmJson, {}),
    poidsByMm: safeParseJson<Record<string, number>>(item.poidsByMmJson, {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapProjectNiveau(niveau: NiveauDetailRecord) {
  return {
    id: niveau.id,
    name: niveau.name,
    note: niveau.note,
    sortOrder: niveau.sortOrder,
    sousTraitants: niveau.sousTraitants.map((entry) => entry.name),
    selectedMms: uniqueInts(niveau.diametres.map((entry) => entry.diametre.mm)),
    lignes: niveau.lignes.map(mapProjectLigne),
  };
}

function mapRapportDetail(item: RapportDetailRecord) {
  return {
    id: item.id,
    chantierName: item.chantierName,
    responsable: nullableString(item.responsable),
    acierType: item.acierType,
    note: item.note,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    etats: item.etats,
    restants: item.restants,
    lignes: item.lignes.map(mapProjectLigne),
    niveaux: item.niveaux.map(mapProjectNiveau),
  };
}

async function sendRapportDetail(req: AuthedRequest, res: Response) {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const rapportId = String(req.params.rapportId || req.params.projectId || "").trim();
  if (!rapportId) return res.status(400).json({ error: "Invalid rapportId" });

  const item = await prisma.ferRapport.findUnique({
    where: { id: rapportId },
    include: rapportDetailInclude,
  });

  if (!item) return res.status(404).json({ error: "Not found" });
  res.json({ item: mapRapportDetail(item) });
}

async function ensureDiametres(tx: Prisma.TransactionClient, mms: number[]) {
  const uniq = uniqueInts(mms);
  if (!uniq.length) return;

  const existing = await tx.ferDiametre.findMany({
    where: { mm: { in: uniq } },
    select: { mm: true },
  });

  const have = new Set<number>(existing.map((d) => d.mm));
  const missing = uniq.filter((mm) => !have.has(mm));

  for (const mm of missing) {
    await tx.ferDiametre.create({
      data: { mm, label: `Fer de ${mm}`, isActive: true },
    });
  }
}

const rapportCreateSchema = z.object({
  chantierName: z.string().trim().min(1),
  responsable: z.string().optional().nullable(),
  sousTraitant: z.string().optional().nullable(),
});

const projectCreateSchema = z.object({
  chantierName: z.string().trim().min(1),
  responsable: z.string().optional().nullable(),
  sousTraitant: z.string().optional().nullable(),
  acierType: z.nativeEnum(FerAcierType),
  note: z.string().optional().nullable(),
  niveaux: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        note: z.string().optional().nullable(),
        selectedMms: z.array(z.number().int().min(1).max(100)).min(1),
        sousTraitants: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

const projectUpdateSchema = z
  .object({
    chantierName: z.string().trim().min(1).optional(),
    chantier: z.string().trim().min(1).optional(),
    responsable: z.string().optional().nullable(),
    sousTraitant: z.string().optional().nullable(),
    acierType: z.nativeEnum(FerAcierType).optional(),
    typeAcier: z.nativeEnum(FerAcierType).optional(),
    note: z.string().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const chantierName = (value.chantierName ?? value.chantier ?? "").trim();
    const acierType = value.acierType ?? value.typeAcier;

    if (!chantierName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chantier"],
        message: "Le chantier est obligatoire.",
      });
    }

    if (!acierType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["typeAcier"],
        message: "Le type d'acier est obligatoire.",
      });
    }
  });

const projectNiveauCreateSchema = z
  .object({
    nomNiveau: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    note: z.string().optional().nullable(),
    entreprisesMainsOeuvres: z.array(z.string()).optional(),
    sousTraitants: z.array(z.string()).optional(),
    diametresActifs: z.array(z.number().int().min(1).max(100)).optional(),
    selectedMms: z.array(z.number().int().min(1).max(100)).optional(),
  })
  .superRefine((value, ctx) => {
    const niveauName = (value.nomNiveau ?? value.name ?? "").trim();
    const diametres = value.diametresActifs ?? value.selectedMms ?? [];

    if (!niveauName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["nomNiveau"],
        message: "Le nom du niveau est obligatoire.",
      });
    }

    if (!diametres.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["diametresActifs"],
        message: "Au moins un diametre actif est requis.",
      });
    }
  });

const projectLigneCreateSchema = z.object({
  niveauId: z.string().trim().optional(),
  designation: z.string().trim().min(1),
  nomenclature: z.string().optional().nullable(),
  nb: z.number().finite().optional().nullable(),
  hauteur: z.number().finite().optional().nullable(),
  forme: z.string().optional().nullable(),
  diametreMm: z.number().int().optional().nullable(),
  payload: z.unknown(),
  qtyByMm: z.record(z.string(), z.number()).default({}),
  poidsByMm: z.record(z.string(), z.number()).default({}),
});

const projectLigneScopeSchema = z.object({
  projectId: z.string().trim().min(1),
  niveauId: z.string().trim().min(1),
});

const projectLigneUpdateSchema = projectLigneCreateSchema.extend({
  projectId: z.string().trim().min(1),
  niveauId: z.string().trim().min(1),
});

ferraillageRouter.get("/rapports", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const q = String(req.query.q ?? "").trim();

  const items = await prisma.ferRapport.findMany({
    where: q
        ? {
          OR: [
            { chantierName: { contains: q } },
            { responsable: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    select: rapportSummarySelect,
  });

  res.json({ items: items.map(mapRapportSummary) });
});

ferraillageRouter.post("/projects", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const parsed = projectCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const chantierName = parsed.data.chantierName;
  const responsable = pickResponsable(parsed.data.responsable, parsed.data.sousTraitant);
  const note = optionalString(parsed.data.note);
  const niveaux = parsed.data.niveaux.map((niveau) => ({
    name: niveau.name,
    note: optionalString(niveau.note),
    selectedMms: uniqueInts(niveau.selectedMms),
    sousTraitants: uniqueStrings(niveau.sousTraitants),
  }));

  try {
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.ferRapport.findUnique({
        where: {
          chantierName_responsable: {
            chantierName,
            responsable,
          },
        },
        select: { id: true },
      });

      if (existing) throw new Error("PROJECT_ALREADY_EXISTS");

      await ensureDiametres(
        tx,
        niveaux.flatMap((niveau) => niveau.selectedMms),
      );

      return tx.ferRapport.create({
        data: {
          chantierName,
          responsable,
          acierType: parsed.data.acierType,
          note,
          niveaux: niveaux.length
            ? {
                create: niveaux.map((niveau, niveauIndex) => ({
                  name: niveau.name,
                  note: niveau.note,
                  sortOrder: niveauIndex,
                  sousTraitants: niveau.sousTraitants.length
                    ? {
                        create: niveau.sousTraitants.map((name, stIndex) => ({
                          name,
                          sortOrder: stIndex,
                        })),
                      }
                    : undefined,
                  diametres: {
                    create: niveau.selectedMms.map((mm) => ({
                      diametre: { connect: { mm } },
                    })),
                  },
                })),
              }
            : undefined,
        },
        select: rapportSummarySelect,
      });
    });

    return res.status(201).json({ item: mapRapportSummary(item) });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_ALREADY_EXISTS") {
      return res.status(409).json({ error: "Project already exists" });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ error: "Project already exists" });
    }

    throw error;
  }
});

ferraillageRouter.post("/projects/:projectId/niveaux", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const projectId = String(req.params.projectId || "").trim();
  if (!projectId) return res.status(400).json({ error: "Invalid projectId" });

  const parsed = projectNiveauCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const nomNiveau = (parsed.data.nomNiveau ?? parsed.data.name ?? "").trim();
  const note = optionalString(parsed.data.note);
  const sousTraitants = uniqueStrings(parsed.data.entreprisesMainsOeuvres ?? parsed.data.sousTraitants ?? []);
  const selectedMms = uniqueInts(parsed.data.diametresActifs ?? parsed.data.selectedMms ?? []);

  try {
    const item = await prisma.$transaction(async (tx) => {
      const project = await tx.ferRapport.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!project) throw new Error("PROJECT_NOT_FOUND");

      await ensureDiametres(tx, selectedMms);

      const currentSort = await tx.ferNiveau.aggregate({
        where: { rapportId: projectId },
        _max: { sortOrder: true },
      });

      return tx.ferNiveau.create({
        data: {
          rapport: { connect: { id: projectId } },
          name: nomNiveau,
          note,
          sortOrder: (currentSort._max.sortOrder ?? -1) + 1,
          sousTraitants: sousTraitants.length
            ? {
                create: sousTraitants.map((name, index) => ({
                  name,
                  sortOrder: index,
                })),
              }
            : undefined,
          diametres: {
            create: selectedMms.map((mm) => ({
              diametre: { connect: { mm } },
            })),
          },
        },
        include: niveauDetailInclude,
      });
    });

    return res.status(201).json({ item: mapProjectNiveau(item) });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return res.status(404).json({ error: "Project not found" });
    }

    throw error;
  }
});

async function updateProjectNiveauData(req: AuthedRequest, res: Response) {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const projectId = String(req.params.projectId || req.params.rapportId || "").trim();
  const niveauId = String(req.params.niveauId || "").trim();
  if (!projectId) return res.status(400).json({ error: "Invalid projectId" });
  if (!niveauId) return res.status(400).json({ error: "Invalid niveauId" });

  const parsed = projectNiveauCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const nomNiveau = (parsed.data.nomNiveau ?? parsed.data.name ?? "").trim();
  const note = optionalString(parsed.data.note);
  const sousTraitants = uniqueStrings(parsed.data.entreprisesMainsOeuvres ?? parsed.data.sousTraitants ?? []);
  const selectedMms = uniqueInts(parsed.data.diametresActifs ?? parsed.data.selectedMms ?? []);

  try {
    const item = await prisma.$transaction(async (tx) => {
      const niveau = await tx.ferNiveau.findFirst({
        where: {
          id: niveauId,
          rapportId: projectId,
        },
        select: { id: true },
      });

      if (!niveau) throw new Error("NIVEAU_NOT_FOUND");

      await ensureDiametres(tx, selectedMms);

      await tx.ferNiveauSousTraitant.deleteMany({
        where: { niveauId },
      });

      await tx.ferNiveauDiametre.deleteMany({
        where: { niveauId },
      });

      return tx.ferNiveau.update({
        where: { id: niveauId },
        data: {
          name: nomNiveau,
          note,
          sousTraitants: sousTraitants.length
            ? {
                create: sousTraitants.map((name, index) => ({
                  name,
                  sortOrder: index,
                })),
              }
            : undefined,
          diametres: {
            create: selectedMms.map((mm) => ({
              diametre: { connect: { mm } },
            })),
          },
        },
        include: niveauDetailInclude,
      });
    });

    return res.json({ item: mapProjectNiveau(item) });
  } catch (error) {
    if (error instanceof Error && error.message === "NIVEAU_NOT_FOUND") {
      return res.status(404).json({ error: "Niveau not found" });
    }

    throw error;
  }
}

ferraillageRouter.put("/projects/:projectId/niveaux/:niveauId", updateProjectNiveauData);
ferraillageRouter.put("/rapports/:rapportId/niveaux/:niveauId", updateProjectNiveauData);

async function updateProjectData(req: AuthedRequest, res: Response) {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const projectId = String(req.params.rapportId || req.params.projectId || "").trim();
  if (!projectId) return res.status(400).json({ error: "Invalid projectId" });

  const parsed = projectUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const chantierName = (parsed.data.chantierName ?? parsed.data.chantier ?? "").trim();
  const responsable = pickResponsable(parsed.data.responsable, parsed.data.sousTraitant);
  const acierType = parsed.data.acierType ?? parsed.data.typeAcier;
  const note = optionalString(parsed.data.note);

  if (!chantierName || !acierType) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const item = await prisma.$transaction(async (tx) => {
      const project = await tx.ferRapport.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (!project) throw new Error("PROJECT_NOT_FOUND");

      const existing = await tx.ferRapport.findFirst({
        where: {
          chantierName,
          responsable,
          NOT: { id: projectId },
        },
        select: { id: true },
      });

      if (existing) throw new Error("PROJECT_ALREADY_EXISTS");

      return tx.ferRapport.update({
        where: { id: projectId },
        data: {
          chantierName,
          responsable,
          acierType,
          note,
        },
        include: rapportDetailInclude,
      });
    });

    return res.json({ item: mapRapportDetail(item) });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      return res.status(404).json({ error: "Project not found" });
    }

    if (error instanceof Error && error.message === "PROJECT_ALREADY_EXISTS") {
      return res.status(409).json({ error: "Project already exists" });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return res.status(409).json({ error: "Project already exists" });
    }

    throw error;
  }
}

ferraillageRouter.put("/projects/:projectId", updateProjectData);

ferraillageRouter.put("/rapports/:rapportId", updateProjectData);

async function createProjectLigne(req: AuthedRequest, res: Response) {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const projectId = String(req.params.projectId || "").trim();
  if (!projectId) return res.status(400).json({ error: "Invalid projectId" });

  const parsed = projectLigneCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const niveauId = String(req.params.niveauId || parsed.data.niveauId || "").trim();
  if (!niveauId) return res.status(400).json({ error: "niveauId is required" });

  try {
    const item = await prisma.$transaction(async (tx) => {
      const niveau = await tx.ferNiveau.findFirst({
        where: {
          id: niveauId,
          rapportId: projectId,
        },
        select: { id: true, rapportId: true },
      });

      if (!niveau) throw new Error("NIVEAU_NOT_FOUND");

      return tx.ferLigne.create({
        data: {
          rapport: { connect: { id: projectId } },
          niveau: { connect: { id: niveauId } },
          designation: parsed.data.designation,
          nomenclature: optionalString(parsed.data.nomenclature),
          nb: parsed.data.nb ?? null,
          hauteur: parsed.data.hauteur ?? null,
          forme: optionalString(parsed.data.forme),
          diametreMm: parsed.data.diametreMm ?? null,
          payloadJson: JSON.stringify(parsed.data.payload ?? {}),
          qtyByMmJson: JSON.stringify(parsed.data.qtyByMm ?? {}),
          poidsByMmJson: JSON.stringify(parsed.data.poidsByMm ?? {}),
        },
      });
    });

    return res.status(201).json({ item: mapProjectLigne(item) });
  } catch (error) {
    if (error instanceof Error && error.message === "NIVEAU_NOT_FOUND") {
      return res.status(404).json({ error: "Niveau not found" });
    }

    throw error;
  }
}

async function getScopedProjectLigne(tx: Prisma.TransactionClient, ligneId: string, projectId: string, niveauId: string) {
  const ligne = await tx.ferLigne.findFirst({
    where: {
      id: ligneId,
      rapportId: projectId,
      niveauId,
    },
  });

  if (!ligne) throw new Error("LIGNE_NOT_FOUND");
  return ligne;
}

ferraillageRouter.put("/lignes/:ligneId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const ligneId = String(req.params.ligneId || "").trim();
  if (!ligneId) return res.status(400).json({ error: "Invalid ligneId" });

  const parsed = projectLigneUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  try {
    const item = await prisma.$transaction(async (tx) => {
      await getScopedProjectLigne(tx, ligneId, parsed.data.projectId, parsed.data.niveauId);

      return tx.ferLigne.update({
        where: { id: ligneId },
        data: {
          designation: parsed.data.designation,
          nomenclature: optionalString(parsed.data.nomenclature),
          nb: parsed.data.nb ?? null,
          hauteur: parsed.data.hauteur ?? null,
          forme: optionalString(parsed.data.forme),
          diametreMm: parsed.data.diametreMm ?? null,
          payloadJson: JSON.stringify(parsed.data.payload ?? {}),
          qtyByMmJson: JSON.stringify(parsed.data.qtyByMm ?? {}),
          poidsByMmJson: JSON.stringify(parsed.data.poidsByMm ?? {}),
        },
      });
    });

    return res.json({ item: mapProjectLigne(item) });
  } catch (error) {
    if (error instanceof Error && error.message === "LIGNE_NOT_FOUND") {
      return res.status(404).json({ error: "Ligne not found" });
    }

    throw error;
  }
});

ferraillageRouter.delete("/lignes/:ligneId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const ligneId = String(req.params.ligneId || "").trim();
  if (!ligneId) return res.status(400).json({ error: "Invalid ligneId" });

  const parsed = projectLigneScopeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  try {
    await prisma.$transaction(async (tx) => {
      await getScopedProjectLigne(tx, ligneId, parsed.data.projectId, parsed.data.niveauId);
      await tx.ferLigne.delete({ where: { id: ligneId } });
    });

    return res.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "LIGNE_NOT_FOUND") {
      return res.status(404).json({ error: "Ligne not found" });
    }

    throw error;
  }
});

ferraillageRouter.post("/projects/:projectId/lignes", createProjectLigne);

ferraillageRouter.post("/projects/:projectId/niveaux/:niveauId/lignes", createProjectLigne);

ferraillageRouter.post("/rapports", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const parsed = rapportCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const chantierName = parsed.data.chantierName;
  const responsable = pickResponsable(parsed.data.responsable, parsed.data.sousTraitant);

  const item = await prisma.ferRapport.upsert({
    where: {
      chantierName_responsable: {
        chantierName,
        responsable,
      },
    },
    update: {},
    create: { chantierName, responsable },
    select: rapportSummarySelect,
  });

  res.json({ item: mapRapportSummary(item) });
});

ferraillageRouter.get("/projects/:projectId", sendRapportDetail);

ferraillageRouter.get("/rapports/:rapportId", sendRapportDetail);

ferraillageRouter.delete("/rapports/:rapportId", async (req: AuthedRequest, res: Response) => {
  const auth = await requireFerraillage(req, res);
  if (!auth) return;

  const rapportId = String(req.params.rapportId || "").trim();
  if (!rapportId) return res.status(400).json({ error: "Invalid rapportId" });

  await prisma.ferRapport.delete({ where: { id: rapportId } });
  res.json({ ok: true });
});

ferraillageRouter.use(attFerraillageRouter);
