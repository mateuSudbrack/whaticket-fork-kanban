import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  HasMany,
  AutoIncrement,
  Default
  ,
  BelongsToMany
} from "sequelize-typescript";

import Contact from "./Contact";
import Message from "./Message";
import Queue from "./Queue";
import User from "./User";
import Whatsapp from "./Whatsapp";
import KanbanStage from "./KanbanStage";
import KanbanPipeline from "./KanbanPipeline";
import Tag from "./Tag";
import TicketTag from "./TicketTag";

@Table
class Ticket extends Model<Ticket> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @Column({ defaultValue: "pending" })
  status: string;

  @Column
  unreadMessages: number;

  @Column
  lastMessage: string;

  @Default(false)
  @Column
  isGroup: boolean;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;

  @ForeignKey(() => User)
  @Column
  userId: number;

  @BelongsTo(() => User)
  user: User;

  @ForeignKey(() => Contact)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => Whatsapp)
  @Column
  whatsappId: number;

  @BelongsTo(() => Whatsapp)
  whatsapp: Whatsapp;

  @ForeignKey(() => Queue)
  @Column
  queueId: number;

  @BelongsTo(() => Queue)
  queue: Queue;

  @ForeignKey(() => KanbanStage)
  @Column
  kanbanStageId: number;

  @BelongsTo(() => KanbanStage)
  kanbanStage: KanbanStage;

  @ForeignKey(() => KanbanPipeline)
  @Column
  pipelineId: number;

  @BelongsTo(() => KanbanPipeline)
  pipeline: KanbanPipeline;

  @HasMany(() => Message)
  messages: Message[];

  @BelongsToMany(() => Tag, () => TicketTag)
  tags: Tag[];
}

export default Ticket;
