import React, { useContext, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Paper,
  Switch,
  Tab,
  Tabs,
  Typography,
  makeStyles
} from "@material-ui/core";
import { useHistory } from "react-router-dom";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import TicketsKanban from "../../components/TicketsKanban";
import TicketsQueueSelect from "../../components/TicketsQueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import { i18n } from "../../translate/i18n";
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
    display: "flex",
    flexDirection: "column",
    gap: theme.spacing(2),
    height: "100%"
  },
  intro: {
    color: theme.palette.text.secondary
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    padding: theme.spacing(1.5, 2),
    borderRadius: 14,
    flexWrap: "wrap"
  },
  toolbarLeft: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing(2),
    flexWrap: "wrap"
  },
  tabsShell: {
    padding: theme.spacing(1),
    borderRadius: 16,
    border: `1px solid ${hexToRgba("#1d4ed8", 0.12)}`,
    background: `linear-gradient(135deg, ${hexToRgba("#ffffff", 0.96)} 0%, ${hexToRgba("#eff6ff", 0.94)} 100%)`,
    boxShadow: `0 18px 40px ${hexToRgba("#0f172a", 0.08)}`
  },
  boardShell: {
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(1),
    borderRadius: 18,
    overflow: "hidden"
  },
  pipelineBoard: {
    background: `linear-gradient(180deg, ${hexToRgba("#dbeafe", 0.45)} 0%, ${theme.palette.background.default} 42%)`,
    borderRadius: 16,
    padding: theme.spacing(2),
    minHeight: "100%"
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
    minHeight: "calc(100vh - 300px)",
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
    maxHeight: "calc(100vh - 380px)",
    ...theme.scrollbarStyles
  },
  ticketCard: {
    cursor: "grab",
    borderRadius: 14,
    border: `1px solid ${hexToRgba("#0f172a", 0.06)}`,
    boxShadow: `0 10px 24px ${hexToRgba("#0f172a", 0.08)}`
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
  }
}));

const isPrincipalPipeline = pipeline =>
  String(pipeline?.name || "").trim().toLowerCase() === "pipeline principal";

const Kanban = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);
  const userQueueIds = user.queues.map(queue => queue.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [showAllTickets, setShowAllTickets] = useState(false);
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    if (user.profile?.toUpperCase() === "ADMIN") {
      setShowAllTickets(true);
    }
  }, [user.profile]);

  const selectedPipeline = useMemo(
    () => pipelines.find(item => String(item.id) === String(selectedPipelineId)),
    [pipelines, selectedPipelineId]
  );

  const loadBoard = async pipelineId => {
    try {
      const [{ data: pipelinesData }, { data: ticketsData }] = await Promise.all([
        api.get("/kanban-pipelines"),
        api.get("/tickets", {
          params: {
            showAll: showAllTickets,
            queueIds: JSON.stringify(selectedQueueIds || []),
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
  }, [selectedPipelineId, selectedQueueIds, showAllTickets]);

  useEffect(() => {
    const socket = openSocket();
    const reload = () => loadBoard(selectedPipelineId);

    socket.on("ticket", reload);
    socket.on("appMessage", reload);
    socket.on("contact", reload);

    return () => {
      socket.disconnect();
    };
  }, [selectedPipelineId, selectedQueueIds, showAllTickets]);

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

  const renderPipelineBoard = () => {
    if (!selectedPipeline) {
      return (
        <div className={classes.emptyState}>
          Nenhum pipeline encontrado. Cadastre um pipeline e as etapas em "Pipelines".
        </div>
      );
    }

    if (isPrincipalPipeline(selectedPipeline)) {
      return (
        <TicketsKanban
          showAll={showAllTickets}
          selectedQueueIds={selectedQueueIds}
        />
      );
    }

    return (
      <div className={classes.pipelineBoard}>
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
      </div>
    );
  };

  return (
    <MainContainer>
      <MainHeader>
        <Title>Kanban</Title>
      </MainHeader>

      <div className={classes.page}>
        <Typography variant="body2" className={classes.intro}>
          O Pipeline Principal espelha o fluxo operacional dos tickets. Os outros pipelines continuam com estágios próprios.
        </Typography>

        <Paper elevation={0} variant="outlined" className={classes.toolbar}>
          <div className={classes.toolbarLeft}>
            <Can
              role={user.profile}
              perform="tickets-manager:showall"
              yes={() => (
                <FormControlLabel
                  label={i18n.t("tickets.buttons.showAll")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() => setShowAllTickets(prevState => !prevState)}
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              )}
            />
            <TicketsQueueSelect
              selectedQueueIds={selectedQueueIds}
              userQueues={user?.queues}
              onChange={values => setSelectedQueueIds(values)}
            />
          </div>
        </Paper>

        <Paper className={classes.tabsShell}>
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

        <Paper elevation={0} variant="outlined" className={classes.boardShell}>
          {renderPipelineBoard()}
        </Paper>
      </div>
    </MainContainer>
  );
};

export default Kanban;
