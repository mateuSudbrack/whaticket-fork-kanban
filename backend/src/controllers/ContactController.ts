import * as Yup from "yup";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";

import ListContactsService from "../services/ContactServices/ListContactsService";
import CreateContactService from "../services/ContactServices/CreateContactService";
import ShowContactService from "../services/ContactServices/ShowContactService";
import UpdateContactService from "../services/ContactServices/UpdateContactService";
import DeleteContactService from "../services/ContactServices/DeleteContactService";

import CheckContactNumber from "../services/WbotServices/CheckNumber";
import CheckIsValidContact from "../services/WbotServices/CheckIsValidContact";
import GetProfilePicUrl from "../services/WbotServices/GetProfilePicUrl";
import AppError from "../errors/AppError";
import GetContactService from "../services/ContactServices/GetContactService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type IndexGetContactQuery = {
  name: string;
  number: string;
};

interface ExtraInfo {
  id?: number;
  fieldDefinitionId?: number;
  name: string;
  value: string;
}
interface ContactData {
  name: string;
  number: string;
  email?: string;
  extraInfo?: ExtraInfo[];
  tagIds?: number[];
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const { contacts, count, hasMore } = await ListContactsService({
    searchParam,
    pageNumber
  });

  return res.json({ contacts, count, hasMore });
};

export const getContact = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { name, number } = req.body as IndexGetContactQuery;

  const contact = await GetContactService({
    name,
    number
  });

  return res.status(200).json(contact);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newContact: ContactData = req.body;
  newContact.number = newContact.number.replace(/\D/g, "");

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    number: Yup.string()
      .required()
      .matches(/^\d+$/, "Invalid number format. Only numbers is allowed.")
  });

  try {
    await schema.validate(newContact);
  } catch (err) {
    throw new AppError(err.message);
  }

  let validNumber = newContact.number;
  let profilePicUrl = "";

  try {
    await CheckIsValidContact(newContact.number);
    validNumber = await CheckContactNumber(newContact.number);
  } catch (err) {
    if (
      err instanceof AppError &&
      ["ERR_WAPP_INVALID_CONTACT", "ERR_WAPP_CHECK_CONTACT"].includes(err.message)
    ) {
      validNumber = newContact.number;
    } else {
      throw err;
    }
  }

  try {
    profilePicUrl = await GetProfilePicUrl(validNumber);
  } catch (err) {
    profilePicUrl = "";
  }

  let name = newContact.name;
  let number = validNumber;
  let email = newContact.email;
  let extraInfo = newContact.extraInfo;

  const contact = await CreateContactService({
    name,
    number,
    email,
    extraInfo,
    profilePicUrl
  });

  const io = getIO();
  io.emit("contact", {
    action: "create",
    contact
  });

  return res.status(200).json(contact);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { contactId } = req.params;

  const contact = await ShowContactService(contactId);

  return res.status(200).json(contact);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const contactData: ContactData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string(),
    number: Yup.string().matches(
      /^\d+$/,
      "Invalid number format. Only numbers is allowed."
    )
  });

  try {
    await schema.validate(contactData);
  } catch (err) {
    throw new AppError(err.message);
  }

  if (contactData.number) {
    try {
      await CheckIsValidContact(contactData.number);
    } catch (err) {
      if (
        !(err instanceof AppError) ||
        !["ERR_WAPP_INVALID_CONTACT", "ERR_WAPP_CHECK_CONTACT"].includes(err.message)
      ) {
        throw err;
      }
    }
  }

  const { contactId } = req.params;

  const contact = await UpdateContactService({ contactData, contactId });

  const io = getIO();
  io.emit("contact", {
    action: "update",
    contact
  });

  return res.status(200).json(contact);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { contactId } = req.params;

  await DeleteContactService(contactId);

  const io = getIO();
  io.emit("contact", {
    action: "delete",
    contactId
  });

  return res.status(200).json({ message: "Contact deleted" });
};
