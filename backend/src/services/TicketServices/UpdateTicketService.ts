import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import ShowTicketService from "./ShowTicketService";
import KanbanStage from "../../models/KanbanStage";
import KanbanPipeline from "../../models/KanbanPipeline";

interface TicketData {
  status?: string;
  userId?: number;
  queueId?: number;
  whatsappId?: number;
  pipelineId?: number;
  kanbanStageId?: number;
  tagIds?: number[];
}

interface Request {
  ticketData: TicketData;
  ticketId: string | number;
}

interface Response {
  ticket: Ticket;
  oldStatus: string;
  oldUserId: number | undefined;
}

const UpdateTicketService = async ({
  ticketData,
  ticketId
}: Request): Promise<Response> => {
  const { status, userId, queueId, whatsappId, tagIds } = ticketData;
  let { pipelineId, kanbanStageId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
  await SetTicketMessagesAsRead(ticket);

  if (whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.user?.id;

  if (oldStatus === "closed") {
    await CheckContactOpenTickets(ticket.contact.id, ticket.whatsappId);
  }

  if (pipelineId) {
    const pipeline = await KanbanPipeline.findByPk(pipelineId);

    if (!pipeline) {
      throw new AppError("ERR_NO_KANBAN_PIPELINE_FOUND", 404);
    }
  }

  if (kanbanStageId) {
    const stage = await KanbanStage.findByPk(kanbanStageId);

    if (!stage) {
      throw new AppError("ERR_NO_KANBAN_STAGE_FOUND", 404);
    }

    pipelineId = stage.pipelineId;
  } else if (pipelineId && pipelineId !== ticket.pipelineId) {
    const firstStage = await KanbanStage.findOne({
      where: { pipelineId, active: true },
      order: [["sortOrder", "ASC"]]
    });
    kanbanStageId = firstStage?.id;
  }

  await ticket.update({
    status,
    queueId,
    userId,
    pipelineId,
    kanbanStageId
  });

  if (whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  if (tagIds) {
    await ticket.$set("tags", tagIds);
  }

  const updatedTicket = await ShowTicketService(ticketId);

  const io = getIO();

  if (updatedTicket.status !== oldStatus || updatedTicket.user?.id !== oldUserId) {
    io.to(oldStatus).emit("ticket", {
      action: "delete",
      ticketId: updatedTicket.id
    });
  }

  io.to(updatedTicket.status)
    .to("notification")
    .to(ticketId.toString())
    .emit("ticket", {
      action: "update",
      ticket: updatedTicket
    });

  return { ticket: updatedTicket, oldStatus, oldUserId };
};

export default UpdateTicketService;
