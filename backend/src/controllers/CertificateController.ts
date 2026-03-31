import { Request, Response } from "express";
import AppError from "../errors/AppError";
import {
  createCertificateOrder,
  createCertificateRealtimeSession,
  executeCertificateRealtimeTool,
  listCertificateOrders,
  listCertificateOrdersByContact,
  listCertificateProducts,
  lookupCertificateCustomerByDocument,
  runCertificateAgentChat
} from "../services/CertificateServices/CertificateGatewayService";

function ensureAdmin(req: Request) {
  if (req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }
}

export const listOrders = async (req: Request, res: Response): Promise<Response> => {
  ensureAdmin(req);

  const payload = await listCertificateOrders({
    search: String(req.query.search || ""),
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    startDate: String(req.query.startDate || ""),
    endDate: String(req.query.endDate || "")
  });

  return res.json(payload);
};

export const listOrdersByContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);

  const payload = await listCertificateOrdersByContact(req.params.contactId, {
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    startDate: String(req.query.startDate || ""),
    endDate: String(req.query.endDate || ""),
    all: String(req.query.all || "true").toLowerCase() === "true"
  });

  return res.json(payload);
};

export const lookupCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);

  const payload = await lookupCertificateCustomerByDocument(
    String(req.query.document || "")
  );
  return res.json(payload);
};

export const listProducts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);

  const payload = await listCertificateProducts({
    search: String(req.query.search || ""),
    personType: String(req.query.personType || "")
  });
  return res.json(payload);
};

export const createOrder = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);

  const payload = await createCertificateOrder(req.body || {});
  return res.status(201).json(payload);
};

export const agentChat = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);

  const messages = JSON.parse(String(req.body?.messages || "[]"));
  const payload = await runCertificateAgentChat({
    messages,
    attachments: Array.isArray(req.files) ? (req.files as Express.Multer.File[]) : []
  });
  return res.json(payload);
};

export const realtimeSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);

  const payload = await createCertificateRealtimeSession();
  return res.json(payload);
};

export const realtimeToolCall = async (
  req: Request,
  res: Response
): Promise<Response> => {
  ensureAdmin(req);

  const payload = await executeCertificateRealtimeTool(req.body || {});
  return res.json(payload);
};
