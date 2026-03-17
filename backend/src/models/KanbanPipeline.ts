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
  HasMany
} from "sequelize-typescript";
import KanbanStage from "./KanbanStage";
import Ticket from "./Ticket";

@Table
class KanbanPipeline extends Model<KanbanPipeline> {
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

  @HasMany(() => KanbanStage)
  stages: KanbanStage[];

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default KanbanPipeline;
