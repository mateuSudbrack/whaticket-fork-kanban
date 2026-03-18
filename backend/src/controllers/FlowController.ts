import * as Yup from "yup";
import { Request, Response } from "express";
import Flow from "../models/Flow";
import AppError from "../errors/AppError";
import { startFlowExecution } from "../services/FlowServices/FlowEngine";

const schema = Yup.object().shape({
  name: Yup.string().required(),
  description: Yup.string(),
  active: Yup.boolean(),
  triggers: Yup.array().required(),
  conditions: Yup.array().required(),
  actions: Yup.array().required(),
  layout: Yup.object()
});

const parseJsonField = (value: any, fallback: any) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return fallback;
    }
  }

  return value;
};

const serializeFlow = (flow: Flow) => {
  const data = flow.toJSON() as any;

  return {
    ...data,
    triggers: parseJsonField(data.triggers, []),
    conditions: parseJsonField(data.conditions, []),
    actions: parseJsonField(data.actions, []),
    layout: parseJsonField(data.layout, {})
  };
};

export const index = async (_: Request, res: Response): Promise<Response> => {
  const flows = await Flow.findAll({
    order: [["name", "ASC"], ["id", "ASC"]]
  });

  return res.json(flows.map(serializeFlow));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const flow = await Flow.create(req.body);
  return res.status(201).json(serializeFlow(flow));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const flow = await Flow.findByPk(req.params.flowId);
  if (!flow) {
    throw new AppError("ERR_NO_FLOW_FOUND", 404);
  }

  await flow.update(req.body);
  return res.json(serializeFlow(flow));
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const flow = await Flow.findByPk(req.params.flowId);
  if (!flow) {
    throw new AppError("ERR_NO_FLOW_FOUND", 404);
  }

  await flow.destroy();
  return res.json({ message: "Flow deleted" });
};

export const run = async (req: Request, res: Response): Promise<Response> => {
  const { flowId, ticketId } = req.params;
  const execution = await startFlowExecution(Number(flowId), Number(ticketId), {
    triggerType: "flow_sent",
    meta: { requestedBy: req.user.id }
  });

  return res.json(execution);
};
