import * as Yup from "yup";
import { Request, Response } from "express";
import KanbanPipeline from "../models/KanbanPipeline";
import KanbanStage from "../models/KanbanStage";
import AppError from "../errors/AppError";

const schema = Yup.object().shape({
  name: Yup.string().required(),
  color: Yup.string(),
  sortOrder: Yup.number(),
  active: Yup.boolean()
});

export const index = async (_: Request, res: Response): Promise<Response> => {
  const pipelines = await KanbanPipeline.findAll({
    include: [
      {
        model: KanbanStage,
        as: "stages"
      }
    ],
    order: [
      ["sortOrder", "ASC"],
      ["id", "ASC"],
      [{ model: KanbanStage, as: "stages" }, "sortOrder", "ASC"],
      [{ model: KanbanStage, as: "stages" }, "id", "ASC"]
    ]
  });

  return res.json(pipelines);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const pipeline = await KanbanPipeline.create(req.body);
  return res.status(201).json(pipeline);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { pipelineId } = req.params;
  const pipeline = await KanbanPipeline.findByPk(pipelineId);

  if (!pipeline) {
    throw new AppError("ERR_NO_KANBAN_PIPELINE_FOUND", 404);
  }

  await pipeline.update(req.body);
  return res.json(pipeline);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { pipelineId } = req.params;
  const pipeline = await KanbanPipeline.findByPk(pipelineId, {
    include: [
      {
        model: KanbanStage,
        as: "stages"
      }
    ]
  });

  if (!pipeline) {
    throw new AppError("ERR_NO_KANBAN_PIPELINE_FOUND", 404);
  }

  if (pipeline.stages?.length) {
    throw new AppError("ERR_PIPELINE_HAS_STAGES", 400);
  }

  await pipeline.destroy();
  return res.json({ message: "Kanban pipeline deleted" });
};
