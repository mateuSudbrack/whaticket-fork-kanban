import * as Yup from "yup";
import { Request, Response } from "express";
import Tag from "../models/Tag";
import AppError from "../errors/AppError";

const schema = Yup.object().shape({
  name: Yup.string().required(),
  color: Yup.string(),
  active: Yup.boolean()
});

export const index = async (_: Request, res: Response): Promise<Response> => {
  const tags = await Tag.findAll({
    order: [["name", "ASC"], ["id", "ASC"]]
  });

  return res.json(tags);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const tag = await Tag.create(req.body);
  return res.status(201).json(tag);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  try {
    await schema.validate(req.body);
  } catch (err) {
    throw new AppError(err.message);
  }

  const { tagId } = req.params;
  const tag = await Tag.findByPk(tagId);

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  await tag.update(req.body);
  return res.json(tag);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { tagId } = req.params;
  const tag = await Tag.findByPk(tagId);

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  await tag.destroy();
  return res.json({ message: "Tag deleted" });
};
