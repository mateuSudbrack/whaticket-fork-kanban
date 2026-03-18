import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as FlowController from "../controllers/FlowController";

const flowRoutes = Router();

flowRoutes.get("/flows", isAuth, FlowController.index);
flowRoutes.post("/flows", isAuth, FlowController.store);
flowRoutes.put("/flows/:flowId", isAuth, FlowController.update);
flowRoutes.delete("/flows/:flowId", isAuth, FlowController.remove);
flowRoutes.post("/flows/:flowId/run/:ticketId", isAuth, FlowController.run);

export default flowRoutes;
