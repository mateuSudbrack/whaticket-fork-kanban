import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import ContactFieldDefinition from "../models/ContactFieldDefinition";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import QuickAnswer from "../models/QuickAnswer";
import WppKey from "../models/WppKey";
import KanbanPipeline from "../models/KanbanPipeline";
import KanbanStage from "../models/KanbanStage";
import Tag from "../models/Tag";
import ContactTag from "../models/ContactTag";
import TicketTag from "../models/TicketTag";

// eslint-disable-next-line
const dbConfig = require("../config/database");
// import dbConfig from "../config/database";

const sequelize = new Sequelize(dbConfig);

const models = [
  User,
  Contact,
  ContactFieldDefinition,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  KanbanPipeline,
  KanbanStage,
  Tag,
  ContactTag,
  TicketTag,
  WhatsappQueue,
  UserQueue,
  QuickAnswer,
  WppKey
];

sequelize.addModels(models);

export default sequelize;
