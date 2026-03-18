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
  DataType
} from "sequelize-typescript";

@Table
class Flow extends Model<Flow> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @Default("")
  @Column(DataType.TEXT)
  description: string;

  @AllowNull(false)
  @Default(true)
  @Column
  active: boolean;

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSON)
  triggers: any[];

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSON)
  conditions: any[];

  @AllowNull(false)
  @Default([])
  @Column(DataType.JSON)
  actions: any[];

  @AllowNull(false)
  @Default({})
  @Column(DataType.JSON)
  layout: any;

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Flow;
