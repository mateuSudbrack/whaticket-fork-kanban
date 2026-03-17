import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as ContactFieldDefinitionController from "../controllers/ContactFieldDefinitionController";

const contactFieldDefinitionRoutes = Router();

contactFieldDefinitionRoutes.get(
  "/contact-field-definitions",
  isAuth,
  ContactFieldDefinitionController.index
);

contactFieldDefinitionRoutes.post(
  "/contact-field-definitions",
  isAuth,
  ContactFieldDefinitionController.store
);

contactFieldDefinitionRoutes.put(
  "/contact-field-definitions/:definitionId",
  isAuth,
  ContactFieldDefinitionController.update
);

contactFieldDefinitionRoutes.delete(
  "/contact-field-definitions/:definitionId",
  isAuth,
  ContactFieldDefinitionController.remove
);

export default contactFieldDefinitionRoutes;
