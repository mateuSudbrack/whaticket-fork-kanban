import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import KanbanPipeline from "../../models/KanbanPipeline";
import KanbanStage from "../../models/KanbanStage";

const ShowContactService = async (id: string | number): Promise<Contact> => {
  const contact = await Contact.findByPk(id, {
    include: [
      {
        association: "extraInfo",
        include: ["fieldDefinition"]
      },
      {
        association: "tags"
      },
      {
        association: "pipelineMemberships",
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
          }
        ]
      }
    ]
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  return contact;
};

export default ShowContactService;
