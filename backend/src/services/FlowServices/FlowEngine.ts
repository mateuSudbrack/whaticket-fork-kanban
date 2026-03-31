import fs from "fs";
import os from "os";
import path from "path";
import axios from "axios";
import Ticket from "../../models/Ticket";
import Flow from "../../models/Flow";
import FlowExecution from "../../models/FlowExecution";
import Tag from "../../models/Tag";
import ContactCustomField from "../../models/ContactCustomField";
import ShowTicketService from "../TicketServices/ShowTicketService";
import UpdateContactService from "../ContactServices/UpdateContactService";
import UpsertContactPipelineMembershipService from "../ContactServices/UpsertContactPipelineMembershipService";
import RemoveContactPipelineMembershipService from "../ContactServices/RemoveContactPipelineMembershipService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";

type FlowContext = {
  triggerType: string;
  meta?: any;
};

type FlowNode = {
  id: string;
  lane: "trigger" | "condition" | "action";
  type: string;
  payload: any;
  x?: number;
  y?: number;
};

const parseJsonField = (value: any, fallback: any) => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (err) {
      return fallback;
    }
  }

  return value;
};

const wait = (ms: number) =>
  new Promise(resolve => {
    setTimeout(resolve, ms);
  });

const inferLinearEdges = (nodes: FlowNode[] = []) =>
  nodes
    .filter(node => node.type)
    .slice(0, -1)
    .map((node, index, typedNodes) => ({
      from: node.id,
      to: typedNodes[index + 1].id
    }));

const triggerMatchesContext = (trigger: any, triggerType: string, meta: any = {}) => {
  if (trigger?.type !== triggerType) {
    return false;
  }

  const payload = trigger?.payload || {};

  if (payload.tagId && String(payload.tagId) !== String(meta.tagId || "")) {
    return false;
  }

  if (payload.queueId && String(payload.queueId) !== String(meta.queueId || "")) {
    return false;
  }

  if (payload.userId && String(payload.userId) !== String(meta.userId || "")) {
    return false;
  }

  if (payload.flowId && String(payload.flowId) !== String(meta.flowId || "")) {
    return false;
  }

  return true;
};

const buildFlowGraph = (flow: Flow) => {
  const triggers = parseJsonField((flow as any).triggers, []);
  const conditions = parseJsonField((flow as any).conditions, []);
  const actions = parseJsonField((flow as any).actions, []);
  const layout = parseJsonField((flow as any).layout, {});
  const layoutNodes = Array.isArray(layout?.nodes) ? layout.nodes : [];
  const layoutEdges = Array.isArray(layout?.edges) ? layout.edges : [];

  const consumedLayoutIds = new Set();
  const nodes: FlowNode[] = [];

  const addNodes = (items: any[], lane: FlowNode["lane"]) => {
    items.forEach((item, index) => {
      const layoutNode =
        layoutNodes.find(
          (node: any) =>
            !consumedLayoutIds.has(node.id) &&
            node.lane === lane &&
            node.type === item.type
        ) ||
        layoutNodes.find(
          (node: any) => !consumedLayoutIds.has(node.id) && node.lane === lane
        );

      if (layoutNode?.id) {
        consumedLayoutIds.add(layoutNode.id);
      }

      nodes.push({
        id: String(layoutNode?.id || `${lane}-${index}-${item.type || "node"}`),
        lane,
        type: item.type || layoutNode?.type || "",
        payload:
          item.payload !== undefined ? item.payload : layoutNode?.payload || {},
        x: layoutNode?.x,
        y: layoutNode?.y
      });
    });
  };

  addNodes(triggers, "trigger");
  addNodes(conditions, "condition");
  addNodes(actions, "action");

  if (!nodes.length && layoutNodes.length) {
    layoutNodes.forEach((node: any, index: number) => {
      nodes.push({
        id: String(node.id || `layout-node-${index}`),
        lane: node.lane,
        type: node.type || "",
        payload: node.payload || {},
        x: node.x,
        y: node.y
      });
    });
  }

  const typedNodes = nodes.filter(node => node.type);
  const edges = (layoutEdges.length ? layoutEdges : inferLinearEdges(typedNodes))
    .filter((edge: any) => edge?.from && edge?.to)
    .map((edge: any) => ({
      from: String(edge.from),
      to: String(edge.to)
    }));

  return {
    nodes: typedNodes,
    edges
  };
};

const getOrderedNodeIdsFromGraph = (
  nodes: FlowNode[],
  edges: Array<{ from: string; to: string }>,
  context: FlowContext
) => {
  const nodeMap = new Map(nodes.map(node => [String(node.id), node]));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();

  edges.forEach(edge => {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      return;
    }

    if (!outgoing.has(edge.from)) {
      outgoing.set(edge.from, []);
    }

    outgoing.get(edge.from)!.push(edge.to);
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
  });

  const starters = nodes
    .filter(node => {
      if (node.lane !== "trigger") {
        return false;
      }

      if (!triggerMatchesContext(node, context.triggerType, context.meta)) {
        return false;
      }

      return !incoming.get(String(node.id));
    })
    .sort((a, b) => (a.x || 0) - (b.x || 0) || (a.y || 0) - (b.y || 0));

  const visited = new Set<string>();
  const orderedIds: string[] = [];

  const visit = (nodeId: string) => {
    if (!nodeId || visited.has(nodeId) || !nodeMap.has(nodeId)) {
      return;
    }

    visited.add(nodeId);
    orderedIds.push(nodeId);
    (outgoing.get(nodeId) || []).forEach(visit);
  };

  starters.forEach(node => visit(String(node.id)));

  if (!orderedIds.length) {
    nodes
      .filter(node => !incoming.get(String(node.id)))
      .sort((a, b) => (a.x || 0) - (b.x || 0) || (a.y || 0) - (b.y || 0))
      .forEach(node => visit(String(node.id)));
  }

  return orderedIds;
};

const evaluateCondition = async (ticket: Ticket, condition: any): Promise<boolean> => {
  const payload = condition?.payload || {};

  switch (condition?.type) {
    case "custom_field_is": {
      const field = (ticket.contact as any)?.extraInfo?.find(
        (info: any) =>
          String(info.fieldDefinitionId || info.name) === String(payload.fieldDefinitionId || payload.name)
      );
      return String(field?.value || "") === String(payload.value || "");
    }
    case "user_is":
      return String(ticket.userId || "") === String(payload.userId || "");
    case "queue_is":
      return String(ticket.queueId || "") === String(payload.queueId || "");
    case "has_tag": {
      const tagId = String(payload.tagId || "");
      const ticketHasTag = (ticket.tags || []).some(tag => String(tag.id) === tagId);
      const contactHasTag = (((ticket.contact as any)?.tags || []) as any[]).some(
        tag => String(tag.id) === tagId
      );
      return ticketHasTag || contactHasTag;
    }
    case "time_is": {
      const now = new Date();
      const hhmm = now.toTimeString().slice(0, 5);
      return hhmm === String(payload.time || "");
    }
    case "weekday_is": {
      const weekday = new Date().getDay();
      return String(weekday) === String(payload.weekday);
    }
    default:
      return true;
  }
};

const executeAction = async (
  ticketId: number,
  action: any,
  context: FlowContext
): Promise<void> => {
  const ticket = await ShowTicketService(ticketId);
  const payload = action?.payload || {};

  switch (action?.type) {
    case "edit_custom_field":
      if (payload.fieldDefinitionId) {
        await ContactCustomField.upsert({
          contactId: ticket.contactId,
          fieldDefinitionId: Number(payload.fieldDefinitionId),
          name: payload.name || "",
          value: String(payload.value || "")
        });
      }
      break;
    case "add_tag": {
      const tagId = Number(payload.tagId);
      const target = payload.target || "contact";

      if (target === "contact" || target === "both") {
        const currentContactTagIds = ((ticket.contact as any)?.tags || []).map((tag: any) => tag.id);
        const nextContactTagIds = Array.from(new Set([...currentContactTagIds, tagId]));
        await UpdateContactService({
          contactId: String(ticket.contactId),
          contactData: {
            tagIds: nextContactTagIds
          }
        });
      }

      if (target === "conversation" || target === "both") {
        const currentTicketTagIds = (ticket.tags || []).map(tag => tag.id);
        const nextTicketTagIds = Array.from(new Set([...currentTicketTagIds, tagId]));
        await UpdateTicketService({
          ticketId,
          ticketData: {
            tagIds: nextTicketTagIds
          }
        });
      }
      break;
    }
    case "send_message":
      if (payload.body) {
        await SendWhatsAppMessage({
          body: String(payload.body),
          ticket
        });
      }
      break;
    case "send_photo":
      if (payload.fileUrl || payload.filePath) {
        let resolvedPath = "";
        let cleanupPath = "";

        try {
          if (payload.fileUrl) {
            const response = await axios.get(String(payload.fileUrl), {
              responseType: "arraybuffer"
            });
            const extension =
              path.extname(new URL(String(payload.fileUrl)).pathname) ||
              (String(response.headers["content-type"] || "").includes("png") ? ".png" : ".jpg");
            cleanupPath = path.join(os.tmpdir(), `flow-photo-${ticketId}-${Date.now()}${extension}`);
            fs.writeFileSync(cleanupPath, Buffer.from(response.data));
            resolvedPath = cleanupPath;
          } else {
            resolvedPath = path.isAbsolute(payload.filePath)
              ? payload.filePath
              : path.join(process.cwd(), payload.filePath);
          }

          const stats = fs.statSync(resolvedPath);
          await SendWhatsAppMedia({
            media: {
              fieldname: "flow-photo",
              originalname: path.basename(resolvedPath),
              encoding: "7bit",
              mimetype: payload.mimetype || "image/jpeg",
              destination: path.dirname(resolvedPath),
              filename: path.basename(resolvedPath),
              path: resolvedPath,
              size: stats.size,
              stream: fs.createReadStream(resolvedPath),
              buffer: Buffer.alloc(0)
            } as Express.Multer.File,
            body: payload.caption || "",
            ticket
          });
        } finally {
          if (cleanupPath && fs.existsSync(cleanupPath)) {
            fs.unlinkSync(cleanupPath);
          }
        }
      }
      break;
    case "transfer_queue":
      await UpdateTicketService({
        ticketId,
        ticketData: {
          queueId: Number(payload.queueId || null)
        }
      });
      break;
    case "transfer_user":
      await UpdateTicketService({
        ticketId,
        ticketData: {
          userId: payload.userId ? Number(payload.userId) : null
        }
      });
      break;
    case "trigger_flow":
      if (payload.flowId) {
        await startFlowExecution(Number(payload.flowId), ticketId, {
          triggerType: "flow_sent",
          meta: { parentContext: context }
        });
      }
      break;
    case "send_webhook":
      if (payload.url) {
        await axios.post(String(payload.url), {
          ticketId,
          flowContext: context,
          ticket
        });
      }
      break;
    case "wait":
      await wait(Number(payload.ms || 1000));
      break;
    case "random_delay": {
      const min = Number(payload.minMs || 1000);
      const max = Number(payload.maxMs || min);
      const delay = Math.floor(Math.random() * (max - min + 1)) + min;
      await wait(delay);
      break;
    }
    case "move_main_kanban_stage":
      await UpdateTicketService({
        ticketId,
        ticketData: {
          status: String(payload.status || ticket.status)
        }
      });
      break;
    case "move_pipeline_stage":
      await UpdateTicketService({
        ticketId,
        ticketData: {
          kanbanStageId: Number(payload.kanbanStageId)
        }
      });
      break;
    case "assign_pipeline":
      await UpdateTicketService({
        ticketId,
        ticketData: {
          pipelineId: Number(payload.pipelineId)
        }
      });
      break;
    case "add_contact_to_pipeline":
      await UpsertContactPipelineMembershipService({
        contactId: ticket.contactId,
        pipelineId: payload.pipelineId ? Number(payload.pipelineId) : null,
        kanbanStageId: payload.kanbanStageId ? Number(payload.kanbanStageId) : null
      });
      break;
    case "move_contact_pipeline_stage":
      await UpsertContactPipelineMembershipService({
        contactId: ticket.contactId,
        pipelineId: payload.pipelineId ? Number(payload.pipelineId) : null,
        kanbanStageId: payload.kanbanStageId ? Number(payload.kanbanStageId) : null
      });
      break;
    case "remove_contact_from_pipeline":
      if (payload.pipelineId) {
        await RemoveContactPipelineMembershipService({
          contactId: ticket.contactId,
          pipelineId: Number(payload.pipelineId)
        });
      }
      break;
    case "resolve_ticket":
      await UpdateTicketService({
        ticketId,
        ticketData: {
          status: "closed"
        }
      });
      break;
    case "stop_automations":
      await UpdateTicketService({
        ticketId,
        ticketData: {
          flowsPaused: true
        } as any
      });
      break;
    default:
      break;
  }
};

export const startFlowExecution = async (
  flowId: number,
  ticketId: number,
  context: FlowContext
) => {
  const ticket = await ShowTicketService(ticketId);

  if ((ticket as any).flowsPaused) {
    return null;
  }

  const flow = await Flow.findByPk(flowId);
  if (!flow || !flow.active) {
    return null;
  }
  const { nodes, edges } = buildFlowGraph(flow);
  const orderedNodeIds = getOrderedNodeIdsFromGraph(nodes, edges, context);
  const nodeMap = new Map(nodes.map(node => [String(node.id), node]));

  const execution = await FlowExecution.create({
    flowId,
    ticketId,
    triggerType: context.triggerType,
    context,
    status: "running"
  });

  try {
    for (const nodeId of orderedNodeIds) {
      const node = nodeMap.get(String(nodeId));
      if (!node || !node.type) {
        continue;
      }

      const latestTicket = await ShowTicketService(ticketId);
      if ((latestTicket as any).flowsPaused) {
        await execution.update({ status: "stopped" });
        return execution;
      }

      if (node.lane === "trigger") {
        continue;
      }

      if (node.lane === "condition") {
        const valid = await evaluateCondition(latestTicket, {
          type: node.type,
          payload: node.payload || {}
        });

        if (!valid) {
          await execution.update({ status: "skipped" });
          return execution;
        }

        continue;
      }

      if (node.lane === "action") {
        await executeAction(
          ticketId,
          {
            type: node.type,
            payload: node.payload || {}
          },
          context
        );
      }
    }

    await execution.update({ status: "completed" });
    return execution;
  } catch (error) {
    await execution.update({
      status: "failed",
      errorMessage: error?.message || String(error)
    });
    return execution;
  }
};

export const findMatchingFlows = async (triggerType: string) => {
  const flows = await Flow.findAll({ where: { active: true } });
  return flows.filter(flow =>
    parseJsonField((flow as any).triggers, []).some((trigger: any) => trigger?.type === triggerType)
  );
};

export const findFlowsForContext = async (triggerType: string, meta: any = {}) => {
  const flows = await findMatchingFlows(triggerType);

  return flows.filter(flow =>
    parseJsonField((flow as any).triggers, []).some((trigger: any) =>
      triggerMatchesContext(trigger, triggerType, meta)
    )
  );
};
