import { Router } from "express";
import { diametresRouter } from "./diametres.routes";
import { etatRouter } from "./etat.routes";
import { mouvementsRouter } from "./mouvements.routes";
import { restantRouter } from "./restant.routes";

export const attFerraillageRouter = Router();

attFerraillageRouter.use(diametresRouter);
attFerraillageRouter.use(etatRouter);
attFerraillageRouter.use(mouvementsRouter);
attFerraillageRouter.use(restantRouter);
