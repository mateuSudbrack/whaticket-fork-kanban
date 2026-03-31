import {
  Table,
  Column,
  CreatedAt,
  UpdatedAt,
  Model,
  PrimaryKey,
  AutoIncrement,
  AllowNull,
  Default,
  HasMany,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Ticket from "./Ticket";
import KanbanPipeline from "./KanbanPipeline";
import ContactPipelineMembership from "./ContactPipelineMembership";

@Table
class KanbanStage extends Model<KanbanStage> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Default("#1976d2")
  @Column
  color: string;

  @AllowNull(false)
  @Default(0)
  @Column
  sortOrder: number;

  @AllowNull(false)
  @Default(true)
  @Column
  active: boolean;

  @ForeignKey(() => KanbanPipeline)
  @AllowNull(false)
  @Column
  pipelineId: number;

  @BelongsTo(() => KanbanPipeline)
  pipeline: KanbanPipeline;

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @HasMany(() => ContactPipelineMembership)
  contactMemberships: ContactPipelineMembership[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default KanbanStage;
