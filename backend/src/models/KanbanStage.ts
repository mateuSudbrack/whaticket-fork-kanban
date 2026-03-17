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
import Ticket from "./Ticket";

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

  @HasMany(() => Ticket)
  tickets: Ticket[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default KanbanStage;
