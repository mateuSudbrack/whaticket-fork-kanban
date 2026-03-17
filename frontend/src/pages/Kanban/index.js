import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Chip,
  Grid,
  Paper,
  Tab,
  Tabs,
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
  pipelineTabs: {
    marginBottom: theme.spacing(2)
  },
  boardScroller: {
    overflowX: "auto",
    paddingBottom: theme.spacing(1)
  },
  boardRow: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(320px, 1fr)",
    gap: theme.spacing(2),
    alignItems: "start"
  },
  column: {
    background: theme.palette.background.paper,
    borderRadius: 8,
    padding: theme.spacing(2),
    minHeight: "calc(100vh - 240px)",
    display: "flex",
    flexDirection: "column",
    border: "1px solid rgba(0, 0, 0, 0.08)"
  },
  columnBody: {
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1),
    paddingTop: theme.spacing(1),
    maxHeight: "calc(100vh - 320px)",
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
  },
  emptyState: {
    color: theme.palette.text.secondary,
    textAlign: "center",
    padding: theme.spacing(4, 2)
  }
}));

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [tickets, setTickets] = useState([]);

  const loadBoard = async pipelineId => {
    try {
      const [{ data: pipelinesData }, { data: ticketsData }] = await Promise.all([
        api.get("/kanban-pipelines"),
        api.get("/tickets", {
          params: {
            showAll: true,
            queueIds: JSON.stringify([]),
            ...(pipelineId ? { pipelineId } : {})
          }
        })
      ]);

      setPipelines(pipelinesData);

      if (!selectedPipelineId && pipelinesData.length) {
        setSelectedPipelineId(String(pipelinesData[0].id));
      }

      setTickets(ticketsData.tickets);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadBoard(selectedPipelineId);
  }, [selectedPipelineId]);

  useEffect(() => {
    const socket = openSocket();
    const reload = () => loadBoard(selectedPipelineId);

    socket.on("ticket", reload);
    socket.on("appMessage", reload);
    socket.on("contact", reload);

    return () => {
      socket.disconnect();
    };
  }, [selectedPipelineId]);

  const selectedPipeline = useMemo(
    () => pipelines.find(item => String(item.id) === String(selectedPipelineId)),
    [pipelines, selectedPipelineId]
  );

  const handleDrop = async (event, stage) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData("ticketId");
    const ticketUserId = event.dataTransfer.getData("ticketUserId");

    if (!ticketId) {
      return;
    }

    try {
      await api.put(`/tickets/${ticketId}`, {
        userId: ticketUserId ? Number(ticketUserId) : null,
        pipelineId: stage.pipelineId,
        kanbanStageId: stage.id
      });
      loadBoard(selectedPipelineId);
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Kanban de Pipelines</Title>
      </MainHeader>

      <Paper className={classes.pipelineTabs}>
        <Tabs
          value={selectedPipelineId}
          onChange={(_, value) => setSelectedPipelineId(String(value))}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
        >
          {pipelines.map(pipeline => (
            <Tab
              key={pipeline.id}
              value={String(pipeline.id)}
              label={pipeline.name}
            />
          ))}
        </Tabs>
      </Paper>

      <div className={classes.boardScroller}>
        <div className={classes.boardRow}>
          {(selectedPipeline?.stages || []).map(stage => {
            const stageTickets = tickets.filter(
              ticket => ticket.kanbanStageId === stage.id
            );

            return (
              <Paper
                key={stage.id}
                className={classes.column}
                onDragOver={event => event.preventDefault()}
                onDrop={event => handleDrop(event, stage)}
              >
                <Typography variant="h6">
                  {stage.name} ({stageTickets.length})
                </Typography>
                <div className={classes.columnBody}>
                  {stageTickets.length === 0 ? (
                    <div className={classes.emptyState}>Nenhuma conversa nesta etapa.</div>
                  ) : (
                    stageTickets.map(ticket => (
                      <Card
                        key={ticket.id}
                        className={classes.ticketCard}
                        draggable
                        onDragStart={event => {
                          event.dataTransfer.setData("ticketId", String(ticket.id));
                          event.dataTransfer.setData(
                            "ticketUserId",
                            ticket.userId ? String(ticket.userId) : ""
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
                            {ticket.status && <Chip size="small" label={ticket.status} />}
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
                    ))
                  )}
                </div>
              </Paper>
            );
          })}
        </div>
      </div>
    </MainContainer>
  );
};

export default Kanban;
