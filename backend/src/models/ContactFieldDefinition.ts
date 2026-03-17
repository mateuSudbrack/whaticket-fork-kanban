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
import ContactCustomField from "./ContactCustomField";

@Table
class ContactFieldDefinition extends Model<ContactFieldDefinition> {
  @PrimaryKey
  @AutoIncrement
  @Column
  id: number;

  @AllowNull(false)
  @Column
  name: string;

  @AllowNull(false)
  @Default("text")
  @Column
  type: string;

  @AllowNull(false)
  @Default(false)
  @Column
  required: boolean;

  @AllowNull(false)
  @Default(true)
  @Column
  active: boolean;

  @AllowNull(false)
  @Default(0)
  @Column
  sortOrder: number;

  @Column
  options: string;

  @HasMany(() => ContactCustomField)
  values: ContactCustomField[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default ContactFieldDefinition;
