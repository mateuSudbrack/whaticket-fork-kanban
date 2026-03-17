import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as KanbanPipelineController from "../controllers/KanbanPipelineController";

const kanbanPipelineRoutes = Router();

kanbanPipelineRoutes.get(
  "/kanban-pipelines",
  isAuth,
  KanbanPipelineController.index
);
kanbanPipelineRoutes.post(
  "/kanban-pipelines",
  isAuth,
  KanbanPipelineController.store
);
kanbanPipelineRoutes.put(
  "/kanban-pipelines/:pipelineId",
  isAuth,
  KanbanPipelineController.update
);
kanbanPipelineRoutes.delete(
  "/kanban-pipelines/:pipelineId",
  isAuth,
  KanbanPipelineController.remove
);

export default kanbanPipelineRoutes;
