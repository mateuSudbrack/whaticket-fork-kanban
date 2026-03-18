import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";
import NormalizeContactNumber from "../../helpers/NormalizeContactNumber";
import CreateMessageService from "../MessageServices/CreateMessageService";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<ProviderMessage> => {
  if (!ticket.whatsappId) {
    throw new AppError("ERR_TICKET_NO_WHATSAPP");
  }

  const contactNumber = ticket.isGroup
    ? ticket.contact.number
    : NormalizeContactNumber(ticket.contact.number);
  const chatId = `${contactNumber}@${ticket.isGroup ? "g" : "c"}.us`;

  try {
    const sentMessage = await whatsappProvider.sendMessage(
      ticket.whatsappId,
      chatId,
      formatBody(body, ticket.contact),
      {
        quotedMessageId: quotedMsg?.id,
        quotedMessageFromMe: quotedMsg?.fromMe,
        linkPreview: false
      }
    );

    await ticket.update({ lastMessage: body });
    await CreateMessageService({
      messageData: {
        id: sentMessage.id,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        body,
        fromMe: true,
        read: true,
        mediaType: "chat",
        quotedMsgId: quotedMsg?.id,
        ack: sentMessage.ack || 1
      }
    });
    return sentMessage;
  } catch (err) {
    logger.error({
      info: "Error sending whatsapp text message",
      ticketId: ticket.id,
      whatsappId: ticket.whatsappId,
      contactNumber,
      chatId,
      err
    });
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
