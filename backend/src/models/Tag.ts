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
  BelongsToMany
} from "sequelize-typescript";
import Contact from "./Contact";
import ContactTag from "./ContactTag";
import Ticket from "./Ticket";
import TicketTag from "./TicketTag";

@Table
class Tag extends Model<Tag> {
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
  @Default(true)
  @Column
  active: boolean;

  @BelongsToMany(() => Contact, () => ContactTag)
  contacts: Contact[];

  @BelongsToMany(() => Ticket, () => TicketTag)
  tickets: Ticket[];

  @CreatedAt
  createdAt: Date;

  @UpdatedAt
  updatedAt: Date;
}

export default Tag;
