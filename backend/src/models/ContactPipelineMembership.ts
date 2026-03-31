import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  ForeignKey,
  BelongsTo,
} from "sequelize-typescript";
import Contact from "./Contact";
import KanbanPipeline from "./KanbanPipeline";
import KanbanStage from "./KanbanStage";

@Table({
  indexes: [
    {
      unique: true,
      fields: ["contactId", "pipelineId"],
    },
  ],
})
class ContactPipelineMembership extends Model<ContactPipelineMembership> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Contact)
  @AllowNull(false)
  @Column
  contactId: number;

  @BelongsTo(() => Contact)
  contact: Contact;

  @ForeignKey(() => KanbanPipeline)
  @AllowNull(false)
  @Column
  pipelineId: number;

  @BelongsTo(() => KanbanPipeline)
  pipeline: KanbanPipeline;

  @ForeignKey(() => KanbanStage)
  @AllowNull(false)
  @Column
  kanbanStageId: number;

  @BelongsTo(() => KanbanStage)
  kanbanStage: KanbanStage;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactPipelineMembership;
