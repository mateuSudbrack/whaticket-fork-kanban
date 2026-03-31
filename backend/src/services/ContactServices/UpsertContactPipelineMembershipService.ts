import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactPipelineMembership from "../../models/ContactPipelineMembership";
import KanbanPipeline from "../../models/KanbanPipeline";
import KanbanStage from "../../models/KanbanStage";

type Request = {
  contactId: number | string;
  pipelineId?: number | string | null;
  kanbanStageId?: number | string | null;
};

const isPrincipalPipeline = (pipeline?: KanbanPipeline | null) =>
  String(pipeline?.name || "").trim().toLowerCase() === "pipeline principal";

const UpsertContactPipelineMembershipService = async ({
  contactId,
  pipelineId,
  kanbanStageId
}: Request): Promise<ContactPipelineMembership> => {
  const contact = await Contact.findByPk(contactId);
  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  let resolvedPipeline: KanbanPipeline | null = null;
  let resolvedStage: KanbanStage | null = null;

  if (kanbanStageId) {
    resolvedStage = await KanbanStage.findByPk(Number(kanbanStageId), {
      include: [{ model: KanbanPipeline, as: "pipeline" }]
    });

    if (!resolvedStage) {
      throw new AppError("ERR_NO_KANBAN_STAGE_FOUND", 404);
    }

    resolvedPipeline =
      (resolvedStage.pipeline as KanbanPipeline) ||
      (await KanbanPipeline.findByPk(resolvedStage.pipelineId));
  } else if (pipelineId) {
    resolvedPipeline = await KanbanPipeline.findByPk(Number(pipelineId));
  }

  if (!resolvedPipeline) {
    throw new AppError("ERR_NO_KANBAN_PIPELINE_FOUND", 404);
  }

  if (isPrincipalPipeline(resolvedPipeline)) {
    throw new AppError("ERR_CONTACT_PIPELINE_PRINCIPAL_NOT_ALLOWED", 400);
  }

  if (!resolvedStage) {
    resolvedStage = await KanbanStage.findOne({
      where: {
        pipelineId: resolvedPipeline.id,
        active: true
      },
      order: [["sortOrder", "ASC"], ["id", "ASC"]]
    });
  }

  if (!resolvedStage) {
    throw new AppError("ERR_NO_KANBAN_STAGE_FOUND", 404);
  }

  if (Number(resolvedStage.pipelineId) !== Number(resolvedPipeline.id)) {
    throw new AppError("ERR_KANBAN_STAGE_PIPELINE_MISMATCH", 400);
  }

  const [membership] = await ContactPipelineMembership.findOrCreate({
    where: {
      contactId: Number(contactId),
      pipelineId: Number(resolvedPipeline.id)
    },
    defaults: {
      contactId: Number(contactId),
      pipelineId: Number(resolvedPipeline.id),
      kanbanStageId: Number(resolvedStage.id)
    }
  });

  await membership.update({
    kanbanStageId: Number(resolvedStage.id)
  });

  const hydratedMembership = await ContactPipelineMembership.findByPk(membership.id, {
    include: [
      { model: Contact, as: "contact", attributes: ["id", "name", "number", "profilePicUrl"] },
      { model: KanbanPipeline, as: "pipeline", attributes: ["id", "name", "color", "sortOrder", "active"] },
      { model: KanbanStage, as: "kanbanStage", attributes: ["id", "name", "color", "sortOrder", "active", "pipelineId"] }
    ]
  });

  if (!hydratedMembership) {
    throw new AppError("ERR_CONTACT_PIPELINE_MEMBERSHIP_NOT_FOUND", 404);
  }

  return hydratedMembership;
};

export default UpsertContactPipelineMembershipService;
