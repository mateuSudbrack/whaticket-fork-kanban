import React from "react";
import {
  Avatar,
  Button,
  Chip,
  Typography,
  makeStyles
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import TagEditorDialog from "../TagEditorDialog";

const useStyles = makeStyles(theme => ({
  root: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 1),
    minWidth: 0
  },
  clickable: {
    cursor: "pointer"
  },
  info: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(0.5)
  },
  title: {
    fontWeight: 600
  },
  subtitle: {
    color: theme.palette.text.secondary
  },
  tags: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap"
  }
}));

const TicketInfo = ({ contact, ticket, onClick, onUpdateTicket }) => {
  const classes = useStyles();

  return (
    <div className={classes.root}>
      <Avatar
        src={contact.profilePicUrl}
        alt="contact_image"
        className={classes.clickable}
        onClick={onClick}
      />
      <div className={classes.info}>
        <Typography
          noWrap
          variant="body1"
          className={`${classes.title} ${classes.clickable}`}
          onClick={onClick}
        >
          {contact.name} #{ticket.id}
        </Typography>
        {ticket.user && (
          <Typography noWrap variant="body2" className={classes.subtitle}>
            {`${i18n.t("messagesList.header.assignedTo")} ${ticket.user.name}`}
          </Typography>
        )}
        <div className={classes.tags}>
          {(ticket.tags || []).map(tag => (
            <Chip
              key={tag.id}
              size="small"
              label={tag.name}
              style={{ backgroundColor: tag.color, color: "#fff" }}
            />
          ))}
          <TagEditorDialog
            entity={ticket}
            entityType="tickets"
            title={`Etiquetas da conversa #${ticket.id}`}
            onUpdated={updatedTicket => {
              if (onUpdateTicket) {
                onUpdateTicket(updatedTicket);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TicketInfo;
