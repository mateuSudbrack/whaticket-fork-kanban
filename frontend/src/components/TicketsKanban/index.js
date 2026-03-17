import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Typography,
  makeStyles
} from "@material-ui/core";
import { useHistory } from "react-router-dom";
import openSocket from "../../services/socket-io";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  board: {
    height: "100%",
    padding: theme.spacing(1),
    backgroundColor: theme.palette.background.default
  },
  column: {
    background: theme.palette.background.paper,
    borderRadius: 8,
    padding: theme.spacing(2),
    minHeight: "100%",
    display: "flex",
    flexDirection: "column",
    border: "1px solid rgba(0, 0, 0, 0.08)"
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing(1)
  },
  columnBody: {
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1),
    minHeight: 320,
    ...theme.scrollbarStyles
  },
  ticketCard: {
    cursor: "grab",
    borderLeft: "4px solid transparent"
  },
  ticketMeta: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(1)
  },
  lastMessage: {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden"
  },
  emptyState: {
    textAlign: "center",
    color: theme.palette.text.secondary,
    padding: theme.spacing(4, 2)
  }
}));

const columns = [
  {
    id: "pending",
    title: "Aguardando",
    color: "#f57c00"
  },
  {
    id: "open",
    title: "Em atendimento",
    color: "#1976d2"
  },
  {
    id: "closed",
    title: "Resolvido",
    color: "#2e7d32"
  }
];

const TicketsKanban = ({ selectedQueueIds, showAll }) => {
  const classes = useStyles();
  const history = useHistory();
  const [tickets, setTickets] = useState([]);

  const loadBoard = async () => {
    try {
      const { data } = await api.get("/tickets", {
        params: {
          showAll: true,
          queueIds: JSON.stringify(selectedQueueIds || [])
        }
      });

      setTickets(data.tickets);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [showAll, selectedQueueIds]);

  useEffect(() => {
    const socket = openSocket();
    socket.on("ticket", loadBoard);
    socket.on("appMessage", loadBoard);
    socket.on("contact", loadBoard);

    return () => {
      socket.disconnect();
    };
  }, [selectedQueueIds, showAll]);

  const ticketsByColumn = useMemo(() => {
    return columns.reduce((accumulator, column) => {
      accumulator[column.id] = tickets.filter(ticket => ticket.status === column.id);
      return accumulator;
    }, {});
  }, [tickets]);

  const handleDrop = async (event, status) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("ticketId");
    const ticketUserId = event.dataTransfer.getData("ticketUserId");
    const ticketQueueId = event.dataTransfer.getData("ticketQueueId");

    if (!ticketId) {
      return;
    }

    try {
      await api.put(`/tickets/${ticketId}`, {
        status,
        userId: ticketUserId ? Number(ticketUserId) : null,
        queueId: ticketQueueId ? Number(ticketQueueId) : null
      });
      loadBoard();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Grid container spacing={2} className={classes.board}>
      {columns.map(column => {
        const columnTickets = ticketsByColumn[column.id] || [];

        return (
          <Grid item xs={12} md={4} key={column.id}>
            <Paper
              className={classes.column}
              onDragOver={event => event.preventDefault()}
              onDrop={event => handleDrop(event, column.id)}
            >
              <div className={classes.columnHeader}>
                <Typography variant="h6">{column.title}</Typography>
                <Chip
                  size="small"
                  label={columnTickets.length}
                  style={{
                    backgroundColor: column.color,
                    color: "#fff"
                  }}
                />
              </div>
              <div className={classes.columnBody}>
                {columnTickets.length === 0 ? (
                  <div className={classes.emptyState}>Nenhuma conversa aqui.</div>
                ) : (
                  columnTickets.map(ticket => (
                    <Card
                      key={ticket.id}
                      className={classes.ticketCard}
                      style={{ borderLeftColor: column.color }}
                      draggable
                      onDragStart={event => {
                        event.dataTransfer.setData("ticketId", String(ticket.id));
                        event.dataTransfer.setData(
                          "ticketUserId",
                          ticket.userId ? String(ticket.userId) : ""
                        );
                        event.dataTransfer.setData(
                          "ticketQueueId",
                          ticket.queueId ? String(ticket.queueId) : ""
                        );
                      }}
                      onClick={() => history.push(`/tickets/${ticket.id}`)}
                    >
                      <CardContent>
                        <Typography variant="subtitle1">
                          {ticket.contact?.name || `Ticket #${ticket.id}`}
                        </Typography>
                        <Typography
                          variant="body2"
                          color="textSecondary"
                          className={classes.lastMessage}
                        >
                          {ticket.lastMessage || "Sem ultima mensagem"}
                        </Typography>
                        <div className={classes.ticketMeta}>
                          {(ticket.tags || []).map(tag => (
                            <Chip
                              key={tag.id}
                              size="small"
                              label={tag.name}
                              style={{ backgroundColor: tag.color, color: "#fff" }}
                            />
                          ))}
                          {ticket.queue?.name && (
                            <Chip size="small" label={ticket.queue.name} />
                          )}
                          {ticket.whatsapp?.name && (
                            <Chip
                              size="small"
                              label={ticket.whatsapp.name}
                              variant="outlined"
                            />
                          )}
                          {ticket.unreadMessages > 0 && (
                            <Chip
                              size="small"
                              color="secondary"
                              label={`${ticket.unreadMessages} novas`}
                            />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </Paper>
          </Grid>
        );
      })}
    </Grid>
  );
};

export default TicketsKanban;
