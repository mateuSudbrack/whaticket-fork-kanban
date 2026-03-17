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

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const [stages, setStages] = useState([]);
  const [tickets, setTickets] = useState([]);

  const loadBoard = async () => {
    try {
      const [{ data: stagesData }, { data: ticketsData }] = await Promise.all([
        api.get("/kanban-stages"),
        api.get("/tickets", {
          params: {
            showAll: true,
            queueIds: JSON.stringify([])
          }
        })
      ]);

      setStages(stagesData);
      setTickets(ticketsData.tickets);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadBoard();

    const socket = openSocket();
    socket.on("ticket", loadBoard);
    socket.on("appMessage", loadBoard);
    socket.on("contact", loadBoard);

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleDrop = async (event, stageId) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("ticketId");
    const ticketUserId = event.dataTransfer.getData("ticketUserId");

    if (!ticketId) {
      return;
    }

    try {
      await api.put(`/tickets/${ticketId}`, {
        userId: ticketUserId ? Number(ticketUserId) : null,
        kanbanStageId: Number(stageId)
      });
      loadBoard();
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
        {stages.map(stage => {
          const stageTickets = tickets.filter(
            ticket => ticket.kanbanStageId === stage.id
          );

          return (
            <Grid item xs={12} md={4} key={stage.id}>
              <Paper
                className={classes.column}
                onDragOver={event => event.preventDefault()}
                onDrop={event => handleDrop(event, stage.id)}
              >
                <Typography variant="h6">
                  {stage.name} ({stageTickets.length})
                </Typography>
                <div className={classes.columnBody}>
                  {stageTickets.map(ticket => (
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
                          {ticket.status && (
                            <Chip
                              size="small"
                              label={ticket.status}
                              style={{
                                backgroundColor: stage.color,
                                color: "#fff"
                              }}
                            />
                          )}
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
          );
        })}
      </Grid>
    </MainContainer>
  );
};

export default Kanban;
