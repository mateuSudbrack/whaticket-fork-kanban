import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import GetContactNumberVariants from "../../helpers/GetContactNumberVariants";

interface ExtraInfo {
  fieldDefinitionId?: number;
  name: string;
  value: string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  extraInfo?: ExtraInfo[];
  tagIds?: number[];
}

const CreateContactService = async ({
  name,
  number,
  email = "",
  profilePicUrl = "",
  extraInfo = [],
  tagIds = []
}: Request): Promise<Contact> => {
  const normalizedNumber = String(number || "").replace(/\D/g, "");
  const numberVariants = GetContactNumberVariants(normalizedNumber);
  const numberExists = await Contact.findOne({
    where: {
      number: {
        [Op.in]: numberVariants
      }
    }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  const contact = await Contact.create(
    {
      name,
      number: normalizedNumber,
      email,
      profilePicUrl,
      extraInfo
    },
    {
      include: ["extraInfo"]
    }
  );

  if (tagIds.length > 0) {
    await contact.$set("tags", tagIds);
  }

  await contact.reload({
    include: [
      "extraInfo",
      "tags"
    ]
  });

  return contact;
};

export default CreateContactService;
