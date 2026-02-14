import { z } from "zod";
import { Prisma, FerMouvementType } from "@prisma/client";

export const mmSchema = z.number().int().min(1).max(100);
export const qtySchema = z.union([z.string(), z.number()]).transform((v) => new Prisma.Decimal(String(v)));
export const lignesSchema = z.array(z.object({ mm: mmSchema, qty: qtySchema })).min(1);

export const mouvementTypeSchema = z.nativeEnum(FerMouvementType).default(FerMouvementType.LIVRAISON);

export const etatCreateSchema = z
  .object({
    rapportId: z.string().cuid().optional(),
    chantierName: z.string().min(1).optional(),
    sousTraitant: z.string().optional().nullable(),
    etatDate: z.coerce.date().optional().nullable(),
  })
  .refine((d) => Boolean(d.rapportId || d.chantierName), {
    message: "rapportId or chantierName is required",
  });

export const mouvementCreateSchema = z.object({
  date: z.coerce.date(),
  type: mouvementTypeSchema,
  bonLivraison: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lignes: lignesSchema,
});

export const mouvementUpdateSchema = z.object({
  date: z.coerce.date().optional(),
  type: z.nativeEnum(FerMouvementType).optional(),
  bonLivraison: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  lignes: lignesSchema.optional(),
});

export const restantCreateSchema = z
  .object({
    rapportId: z.string().cuid().optional(),
    chantierName: z.string().min(1).optional(),
    sousTraitant: z.string().optional().nullable(),
    rapportDate: z.coerce.date().optional().nullable(),
  })
  .refine((d) => Boolean(d.rapportId || d.chantierName), {
    message: "rapportId or chantierName is required",
  });

export const restantSnapshotSchema = z.object({
  date: z.coerce.date(),
  note: z.string().optional().nullable(),
  lignes: lignesSchema,
});
