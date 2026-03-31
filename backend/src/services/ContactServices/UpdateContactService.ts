import AppError from "../../errors/AppError";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import Ticket from "../../models/Ticket";
import GetContactNumberVariants from "../../helpers/GetContactNumberVariants";
import { findFlowsForContext, startFlowExecution } from "../FlowServices/FlowEngine";
import SyncUnifiedTagsService from "../SyncUnifiedTagsService";

interface ExtraInfo {
  id?: number;
  fieldDefinitionId?: number;
  name: string;
  value: string;
}
interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  extraInfo?: ExtraInfo[];
  tagIds?: number[];
}

interface Request {
  contactData: ContactData;
  contactId: string;
}

const UpdateContactService = async ({
  contactData,
  contactId
}: Request): Promise<Contact> => {
  const { email, name, number, extraInfo, tagIds } = contactData;

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: ["id", "name", "number", "email", "profilePicUrl"],
    include: [
      {
        association: "extraInfo",
        include: ["fieldDefinition"]
      },
      {
        association: "tags"
      }
    ]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  const previousTagIds = new Set((contact.tags || []).map(tag => tag.id));
  const normalizedNumber = number ? String(number).replace(/\D/g, "") : contact.number;
  const nextTagIds = Array.isArray(tagIds) ? Array.from(new Set(tagIds.map(tagId => Number(tagId)))) : undefined;

  if (number) {
    const duplicatedContact = await Contact.findOne({
      where: {
        id: {
          [Op.ne]: contact.id
        },
        number: {
          [Op.in]: GetContactNumberVariants(normalizedNumber)
        }
      },
      attributes: ["id"]
    });

    if (duplicatedContact) {
      throw new AppError("ERR_DUPLICATED_CONTACT");
    }
  }

  if (extraInfo) {
    await Promise.all(
      extraInfo.map(async info => {
        await ContactCustomField.upsert({ ...info, contactId: contact.id });
      })
    );

    await Promise.all(
      contact.extraInfo.map(async oldInfo => {
        const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);

        if (stillExists === -1) {
          await ContactCustomField.destroy({ where: { id: oldInfo.id } });
        }
      })
    );
  }

  await contact.update({
    name,
    number: normalizedNumber,
    email
  });

  if (nextTagIds) {
    await SyncUnifiedTagsService(contact.id, nextTagIds);
  }

  await contact.reload({
    attributes: ["id", "name", "number", "email", "profilePicUrl"],
    include: [
      {
        association: "extraInfo",
        include: ["fieldDefinition"]
      },
      {
        association: "tags"
      }
    ]
  });

  if (nextTagIds) {
    const persistedTagIds = new Set((contact.tags || []).map(tag => tag.id));
    const addedTagIds = [...persistedTagIds].filter(tagId => !previousTagIds.has(tagId));

    if (addedTagIds.length > 0) {
      const tickets = await Ticket.findAll({
        where: {
          contactId: contact.id
        },
        order: [["updatedAt", "DESC"]]
      });

      for (const ticket of tickets) {
        for (const tagId of addedTagIds) {
          const tagFlows = await findFlowsForContext("tag_added", { tagId });
          for (const flow of tagFlows) {
            await startFlowExecution(flow.id, ticket.id, {
              triggerType: "tag_added",
              meta: {
                tagId,
                source: "contact"
              }
            });
          }
        }
      }
    }
  }

  return contact;
};

export default UpdateContactService;
