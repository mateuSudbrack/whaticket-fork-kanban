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
import { findFlowsForContext, startFlowExecution } from "../FlowServices/FlowEngine";
import SyncUnifiedTagsService from "../SyncUnifiedTagsService";

interface TicketData {
  status?: string;
  userId?: number | null;
  queueId?: number | null;
  whatsappId?: number;
  pipelineId?: number | null;
  kanbanStageId?: number | null;
  tagIds?: number[];
  flowsPaused?: boolean;
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
  const { status, userId, queueId, whatsappId, tagIds, flowsPaused } = ticketData;
  let { pipelineId, kanbanStageId } = ticketData;

  const ticket = await ShowTicketService(ticketId);
  await SetTicketMessagesAsRead(ticket);

  if (whatsappId && ticket.whatsappId !== whatsappId) {
    await CheckContactOpenTickets(ticket.contactId, whatsappId);
  }

  const oldStatus = ticket.status;
  const oldUserId = ticket.user?.id;
  const oldQueueId = ticket.queueId;
  const previousTagIds = new Set((ticket.tags || []).map(tag => tag.id));

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
    kanbanStageId,
    flowsPaused
  });

  if (whatsappId) {
    await ticket.update({
      whatsappId
    });
  }

  if (tagIds) {
    await SyncUnifiedTagsService(ticket.contactId, tagIds);
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

  const nextTagIds = new Set((updatedTicket.tags || []).map(tag => tag.id));
  const addedTagIds = [...nextTagIds].filter(tagId => !previousTagIds.has(tagId));

  if (updatedTicket.queueId && updatedTicket.queueId !== oldQueueId) {
    const queueFlows = await findFlowsForContext("queue_entered", {
      queueId: updatedTicket.queueId
    });
    for (const flow of queueFlows) {
      await startFlowExecution(flow.id, updatedTicket.id, {
        triggerType: "queue_entered",
        meta: {
          queueId: updatedTicket.queueId,
          previousQueueId: oldQueueId || null
        }
      });
    }
  }

  if (updatedTicket.userId && updatedTicket.userId !== oldUserId) {
    const userFlows = await findFlowsForContext("user_transferred", {
      userId: updatedTicket.userId
    });
    for (const flow of userFlows) {
      await startFlowExecution(flow.id, updatedTicket.id, {
        triggerType: "user_transferred",
        meta: {
          userId: updatedTicket.userId,
          previousUserId: oldUserId || null
        }
      });
    }
  }

  if (addedTagIds.length > 0) {
    for (const tagId of addedTagIds) {
      const tagFlows = await findFlowsForContext("tag_added", { tagId });
      for (const flow of tagFlows) {
        await startFlowExecution(flow.id, updatedTicket.id, {
          triggerType: "tag_added",
          meta: { tagId }
        });
      }
    }
  }

  return { ticket: updatedTicket, oldStatus, oldUserId };
};

export default UpdateTicketService;
