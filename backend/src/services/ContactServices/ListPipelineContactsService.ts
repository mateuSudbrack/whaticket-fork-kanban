import ContactPipelineMembership from "../../models/ContactPipelineMembership";
import KanbanPipeline from "../../models/KanbanPipeline";
import KanbanStage from "../../models/KanbanStage";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";

type Request = {
  pipelineId: number | string;
};

const ListPipelineContactsService = async ({
  pipelineId
}: Request): Promise<ContactPipelineMembership[]> => {
  return ContactPipelineMembership.findAll({
    where: {
      pipelineId: Number(pipelineId)
    },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"],
        include: [
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"],
            through: { attributes: [] }
          }
        ]
      },
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
    ],
    order: [
      [{ model: KanbanStage, as: "kanbanStage" }, "sortOrder", "ASC"],
      [{ model: Contact, as: "contact" }, "name", "ASC"]
    ]
  });
};

export default ListPipelineContactsService;
