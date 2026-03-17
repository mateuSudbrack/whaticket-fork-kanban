import * as Yup from "yup";
import { Request, Response } from "express";
import ContactFieldDefinition from "../models/ContactFieldDefinition";
import AppError from "../errors/AppError";

type DefinitionData = {
  name: string;
  type?: string;
  required?: boolean;
  active?: boolean;
  sortOrder?: number;
  options?: string[];
};

const schema = Yup.object().shape({
  name: Yup.string().required(),
  type: Yup.string().oneOf(["text", "textarea", "number", "date", "select"]),
  required: Yup.boolean(),
  active: Yup.boolean(),
  sortOrder: Yup.number(),
  options: Yup.array().of(Yup.string())
});

const normalizeOptions = (options?: string[]): string | null => {
  if (!options || !options.length) {
    return null;
  }

  return JSON.stringify(options.filter(Boolean));
};

const serializeDefinition = (definition: ContactFieldDefinition) => ({
  ...definition.toJSON(),
  options: definition.options ? JSON.parse(definition.options) : []
});

export const index = async (_: Request, res: Response): Promise<Response> => {
  const definitions = await ContactFieldDefinition.findAll({
    order: [
      ["sortOrder", "ASC"],
      ["name", "ASC"]
    ]
  });

  return res.json(definitions.map(serializeDefinition));
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const data = req.body as DefinitionData;

  try {
    await schema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const definition = await ContactFieldDefinition.create({
    name: data.name,
    type: data.type || "text",
    required: data.required || false,
    active: data.active !== false,
    sortOrder: data.sortOrder || 0,
    options: normalizeOptions(data.options)
  });

  return res.status(201).json(serializeDefinition(definition));
};

export const update = async (req: Request, res: Response): Promise<Response> => {
  const data = req.body as DefinitionData;
  const { definitionId } = req.params;

  try {
    await schema.validate(data);
  } catch (err) {
    throw new AppError(err.message);
  }

  const definition = await ContactFieldDefinition.findByPk(definitionId);

  if (!definition) {
    throw new AppError("ERR_NO_CONTACT_FIELD_DEFINITION_FOUND", 404);
  }

  await definition.update({
    name: data.name,
    type: data.type || "text",
    required: data.required || false,
    active: data.active !== false,
    sortOrder: data.sortOrder || 0,
    options: normalizeOptions(data.options)
  });

  return res.json(serializeDefinition(definition));
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
  const { definitionId } = req.params;
  const definition = await ContactFieldDefinition.findByPk(definitionId);

  if (!definition) {
    throw new AppError("ERR_NO_CONTACT_FIELD_DEFINITION_FOUND", 404);
  }

  await definition.destroy();

  return res.json({ message: "Contact field definition deleted" });
};
