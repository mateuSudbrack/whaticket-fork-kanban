import fs from "fs";
import path from "path";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import { whatsappProvider, ProviderMessage } from "../../providers/WhatsApp";
import NormalizeContactNumber from "../../helpers/NormalizeContactNumber";
import CreateMessageService from "../MessageServices/CreateMessageService";

import formatBody from "../../helpers/Mustache";
import uploadConfig from "../../config/upload";

interface Request {
  media: Express.Multer.File;
  ticket: Ticket;
  body?: string;
}

const SendWhatsAppMedia = async ({
  media,
  ticket,
  body
}: Request): Promise<ProviderMessage> => {
  try {
    if (!ticket.whatsappId) {
      throw new AppError("ERR_TICKET_NO_WHATSAPP");
    }

    const contactNumber = ticket.isGroup
      ? ticket.contact.number
      : NormalizeContactNumber(ticket.contact.number);
    const chatId = `${contactNumber}@${ticket.isGroup ? "g" : "c"}.us`;

    const hasBody = body
      ? formatBody(body as string, ticket.contact)
      : undefined;

    const mediaInput = {
      filename: media.filename,
      mimetype: media.mimetype,
      path: media.path
    };

    const publicFolder = uploadConfig.directory;
    const isInPublicFolder = path.dirname(media.path) === publicFolder;
    const extension = path.extname(media.filename || media.originalname || "");
    const persistedFilename =
      isInPublicFolder
        ? media.filename
        : `${new Date().getTime()}${extension}`;
    const persistedPath = path.join(publicFolder, persistedFilename);

    if (!isInPublicFolder) {
      fs.copyFileSync(media.path, persistedPath);
    }

    const mediaOptions = {
      caption: hasBody,
      sendAudioAsVoice: true,
      sendMediaAsDocument:
        media.mimetype.startsWith("image/") &&
        !/^.*\.(jpe?g|png|gif)?$/i.exec(media.filename)
    };

    const sentMessage = await whatsappProvider.sendMedia(
      ticket.whatsappId,
      chatId,
      mediaInput,
      mediaOptions
    );

    await ticket.update({ lastMessage: body || media.filename });
    await CreateMessageService({
      messageData: {
        id: sentMessage.id,
        ticketId: ticket.id,
        contactId: ticket.contactId,
        body: body || media.filename,
        fromMe: true,
        read: true,
        mediaUrl: persistedFilename,
        mediaType: media.mimetype.split("/")[0] || "media",
        ack: sentMessage.ack || 1
      }
    });

    if (!isInPublicFolder && fs.existsSync(media.path)) {
      fs.unlinkSync(media.path);
    }

    return sentMessage;
  } catch (err) {
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMedia;
