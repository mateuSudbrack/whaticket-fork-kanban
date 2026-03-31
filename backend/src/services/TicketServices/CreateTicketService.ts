import AppError from "../../errors/AppError";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import User from "../../models/User";
import ShowContactService from "../ContactServices/ShowContactService";
import KanbanStage from "../../models/KanbanStage";
import KanbanPipeline from "../../models/KanbanPipeline";
import SyncUnifiedTagsService from "../SyncUnifiedTagsService";

interface Request {
  contactId: number;
  status: string;
  userId: number;
  queueId?: number;
  pipelineId?: number;
  kanbanStageId?: number;
}

const CreateTicketService = async ({
  contactId,
  status,
  userId,
  queueId,
  pipelineId,
  kanbanStageId
}: Request): Promise<Ticket> => {
  const defaultWhatsapp = await GetDefaultWhatsApp(userId);

  await CheckContactOpenTickets(contactId, defaultWhatsapp.id);

  const { isGroup, tags } = await ShowContactService(contactId);

  if (queueId === undefined) {
    const user = await User.findByPk(userId, { include: ["queues"] });
    queueId = user?.queues.length === 1 ? user.queues[0].id : undefined;
  }

  if (pipelineId === undefined) {
    const firstPipeline = await KanbanPipeline.findOne({
      where: { active: true },
      order: [["sortOrder", "ASC"]]
    });
    pipelineId = firstPipeline?.id;
  }

  if (kanbanStageId === undefined) {
    const firstStage = await KanbanStage.findOne({
      where: { active: true, ...(pipelineId ? { pipelineId } : {}) },
      order: [["sortOrder", "ASC"]]
    });
    kanbanStageId = firstStage?.id;
    pipelineId = firstStage?.pipelineId || pipelineId;
  }

  const { id }: Ticket = await defaultWhatsapp.$create("ticket", {
    contactId,
    status,
    isGroup,
    userId,
    queueId,
    pipelineId,
    kanbanStageId
  });

  const ticket = await Ticket.findByPk(id, { include: ["contact"] });

  if (!ticket) {
    throw new AppError("ERR_CREATING_TICKET");
  }

  await SyncUnifiedTagsService(contactId, (tags || []).map(tag => tag.id));

  return ticket;
};

export default CreateTicketService;
