import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import * as CertificateController from "../controllers/CertificateController";

const certificateRoutes = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 4,
    fileSize: 20 * 1024 * 1024
  }
});

certificateRoutes.get("/certificates/orders", isAuth, CertificateController.listOrders);
certificateRoutes.get(
  "/certificates/orders/by-contact/:contactId",
  isAuth,
  CertificateController.listOrdersByContact
);
certificateRoutes.get(
  "/certificates/lookups/customer-by-document",
  isAuth,
  CertificateController.lookupCustomer
);
certificateRoutes.get(
  "/certificates/lookups/create-order-products",
  isAuth,
  CertificateController.listProducts
);
certificateRoutes.post(
  "/certificates/orders/create",
  isAuth,
  CertificateController.createOrder
);
certificateRoutes.post(
  "/certificates/agent-chat",
  isAuth,
  upload.array("attachments", 4),
  CertificateController.agentChat
);
certificateRoutes.post(
  "/certificates/realtime/session",
  isAuth,
  CertificateController.realtimeSession
);
certificateRoutes.post(
  "/certificates/realtime/tool-call",
  isAuth,
  CertificateController.realtimeToolCall
);

export default certificateRoutes;
