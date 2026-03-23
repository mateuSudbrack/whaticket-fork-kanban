import { Op } from "sequelize";

jest.mock("../../../services/TicketServices/ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: {
    findAll: jest.fn()
  }
}));

jest.mock("../../../models/Message", () => ({
  __esModule: true,
  default: {
    findAndCountAll: jest.fn()
  }
}));

import ShowTicketService from "../../../services/TicketServices/ShowTicketService";
import Ticket from "../../../models/Ticket";
import Message from "../../../models/Message";
import ListMessagesService from "../../../services/MessageServices/ListMessagesService";

describe("ListMessagesService", () => {
  it("should combine messages from related tickets for the same contact", async () => {
    const ticket = {
      id: 12,
      contactId: 32,
      whatsappId: 1,
      isGroup: false
    };

    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    ((Ticket as unknown) as { findAll: jest.Mock }).findAll.mockResolvedValue([
      { id: 7 },
      { id: 12 }
    ]);
    ((Message as unknown) as {
      findAndCountAll: jest.Mock;
    }).findAndCountAll.mockResolvedValue({
      count: 2,
      rows: [{ id: "newer-message" }, { id: "older-message" }]
    });

    const result = await ListMessagesService({
      ticketId: String(ticket.id)
    });

    expect(((Ticket as unknown) as { findAll: jest.Mock }).findAll).toHaveBeenCalledWith({
      attributes: ["id"],
      where: {
        contactId: ticket.contactId,
        whatsappId: ticket.whatsappId,
        isGroup: ticket.isGroup
      }
    });
    expect(
      ((Message as unknown) as { findAndCountAll: jest.Mock }).findAndCountAll
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ticketId: {
            [Op.in]: [7, 12]
          }
        }
      })
    );
    expect(result.ticket).toBe(ticket);
    expect(result.count).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.messages).toEqual([
      { id: "older-message" },
      { id: "newer-message" }
    ]);
  });

  it("should fall back to the current ticket when no related tickets are found", async () => {
    const ticket = {
      id: 18,
      contactId: 113,
      whatsappId: 1,
      isGroup: false
    };

    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    ((Ticket as unknown) as { findAll: jest.Mock }).findAll.mockResolvedValue([]);
    ((Message as unknown) as {
      findAndCountAll: jest.Mock;
    }).findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{ id: "single-message" }]
    });

    await ListMessagesService({
      ticketId: String(ticket.id)
    });

    expect(
      ((Message as unknown) as { findAndCountAll: jest.Mock }).findAndCountAll
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          ticketId: {
            [Op.in]: [ticket.id]
          }
        }
      })
    );
  });
});
