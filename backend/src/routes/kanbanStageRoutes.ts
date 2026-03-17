import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as KanbanStageController from "../controllers/KanbanStageController";

const kanbanStageRoutes = Router();

kanbanStageRoutes.get("/kanban-stages", isAuth, KanbanStageController.index);
kanbanStageRoutes.post("/kanban-stages", isAuth, KanbanStageController.store);
kanbanStageRoutes.put(
  "/kanban-stages/:stageId",
  isAuth,
  KanbanStageController.update
);
kanbanStageRoutes.delete(
  "/kanban-stages/:stageId",
  isAuth,
  KanbanStageController.remove
);

export default kanbanStageRoutes;
