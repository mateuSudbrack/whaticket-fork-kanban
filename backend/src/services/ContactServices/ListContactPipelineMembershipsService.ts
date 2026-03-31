import ContactPipelineMembership from "../../models/ContactPipelineMembership";
import KanbanPipeline from "../../models/KanbanPipeline";
import KanbanStage from "../../models/KanbanStage";
import Contact from "../../models/Contact";

const ListContactPipelineMembershipsService = async (
  contactId: string | number
): Promise<ContactPipelineMembership[]> => {
  return ContactPipelineMembership.findAll({
    where: { contactId },
    include: [
      {
        model: KanbanPipeline,
        as: "pipeline",
        attributes: ["id", "name", "color", "sortOrder", "active"]
      },
      {
        model: KanbanStage,
        as: "kanbanStage",
        attributes: ["id", "name", "color", "sortOrder", "active", "pipelineId"]
      },
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"]
      }
    ],
    order: [
      [{ model: KanbanPipeline, as: "pipeline" }, "sortOrder", "ASC"],
      [{ model: KanbanPipeline, as: "pipeline" }, "name", "ASC"]
    ]
  });
};

export default ListContactPipelineMembershipsService;
