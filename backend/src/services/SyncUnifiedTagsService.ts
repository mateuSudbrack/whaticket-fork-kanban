import Contact from "../models/Contact";
import Ticket from "../models/Ticket";

const normalizeTagIds = (tagIds: number[] = []) =>
  Array.from(
    new Set(
      tagIds
        .map(tagId => Number(tagId))
        .filter(tagId => Number.isInteger(tagId) && tagId > 0)
    )
  );

const SyncUnifiedTagsService = async (
  contactId: string | number,
  tagIds: number[] = []
): Promise<void> => {
  const normalizedTagIds = normalizeTagIds(tagIds);

  const contact = await Contact.findByPk(contactId, {
    attributes: ["id"]
  });

  if (!contact) {
    return;
  }

  await contact.$set("tags", normalizedTagIds);

  const tickets = await Ticket.findAll({
    where: { contactId: contact.id },
    attributes: ["id"]
  });

  await Promise.all(
    tickets.map(ticket => ticket.$set("tags", normalizedTagIds))
  );
};

export default SyncUnifiedTagsService;
