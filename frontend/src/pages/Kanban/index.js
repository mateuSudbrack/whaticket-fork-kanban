import React, { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Chip,
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

const hexToRgba = (hex, alpha) => {
  const normalized = String(hex || "#1976d2").replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized.split("").map(char => char + char).join("")
    : normalized.padEnd(6, "0").slice(0, 6);

  const red = parseInt(safeHex.slice(0, 2), 16);
  const green = parseInt(safeHex.slice(2, 4), 16);
  const blue = parseInt(safeHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const useStyles = makeStyles(theme => ({
  page: {
    background: `linear-gradient(180deg, ${hexToRgba("#dbeafe", 0.45)} 0%, ${theme.palette.background.default} 42%)`,
    borderRadius: 16,
    padding: theme.spacing(2)
  },
  intro: {
    marginBottom: theme.spacing(2),
    color: theme.palette.text.secondary
  },
  pipelineTabs: {
    marginBottom: theme.spacing(2)
  },
  tabsShell: {
    padding: theme.spacing(1),
    borderRadius: 16,
    border: `1px solid ${hexToRgba("#1d4ed8", 0.12)}`,
    background: `linear-gradient(135deg, ${hexToRgba("#ffffff", 0.96)} 0%, ${hexToRgba("#eff6ff", 0.94)} 100%)`,
    boxShadow: `0 18px 40px ${hexToRgba("#0f172a", 0.08)}`
  },
  boardScroller: {
    overflowX: "auto",
    paddingBottom: theme.spacing(1)
  },
  boardRow: {
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "minmax(340px, 1fr)",
    gap: theme.spacing(2.5),
    alignItems: "start"
  },
  column: {
    position: "relative",
    overflow: "hidden",
    background: `linear-gradient(180deg, ${hexToRgba("#ffffff", 0.98)} 0%, ${hexToRgba("#f8fafc", 0.98)} 100%)`,
    borderRadius: 18,
    padding: theme.spacing(2.5),
    minHeight: "calc(100vh - 240px)",
    display: "flex",
    flexDirection: "column",
    border: `1px solid ${hexToRgba("#0f172a", 0.08)}`,
    boxShadow: `0 20px 50px ${hexToRgba("#0f172a", 0.10)}`
  },
  columnAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6
  },
  columnHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5)
  },
  columnHeading: {
    minWidth: 0
  },
  columnTitle: {
    fontWeight: 700
  },
  columnSubtitle: {
    color: theme.palette.text.secondary
  },
  columnBody: {
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(1.25),
    paddingTop: theme.spacing(1),
    maxHeight: "calc(100vh - 320px)",
    ...theme.scrollbarStyles
  },
  ticketCard: {
    cursor: "grab",
    borderRadius: 14,
    border: `1px solid ${hexToRgba("#0f172a", 0.06)}`,
    boxShadow: `0 10px 24px ${hexToRgba("#0f172a", 0.08)}`,
    transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
    "&:hover": {
      transform: "translateY(-2px)",
      boxShadow: `0 16px 32px ${hexToRgba("#0f172a", 0.14)}`
    }
  },
  ticketContent: {
    paddingBottom: `${theme.spacing(2)}px !important`
  },
  ticketTopBar: {
    height: 6,
    borderRadius: 999,
    marginBottom: theme.spacing(1.5)
  },
  ticketTitle: {
    fontWeight: 600
  },
  lastMessage: {
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    color: theme.palette.text.secondary
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
    padding: theme.spacing(4, 2),
    border: `1px dashed ${hexToRgba("#94a3b8", 0.45)}`,
    borderRadius: 14,
    background: hexToRgba("#ffffff", 0.8)
  },
  emptyBoard: {
    padding: theme.spacing(6, 3),
    textAlign: "center",
    borderRadius: 18,
    border: `1px dashed ${hexToRgba("#94a3b8", 0.45)}`,
    color: theme.palette.text.secondary,
    background: hexToRgba("#ffffff", 0.75)
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

      <div className={classes.page}>
        <Typography variant="body2" className={classes.intro}>
          Organize as conversas por pipeline comercial, com etapas independentes do fluxo operacional dos tickets.
        </Typography>

        <Paper className={`${classes.pipelineTabs} ${classes.tabsShell}`}>
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

        {!selectedPipeline ? (
          <Paper className={classes.emptyBoard}>
            Nenhum pipeline encontrado. Cadastre um pipeline e as etapas em "Pipelines".
          </Paper>
        ) : (
          <div className={classes.boardScroller}>
            <div className={classes.boardRow}>
              {(selectedPipeline.stages || []).map(stage => {
                const stageTickets = tickets.filter(
                  ticket => ticket.kanbanStageId === stage.id
                );
                const accentColor = stage.color || "#1976d2";

                return (
                  <Paper
                    key={stage.id}
                    className={classes.column}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => handleDrop(event, stage)}
                  >
                    <div
                      className={classes.columnAccent}
                      style={{
                        background: `linear-gradient(90deg, ${accentColor} 0%, ${hexToRgba(accentColor, 0.55)} 100%)`
                      }}
                    />
                    <div className={classes.columnHeader}>
                      <div className={classes.columnHeading}>
                        <Typography variant="h6" className={classes.columnTitle}>
                          {stage.name}
                        </Typography>
                        <Typography variant="body2" className={classes.columnSubtitle}>
                          Pipeline: {selectedPipeline.name}
                        </Typography>
                      </div>
                      <Chip
                        size="small"
                        label={stageTickets.length}
                        style={{
                          backgroundColor: accentColor,
                          color: "#fff",
                          fontWeight: 700
                        }}
                      />
                    </div>
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
                            <CardContent className={classes.ticketContent}>
                              <div
                                className={classes.ticketTopBar}
                                style={{
                                  background: `linear-gradient(90deg, ${accentColor} 0%, ${hexToRgba(accentColor, 0.55)} 100%)`
                                }}
                              />
                              <Typography variant="subtitle1" className={classes.ticketTitle}>
                                {ticket.contact?.name || `Ticket #${ticket.id}`}
                              </Typography>
                              <Typography variant="body2" className={classes.lastMessage}>
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
                );
              })}
            </div>
          </div>
        )}
      </div>
    </MainContainer>
  );
};

export default Kanban;
