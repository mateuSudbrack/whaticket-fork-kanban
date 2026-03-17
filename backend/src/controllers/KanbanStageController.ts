import * as Yup from "yup";
import { Request, Response } from "express";
import KanbanStage from "../models/KanbanStage";
import AppError from "../errors/AppError";

const schema = Yup.object().shape({
  name: Yup.string().required(),
  color: Yup.string(),
  sortOrder: Yup.number(),
  active: Yup.boolean()
});

export const index = async (_: Request, res: Response): Promise<Response> => {
  const stages = await KanbanStage.findAll({
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"]
    ]
  });

  return res.json(stages);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const stage = await KanbanStage.create(req.body);
  return res.status(201).json(stage);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { stageId } = req.params;
  const stage = await KanbanStage.findByPk(stageId);

  if (!stage) {
    throw new AppError("ERR_NO_KANBAN_STAGE_FOUND", 404);
  }

  await stage.update(req.body);
  return res.json(stage);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { stageId } = req.params;
  const stage = await KanbanStage.findByPk(stageId);

  if (!stage) {
    throw new AppError("ERR_NO_KANBAN_STAGE_FOUND", 404);
  }

  await stage.destroy();
  return res.json({ message: "Kanban stage deleted" });
};
