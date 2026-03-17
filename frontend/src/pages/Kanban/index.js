import React, { useEffect, useState } from "react";
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
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  board: {
    height: "100%",
    overflow: "hidden"
  },
  column: {
    background: theme.palette.background.paper,
    borderRadius: 8,
    padding: theme.spacing(2),
    height: "calc(100vh - 180px)",
    display: "flex",
    flexDirection: "column"
  },
  columnBody: {
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1),
    ...theme.scrollbarStyles
  },
  ticketCard: {
    cursor: "grab"
  },
  ticketMeta: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(1)
  }
}));

const columns = [
  { id: "pending", title: "Pendentes" },
  { id: "open", title: "Em atendimento" },
  { id: "closed", title: "Fechados" }
];

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const [ticketsByStatus, setTicketsByStatus] = useState({
    pending: [],
    open: [],
    closed: []
  });

  const loadTickets = async () => {
    try {
      const responses = await Promise.all(
        columns.map(column =>
          api.get("/tickets", {
            params: {
              status: column.id,
              showAll: true,
              queueIds: JSON.stringify([])
            }
          })
        )
      );

      setTicketsByStatus({
        pending: responses[0].data.tickets,
        open: responses[1].data.tickets,
        closed: responses[2].data.tickets
      });
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadTickets();

    const socket = openSocket();
    socket.on("ticket", loadTickets);
    socket.on("appMessage", loadTickets);
    socket.on("contact", loadTickets);

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleDrop = async (event, status) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("ticketId");
    const ticketUserId = event.dataTransfer.getData("ticketUserId");

    if (!ticketId) {
      return;
    }

    try {
      await api.put(`/tickets/${ticketId}`, {
        status,
        userId: ticketUserId ? Number(ticketUserId) : null
      });
      loadTickets();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Kanban de Conversas</Title>
      </MainHeader>

      <Grid container spacing={2} className={classes.board}>
        {columns.map(column => (
          <Grid item xs={12} md={4} key={column.id}>
            <Paper
              className={classes.column}
              onDragOver={event => event.preventDefault()}
              onDrop={event => handleDrop(event, column.id)}
            >
              <Typography variant="h6">
                {column.title} ({ticketsByStatus[column.id]?.length || 0})
              </Typography>
              <div className={classes.columnBody}>
                {ticketsByStatus[column.id]?.map(ticket => (
                  <Card
                    key={ticket.id}
                    className={classes.ticketCard}
                    draggable
                    onDragStart={event => {
                      event.dataTransfer.setData("ticketId", ticket.id);
                      event.dataTransfer.setData(
                        "ticketUserId",
                        ticket.userId || ""
                      );
                    }}
                    onClick={() => history.push(`/tickets/${ticket.id}`)}
                  >
                    <CardContent>
                      <Typography variant="subtitle1">
                        {ticket.contact?.name || `Ticket #${ticket.id}`}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {ticket.lastMessage || "Sem ultima mensagem"}
                      </Typography>
                      <div className={classes.ticketMeta}>
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </MainContainer>
  );
};

export default Kanban;
