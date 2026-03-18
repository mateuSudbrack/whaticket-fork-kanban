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
  DataType,
  ForeignKey,
  BelongsTo
} from "sequelize-typescript";
import Flow from "./Flow";
import Ticket from "./Ticket";

@Table
class FlowExecution extends Model<FlowExecution> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @ForeignKey(() => Flow)
  @AllowNull(false)
  @Column
  flowId: number;

  @BelongsTo(() => Flow)
  flow: Flow;

  @ForeignKey(() => Ticket)
  @AllowNull(false)
  @Column
  ticketId: number;

  @BelongsTo(() => Ticket)
  ticket: Ticket;

  @Default("pending")
  @Column
  status: string;

  @Default("manual")
  @Column
  triggerType: string;

  @Default({})
  @Column(DataType.JSON)
  context: any;

  @Column(DataType.TEXT)
  errorMessage: string;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default FlowExecution;
