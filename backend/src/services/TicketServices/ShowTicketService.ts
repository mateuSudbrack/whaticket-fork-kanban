import Ticket from "../../models/Ticket";
import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import KanbanStage from "../../models/KanbanStage";
import KanbanPipeline from "../../models/KanbanPipeline";
import Tag from "../../models/Tag";
import ContactPipelineMembership from "../../models/ContactPipelineMembership";

const ShowTicketService = async (id: string | number): Promise<Ticket> => {
  const ticket = await Ticket.findByPk(id, {
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "profilePicUrl"],
        include: [
          "extraInfo",
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"],
            through: { attributes: [] }
          },
          {
            model: ContactPipelineMembership,
            as: "pipelineMemberships",
            include: [
              {
                model: KanbanPipeline,
                as: "pipeline",
                attributes: ["id", "name", "color", "sortOrder"]
              },
              {
                model: KanbanStage,
                as: "kanbanStage",
                attributes: ["id", "name", "color", "sortOrder", "pipelineId"]
              }
            ]
          }
        ]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["name"]
      },
      {
        model: KanbanPipeline,
        as: "pipeline",
        attributes: ["id", "name", "color", "sortOrder"]
      },
      {
        model: KanbanStage,
        as: "kanbanStage",
        attributes: ["id", "name", "color", "sortOrder"]
      },
      {
        model: Tag,
        as: "tags",
        attributes: ["id", "name", "color"],
        through: { attributes: [] }
      }
    ]
  });

  if (!ticket) {
    throw new AppError("ERR_NO_TICKET_FOUND", 404);
  }

  return ticket;
};

export default ShowTicketService;
