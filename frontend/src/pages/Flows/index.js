import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import AddCircleOutlineIcon from "@material-ui/icons/AddCircleOutline";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import PlayArrowIcon from "@material-ui/icons/PlayArrow";
import FlashOnIcon from "@material-ui/icons/FlashOn";
import FilterListIcon from "@material-ui/icons/FilterList";
import BuildIcon from "@material-ui/icons/Build";
import DragIndicatorIcon from "@material-ui/icons/DragIndicator";
import CloseIcon from "@material-ui/icons/Close";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const lanes = ["trigger", "condition", "action"];
const laneMeta = {
  trigger: {
    title: "Gatilhos",
    color: "#f97316",
    icon: FlashOnIcon
  },
  condition: {
    title: "Condicoes",
    color: "#16a34a",
    icon: FilterListIcon
  },
  action: {
    title: "Acoes",
    color: "#2563eb",
    icon: BuildIcon
  }
};

const triggerOptions = [
  { value: "tag_added", label: "Etiqueta adicionada" },
  { value: "queue_entered", label: "Entrou na fila" },
  { value: "user_transferred", label: "Transferido de usuario" },
  { value: "flow_sent", label: "Fluxo enviado" }
];

const conditionOptions = [
  { value: "custom_field_is", label: "Campo personalizado e" },
  { value: "user_is", label: "Usuario e" },
  { value: "queue_is", label: "Fila e" },
  { value: "has_tag", label: "Possui etiqueta" },
  { value: "time_is", label: "Horario e" },
  { value: "weekday_is", label: "Dia da semana e" }
];

const actionOptions = [
  { value: "edit_custom_field", label: "Editar campo personalizado" },
  { value: "add_tag", label: "Adicionar etiqueta" },
  { value: "send_message", label: "Enviar mensagem" },
  { value: "send_photo", label: "Enviar foto" },
  { value: "transfer_queue", label: "Transferir fila" },
  { value: "transfer_user", label: "Transferir usuario" },
  { value: "trigger_flow", label: "Acionar outro fluxo" },
  { value: "send_webhook", label: "Enviar webhook" },
  { value: "wait", label: "Esperar" },
  { value: "random_delay", label: "Delay aleatorio" },
  { value: "move_main_kanban_stage", label: "Mover etapa no kanban principal" },
  { value: "move_pipeline_stage", label: "Mover etapa no pipeline" },
  { value: "assign_pipeline", label: "Adicionar a um pipeline" },
  { value: "add_contact_to_pipeline", label: "Adicionar contato a um pipeline" },
  { value: "move_contact_pipeline_stage", label: "Mover contato no pipeline" },
  { value: "remove_contact_from_pipeline", label: "Remover contato do pipeline" },
  { value: "load_last_certificate_order_fields", label: "Carregar ultimo pedido nos campos do contato" },
  { value: "resolve_ticket", label: "Resolver conversa" },
  { value: "stop_automations", label: "Parar automacoes" }
];

const optionsByLane = {
  trigger: triggerOptions,
  condition: conditionOptions,
  action: actionOptions
};

const useStyles = makeStyles(theme => ({
  tableCard: {
    padding: theme.spacing(2)
  },
  canvasDialog: {
    "& .MuiDialog-paper": {
      width: "100vw",
      maxWidth: "100vw",
      height: "100vh",
      maxHeight: "100vh",
      margin: 0,
      borderRadius: 0
    }
  },
  dialogBody: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: theme.spacing(2),
    height: "100%",
    overflow: "hidden"
  },
  dialogBodyWithInspector: {
    gridTemplateColumns: "1fr 360px",
    [theme.breakpoints.down("md")]: {
      gridTemplateColumns: "1fr"
    }
  },
  canvasShell: {
    display: "flex",
    flexDirection: "column",
    borderRadius: 24,
    overflow: "hidden",
    background: "#0f172a",
    color: "#fff",
    minHeight: 0
  },
  canvasToolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    borderBottom: "1px solid rgba(255,255,255,0.08)"
  },
  toolbarButtons: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1)
  },
  viewport: {
    position: "relative",
    flex: 1,
    overflow: "auto",
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)",
    backgroundSize: "32px 32px"
  },
  viewportInner: {
    position: "relative",
    minWidth: 1300,
    minHeight: 900
  },
  laneBand: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 380,
    borderRight: "1px solid rgba(255,255,255,0.08)"
  },
  laneHeader: {
    position: "absolute",
    top: 18,
    width: 320,
    padding: theme.spacing(1.5),
    borderRadius: 18,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)"
  },
  node: {
    position: "absolute",
    width: 280,
    minHeight: 132,
    padding: theme.spacing(1.5),
    borderRadius: 20,
    color: "#fff",
    boxShadow: "0 20px 45px rgba(2, 6, 23, 0.45)",
    border: "1px solid rgba(255,255,255,0.18)",
    userSelect: "none",
    cursor: "pointer"
  },
  nodeSelected: {
    outline: "3px solid rgba(255,255,255,0.32)"
  },
  nodeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  dragHandle: {
    cursor: "grab",
    color: "rgba(255,255,255,0.8)"
  },
  connector: {
    position: "absolute",
    top: "50%",
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#fff",
    border: "2px solid rgba(15,23,42,0.55)",
    transform: "translateY(-50%)",
    cursor: "crosshair",
    zIndex: 4,
    boxShadow: "0 0 0 6px rgba(255,255,255,0.12)"
  },
  inputConnector: {
    left: -12
  },
  outputConnector: {
    right: -12
  },
  inspector: {
    borderRadius: 24,
    padding: theme.spacing(2),
    background: "#f8fafc",
    overflow: "auto"
  },
  inspectorHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1)
  },
  sectionTitle: {
    fontWeight: 700
  },
  helper: {
    color: theme.palette.text.secondary
  },
  chipWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: theme.spacing(1),
    marginTop: theme.spacing(1)
  },
  field: {
    marginTop: theme.spacing(1.5)
  }
}));

const initialResources = {
  tags: [],
  users: [],
  queues: [],
  contactFields: [],
  pipelines: [],
  flows: []
};

const createNode = (lane, x, y) => ({
  id: `${lane}-${Date.now()}-${Math.random()}`,
  lane,
  type: "",
  x,
  y,
  payload: {}
});

const initialForm = {
  id: null,
  name: "",
  description: "",
  active: true,
  nodes: [createNode("trigger", 80, 130), createNode("action", 860, 130)],
  edges: []
};

const laneX = {
  trigger: 60,
  condition: 470,
  action: 880
};

const laneDefaultY = lane => {
  if (lane === "trigger") return 130;
  if (lane === "condition") return 280;
  return 130;
};

const getLabel = (lane, type) =>
  (optionsByLane[lane].find(option => option.value === type) || {}).label || "Selecione o tipo";

const laneOrder = {
  trigger: 0,
  condition: 1,
  action: 2
};

const sortNodesForFlow = (nodes = []) =>
  [...nodes].sort(
    (a, b) =>
      laneOrder[a.lane] - laneOrder[b.lane] ||
      a.x - b.x ||
      a.y - b.y
  );

const inferLinearEdges = (nodes = []) => {
  const typedNodes = sortNodesForFlow(nodes.filter(node => node.type));

  return typedNodes.slice(0, -1).map((node, index) => ({
    from: node.id,
    to: typedNodes[index + 1].id
  }));
};

const getEffectiveEdges = form =>
  form.edges && form.edges.length ? form.edges : inferLinearEdges(form.nodes);

const getReachableNodeIds = (form, edges = getEffectiveEdges(form)) => {
  const outgoing = new Map();
  const typedNodes = form.nodes.filter(node => node.type);
  const nodeMap = new Map(typedNodes.map(node => [node.id, node]));
  const reachable = new Set();

  edges.forEach(edge => {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      return;
    }

    if (!outgoing.has(edge.from)) {
      outgoing.set(edge.from, []);
    }

    outgoing.get(edge.from).push(edge.to);
  });

  const visit = nodeId => {
    if (!nodeId || reachable.has(nodeId)) {
      return;
    }

    reachable.add(nodeId);
    (outgoing.get(nodeId) || []).forEach(visit);
  };

  typedNodes
    .filter(node => node.lane === "trigger")
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .forEach(node => visit(node.id));

  return reachable;
};

const getOrderedNodes = form => {
  const edges = getEffectiveEdges(form);
  const connectedNodeIds = getReachableNodeIds(form, edges);
  const connectedNodes = form.nodes.filter(node => connectedNodeIds.has(node.id));
  const nodeMap = new Map(connectedNodes.map(node => [node.id, node]));
  const incoming = new Map();
  const outgoing = new Map();

  edges.forEach(edge => {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) {
      return;
    }

    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
    if (!outgoing.has(edge.from)) {
      outgoing.set(edge.from, []);
    }
    outgoing.get(edge.from).push(edge.to);
  });

  const starters = form.nodes
    .filter(node => nodeMap.has(node.id) && node.lane === "trigger" && !incoming.get(node.id))
    .sort((a, b) => a.x - b.x || a.y - b.y);

  const visited = new Set();
  const ordered = [];

  const visit = node => {
    if (!node || visited.has(node.id)) {
      return;
    }

    visited.add(node.id);
    ordered.push(node);
    (outgoing.get(node.id) || []).forEach(nextId => visit(nodeMap.get(nextId)));
  };

  starters.forEach(visit);
  connectedNodes
    .sort((a, b) => a.x - b.x || a.y - b.y)
    .forEach(visit);

  return ordered;
};

const sanitizeFlow = form => {
  const byLane = {
    trigger: [],
    condition: [],
    action: []
  };

  getOrderedNodes(form).forEach(node => {
    if (node.type) {
      byLane[node.lane].push({
        type: node.type,
        payload: node.payload || {}
      });
    }
  });

  return {
    name: form.name,
    description: form.description,
    active: form.active,
    triggers: byLane.trigger,
    conditions: byLane.condition,
    actions: byLane.action,
    layout: {
      nodes: form.nodes.map(node => ({
        id: node.id,
        lane: node.lane,
        x: node.x,
        y: node.y,
        type: node.type,
        payload: node.payload || {}
      })),
      edges: getEffectiveEdges(form)
    }
  };
};

const buildNodesFromFlow = flow => {
  const layoutNodes = flow.layout?.nodes || [];
  const layoutEdges = flow.layout?.edges || [];
  const consumedLayoutIds = new Set();
  const nodes = [];

  const addNodes = (items, lane) => {
    items.forEach((item, index) => {
      const layoutNode =
        layoutNodes.find(node => !consumedLayoutIds.has(node.id) && node.lane === lane && node.type === item.type) ||
        layoutNodes.find(node => !consumedLayoutIds.has(node.id) && node.lane === lane);

      if (layoutNode) {
        consumedLayoutIds.add(layoutNode.id);
      }

      nodes.push({
        id: layoutNode?.id || `${lane}-${item.type}-${Math.random()}`,
        lane,
        type: item.type || "",
        payload: item.payload || layoutNode?.payload || {},
        x: layoutNode?.x ?? laneX[lane],
        y: layoutNode?.y ?? laneDefaultY(lane) + index * 170
      });
    });
  };

  addNodes(flow.triggers || [], "trigger");
  addNodes(flow.conditions || [], "condition");
  addNodes(flow.actions || [], "action");

  const finalNodes = nodes.length ? nodes : initialForm.nodes;

  return {
    nodes: finalNodes,
    edges: layoutEdges.length ? layoutEdges : inferLinearEdges(finalNodes)
  };
};

const Flows = () => {
  const classes = useStyles();
  const [flows, setFlows] = useState([]);
  const [resources, setResources] = useState(initialResources);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testFlowId, setTestFlowId] = useState("");
  const [testTicketId, setTestTicketId] = useState("");
  const [form, setForm] = useState(initialForm);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [connectionDrag, setConnectionDrag] = useState(null);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const dragRef = useRef(null);
  const viewportRef = useRef(null);
  const viewportInnerRef = useRef(null);
  const nodeRefs = useRef({});

  const selectedNode = useMemo(
    () => form.nodes.find(node => node.id === selectedNodeId) || null,
    [form.nodes, selectedNodeId]
  );

  const stageOptions = useMemo(
    () =>
      resources.pipelines.flatMap(pipeline =>
        (pipeline.stages || []).map(stage => ({
          id: stage.id,
          name: `${pipeline.name} / ${stage.name}`
        }))
      ),
    [resources.pipelines]
  );

  const loadFlows = async () => {
    try {
      const { data } = await api.get("/flows");
      setFlows(data);
    } catch (err) {
      toastError(err);
    }
  };

  const loadResources = async () => {
    try {
      const [tagsRes, usersRes, queuesRes, fieldsRes, pipelinesRes, flowsRes] =
        await Promise.all([
          api.get("/tags"),
          api.get("/users", { params: { pageNumber: "1", searchParam: "" } }),
          api.get("/queue"),
          api.get("/contact-field-definitions"),
          api.get("/kanban-pipelines"),
          api.get("/flows")
        ]);

      setResources({
        tags: tagsRes.data || [],
        users: usersRes.data?.users || [],
        queues: queuesRes.data || [],
        contactFields: fieldsRes.data || [],
        pipelines: pipelinesRes.data || [],
        flows: flowsRes.data || []
      });
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadFlows();
    loadResources();
  }, []);

  useEffect(() => {
    if (!dialogOpen) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      setCanvasVersion(prev => prev + 1);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [dialogOpen, form.nodes, form.edges]);

  useEffect(() => {
    const handleMouseMove = event => {
      if (!dragRef.current) {
        return;
      }

      const { nodeId, offsetX, offsetY } = dragRef.current;
      setForm(prev => ({
        ...prev,
        nodes: prev.nodes.map(node =>
          node.id === nodeId
            ? {
                ...node,
                x: Math.max(20, event.clientX - offsetX),
                y: Math.max(90, event.clientY - offsetY)
              }
            : node
        )
      }));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      setConnectionDrag(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const openNew = () => {
    setForm(initialForm);
    setSelectedNodeId(null);
    setConnectionDrag(null);
    setDialogOpen(true);
  };

  const openEdit = flow => {
    const built = buildNodesFromFlow(flow);
    setForm({
      id: flow.id,
      name: flow.name || "",
      description: flow.description || "",
      active: flow.active !== false,
      nodes: built.nodes,
      edges: built.edges || []
    });
    setSelectedNodeId(null);
    setConnectionDrag(null);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedNodeId(null);
    setConnectionDrag(null);
    setForm(initialForm);
  };

  const saveFlow = async event => {
    event.preventDefault();

    const payload = sanitizeFlow(form);
    const reachableNodeIds = getReachableNodeIds(form, payload.layout.edges);
    const disconnectedTypedNodes = form.nodes.filter(
      node => node.type && !reachableNodeIds.has(node.id)
    );

    if (!payload.triggers.length) {
      toast.error("Adicione pelo menos um gatilho");
      return;
    }

    if (!payload.actions.length) {
      toast.error("Adicione pelo menos uma acao");
      return;
    }

    if (disconnectedTypedNodes.length > 0) {
      toast.error("Conecte os blocos antes de salvar o fluxo");
      return;
    }

    try {
      if (form.id) {
        await api.put(`/flows/${form.id}`, payload);
      } else {
        await api.post("/flows", payload);
      }
      toast.success("Fluxo salvo");
      closeDialog();
      loadFlows();
      loadResources();
    } catch (err) {
      toastError(err);
    }
  };

  const removeFlow = async flowId => {
    try {
      await api.delete(`/flows/${flowId}`);
      toast.success("Fluxo removido");
      loadFlows();
      loadResources();
    } catch (err) {
      toastError(err);
    }
  };

  const updateNode = (nodeId, patch) => {
    setForm(prev => ({
      ...prev,
      nodes: prev.nodes.map(node =>
        node.id === nodeId
          ? {
              ...node,
              ...patch,
              payload: patch.payload ? { ...patch.payload } : node.payload
            }
          : node
      )
    }));
  };

  const updatePayload = (key, value) => {
    if (!selectedNode) {
      return;
    }

    updateNode(selectedNode.id, {
      payload: {
        ...selectedNode.payload,
        [key]: value
      }
    });
  };

  const addNode = lane => {
    const node = createNode(lane, laneX[lane], laneDefaultY(lane));
    setForm(prev => ({
      ...prev,
      nodes: [...prev.nodes, node]
    }));
    setSelectedNodeId(node.id);
  };

  const removeNode = nodeId => {
    setForm(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      edges: (prev.edges || []).filter(edge => edge.from !== nodeId && edge.to !== nodeId)
    }));
    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    if (connectionDrag?.from === nodeId) {
      setConnectionDrag(null);
    }
  };

  const startDrag = (event, nodeId) => {
    event.preventDefault();
    dragRef.current = {
      nodeId,
      offsetX: event.clientX - event.currentTarget.closest("[data-node-id]").getBoundingClientRect().left,
      offsetY: event.clientY - event.currentTarget.closest("[data-node-id]").getBoundingClientRect().top
    };
  };

  const runTest = async event => {
    event.preventDefault();

    try {
      await api.post(`/flows/${testFlowId}/run/${testTicketId}`);
      toast.success("Fluxo acionado");
      setTestDialogOpen(false);
      setTestFlowId("");
      setTestTicketId("");
    } catch (err) {
      toastError(err);
    }
  };

  const renderLookup = ({ label, value, options, getOptionLabel, onChange, helperText }) => (
    <Autocomplete
      options={options}
      clearOnEscape
      getOptionLabel={getOptionLabel}
      value={options.find(option => String(option.id) === String(value || "")) || null}
      onChange={(_, option) => onChange(option ? option.id : null)}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          variant="outlined"
          margin="dense"
          fullWidth
          helperText={helperText}
        />
      )}
    />
  );

  const getNodeAnchor = (nodeId, side = "output") => {
    const nodeElement = nodeRefs.current[nodeId];
    const innerRect = viewportInnerRef.current?.getBoundingClientRect();
    const viewport = viewportRef.current;

    if (!nodeElement || !innerRect || !viewport) {
      return null;
    }

    const connectorElement =
      nodeElement.querySelector(`[data-connector-side="${side}"]`) || nodeElement;
    const rect = connectorElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - innerRect.left + viewport.scrollLeft,
      y: rect.top + rect.height / 2 - innerRect.top + viewport.scrollTop
    };
  };

  const handleConnectorMouseDown = (event, nodeId) => {
    event.stopPropagation();
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const innerRect = viewportInnerRef.current?.getBoundingClientRect();
    const viewport = viewportRef.current;

    if (!innerRect || !viewport) {
      return;
    }

    const anchor = {
      x: rect.left + rect.width / 2 - innerRect.left + viewport.scrollLeft,
      y: rect.top + rect.height / 2 - innerRect.top + viewport.scrollTop
    };

    setConnectionDrag({
      from: nodeId,
      x1: anchor.x,
      y1: anchor.y,
      x2: anchor.x,
      y2: anchor.y
    });
  };

  const finishConnection = nodeId => {
    if (!connectionDrag || connectionDrag.from === nodeId) {
      return;
    }

    setForm(prev => ({
      ...prev,
      edges: [
        ...(prev.edges || []).filter(
          edge =>
            edge.from !== connectionDrag.from &&
            edge.to !== nodeId &&
            !(edge.from === connectionDrag.from && edge.to === nodeId)
        ),
        { from: connectionDrag.from, to: nodeId }
      ]
    }));
    setConnectionDrag(null);
  };

  const renderEdgePath = edge => {
    const fromAnchor = getNodeAnchor(edge.from, "output");
    const toAnchor = getNodeAnchor(edge.to, "input");

    if (!fromAnchor || !toAnchor) {
      return null;
    }

    const startX = fromAnchor.x;
    const startY = fromAnchor.y;
    const endX = toAnchor.x;
    const endY = toAnchor.y;
    const curve = Math.max(80, Math.abs(endX - startX) * 0.4);

    return `M ${startX} ${startY} C ${startX + curve} ${startY}, ${endX - curve} ${endY}, ${endX} ${endY}`;
  };

  useEffect(() => {
    const handleMouseMove = event => {
      if (!connectionDrag) {
        return;
      }

      const rect = viewportInnerRef.current?.getBoundingClientRect();
      const viewport = viewportRef.current;
      if (!rect) {
        return;
      }

      setConnectionDrag(prev =>
        prev
          ? {
              ...prev,
              x2: event.clientX - rect.left + (viewport?.scrollLeft || 0),
              y2: event.clientY - rect.top + (viewport?.scrollTop || 0)
            }
          : null
      );
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [connectionDrag]);

  const renderNodeFields = () => {
    if (!selectedNode) {
      return (
        <Typography className={classes.helper}>
          Selecione um bloco no canvas para editar.
        </Typography>
      );
    }

    const payload = selectedNode.payload || {};

    if (selectedNode.lane === "trigger") {
      return (
        <>
          <TextField
            select
            label="Tipo de gatilho"
            value={selectedNode.type}
            onChange={event => updateNode(selectedNode.id, { type: event.target.value, payload: {} })}
            variant="outlined"
            margin="dense"
            fullWidth
          >
            {triggerOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {selectedNode.type === "tag_added" &&
            renderLookup({
              label: "Etiqueta",
              value: payload.tagId,
              options: resources.tags,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("tagId", value)
            })}
          {selectedNode.type === "queue_entered" &&
            renderLookup({
              label: "Fila",
              value: payload.queueId,
              options: resources.queues,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("queueId", value)
            })}
          {selectedNode.type === "user_transferred" &&
            renderLookup({
              label: "Usuario",
              value: payload.userId,
              options: resources.users,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("userId", value)
            })}
          {selectedNode.type === "flow_sent" &&
            renderLookup({
              label: "Fluxo disparado",
              value: payload.flowId,
              options: resources.flows.filter(flow => flow.id !== form.id),
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("flowId", value),
              helperText: "Deixe em branco para disparar quando qualquer fluxo for enviado."
            })}
        </>
      );
    }

    if (selectedNode.lane === "condition") {
      return (
        <>
          <TextField
            select
            label="Tipo de condicao"
            value={selectedNode.type}
            onChange={event => updateNode(selectedNode.id, { type: event.target.value, payload: {} })}
            variant="outlined"
            margin="dense"
            fullWidth
          >
            {conditionOptions.map(option => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          {selectedNode.type === "custom_field_is" && (
            <>
              {renderLookup({
                label: "Campo personalizado",
                value: payload.fieldDefinitionId,
                options: resources.contactFields,
                getOptionLabel: option => option.name || "",
                onChange: value => updatePayload("fieldDefinitionId", value)
              })}
              <TextField
                label="Valor esperado"
                value={payload.value || ""}
                onChange={event => updatePayload("value", event.target.value)}
                variant="outlined"
                margin="dense"
                fullWidth
              />
            </>
          )}
          {selectedNode.type === "user_is" &&
            renderLookup({
              label: "Usuario",
              value: payload.userId,
              options: resources.users,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("userId", value)
            })}
          {selectedNode.type === "queue_is" &&
            renderLookup({
              label: "Fila",
              value: payload.queueId,
              options: resources.queues,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("queueId", value)
            })}
          {selectedNode.type === "has_tag" &&
            renderLookup({
              label: "Etiqueta",
              value: payload.tagId,
              options: resources.tags,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("tagId", value)
            })}
          {selectedNode.type === "time_is" && (
            <TextField
              label="Horario"
              type="time"
              value={payload.time || ""}
              onChange={event => updatePayload("time", event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          )}
          {selectedNode.type === "weekday_is" && (
            <TextField
              select
              label="Dia da semana"
              value={payload.weekday ?? ""}
              onChange={event => updatePayload("weekday", Number(event.target.value))}
              variant="outlined"
              margin="dense"
              fullWidth
            >
              <MenuItem value={0}>Domingo</MenuItem>
              <MenuItem value={1}>Segunda</MenuItem>
              <MenuItem value={2}>Terca</MenuItem>
              <MenuItem value={3}>Quarta</MenuItem>
              <MenuItem value={4}>Quinta</MenuItem>
              <MenuItem value={5}>Sexta</MenuItem>
              <MenuItem value={6}>Sabado</MenuItem>
            </TextField>
          )}
        </>
      );
    }

    return (
      <>
        <TextField
          select
          label="Tipo de acao"
          value={selectedNode.type}
          onChange={event => updateNode(selectedNode.id, { type: event.target.value, payload: {} })}
          variant="outlined"
          margin="dense"
          fullWidth
        >
          {actionOptions.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        {selectedNode.type === "edit_custom_field" && (
          <>
            {renderLookup({
              label: "Campo personalizado",
              value: payload.fieldDefinitionId,
              options: resources.contactFields,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("fieldDefinitionId", value)
            })}
            <TextField
              label="Valor"
              value={payload.value || ""}
              onChange={event => updatePayload("value", event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </>
        )}
        {selectedNode.type === "add_tag" &&
          <>
            {renderLookup({
              label: "Etiqueta",
              value: payload.tagId,
              options: resources.tags,
              getOptionLabel: option => option.name || "",
              onChange: value => updatePayload("tagId", value)
            })}
            <TextField
              select
              label="Aplicar em"
              value={payload.target || "contact"}
              onChange={event => updatePayload("target", event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
            >
              <MenuItem value="contact">Contato</MenuItem>
              <MenuItem value="conversation">Conversa</MenuItem>
              <MenuItem value="both">Contato e conversa</MenuItem>
            </TextField>
          </>}
        {selectedNode.type === "send_message" && (
          <TextField
            label="Mensagem"
            value={payload.body || ""}
            onChange={event => updatePayload("body", event.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
            multiline
            rows={4}
          />
        )}
        {selectedNode.type === "send_photo" && (
          <>
            <TextField
              label="URL da imagem"
              value={payload.fileUrl || ""}
              onChange={event => updatePayload("fileUrl", event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Caminho interno do servidor"
              value={payload.filePath || ""}
              onChange={event => updatePayload("filePath", event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
              helperText="Opcional. Use somente se a imagem ja existir dentro do servidor."
            />
            <TextField
              label="Legenda"
              value={payload.caption || ""}
              onChange={event => updatePayload("caption", event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </>
        )}
        {selectedNode.type === "transfer_queue" &&
          renderLookup({
            label: "Fila de destino",
            value: payload.queueId,
            options: resources.queues,
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("queueId", value)
          })}
        {selectedNode.type === "transfer_user" &&
          renderLookup({
            label: "Usuario de destino",
            value: payload.userId,
            options: resources.users,
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("userId", value)
          })}
        {selectedNode.type === "trigger_flow" &&
          renderLookup({
            label: "Fluxo a acionar",
            value: payload.flowId,
            options: resources.flows.filter(flow => flow.id !== form.id),
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("flowId", value)
          })}
        {selectedNode.type === "send_webhook" && (
          <TextField
            label="URL do webhook"
            value={payload.url || ""}
            onChange={event => updatePayload("url", event.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
          />
        )}
        {selectedNode.type === "wait" && (
          <TextField
            label="Tempo de espera (ms)"
            type="number"
            value={payload.ms || ""}
            onChange={event => updatePayload("ms", Number(event.target.value))}
            variant="outlined"
            margin="dense"
            fullWidth
          />
        )}
        {selectedNode.type === "random_delay" && (
          <>
            <TextField
              label="Minimo (ms)"
              type="number"
              value={payload.minMs || ""}
              onChange={event => updatePayload("minMs", Number(event.target.value))}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Maximo (ms)"
              type="number"
              value={payload.maxMs || ""}
              onChange={event => updatePayload("maxMs", Number(event.target.value))}
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </>
        )}
        {selectedNode.type === "move_main_kanban_stage" && (
          <TextField
            select
            label="Etapa do kanban principal"
            value={payload.status || ""}
            onChange={event => updatePayload("status", event.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
          >
            <MenuItem value="pending">Aguardando</MenuItem>
            <MenuItem value="open">Em atendimento</MenuItem>
            <MenuItem value="closed">Resolvido</MenuItem>
          </TextField>
        )}
        {selectedNode.type === "move_pipeline_stage" &&
          renderLookup({
            label: "Etapa do pipeline",
            value: payload.kanbanStageId,
            options: stageOptions,
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("kanbanStageId", value)
          })}
        {selectedNode.type === "assign_pipeline" &&
          renderLookup({
            label: "Pipeline",
            value: payload.pipelineId,
            options: resources.pipelines,
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("pipelineId", value)
          })}
        {selectedNode.type === "add_contact_to_pipeline" &&
          renderLookup({
            label: "Pipeline do contato",
            value: payload.pipelineId,
            options: resources.pipelines.filter(
              option =>
                String(option.name || "").trim().toLowerCase() !== "pipeline principal"
            ),
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("pipelineId", value)
          })}
        {selectedNode.type === "add_contact_to_pipeline" &&
          renderLookup({
            label: "Etapa do contato",
            value: payload.kanbanStageId,
            options: stageOptions.filter(
              option =>
                !payload.pipelineId ||
                String(option.pipelineId) === String(payload.pipelineId)
            ),
            getOptionLabel: option => `${option.pipelineName || ""} • ${option.name || ""}`,
            onChange: value => updatePayload("kanbanStageId", value)
          })}
        {selectedNode.type === "move_contact_pipeline_stage" &&
          renderLookup({
            label: "Pipeline do contato",
            value: payload.pipelineId,
            options: resources.pipelines.filter(
              option =>
                String(option.name || "").trim().toLowerCase() !== "pipeline principal"
            ),
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("pipelineId", value)
          })}
        {selectedNode.type === "move_contact_pipeline_stage" &&
          renderLookup({
            label: "Nova etapa do contato",
            value: payload.kanbanStageId,
            options: stageOptions.filter(
              option =>
                !payload.pipelineId ||
                String(option.pipelineId) === String(payload.pipelineId)
            ),
            getOptionLabel: option => `${option.pipelineName || ""} • ${option.name || ""}`,
            onChange: value => updatePayload("kanbanStageId", value)
          })}
        {selectedNode.type === "remove_contact_from_pipeline" &&
          renderLookup({
            label: "Pipeline do contato",
            value: payload.pipelineId,
            options: resources.pipelines.filter(
              option =>
                String(option.name || "").trim().toLowerCase() !== "pipeline principal"
            ),
            getOptionLabel: option => option.name || "",
            onChange: value => updatePayload("pipelineId", value)
          })}
        {selectedNode.type === "load_last_certificate_order_fields" && (
          <Typography variant="body2" color="textSecondary">
            Carrega os dados do pedido mais recente do contato nos campos globais, para uso em placeholders e disparos seguintes.
          </Typography>
        )}
      </>
    );
  };

  return (
    <MainContainer>
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        className={classes.canvasDialog}
        fullScreen
        maxWidth={false}
      >
        <form onSubmit={saveFlow} style={{ height: "100%" }}>
          <DialogTitle>Construtor de Fluxos</DialogTitle>
          <DialogContent dividers style={{ height: "calc(100% - 116px)", padding: 8 }}>
            <Grid container spacing={2} style={{ marginBottom: 8 }}>
              <Grid item xs={12} md={5}>
                <TextField
                  label="Nome do fluxo"
                  value={form.name}
                  onChange={event => {
                    const { value } = event.target;
                    setForm(prev => ({ ...prev, name: value }));
                  }}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                  required
                />
              </Grid>
              <Grid item xs={12} md={5}>
                <TextField
                  label="Descricao"
                  value={form.description}
                  onChange={event => {
                    const { value } = event.target;
                    setForm(prev => ({ ...prev, description: value }));
                  }}
                  variant="outlined"
                  margin="dense"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} md={2}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={Boolean(form.active)}
                      onChange={event => {
                        const { checked } = event.target;
                        setForm(prev => ({ ...prev, active: checked }));
                      }}
                    />
                  }
                  label="Ativo"
                />
              </Grid>
            </Grid>

            <div
              className={`${classes.dialogBody} ${
                selectedNode ? classes.dialogBodyWithInspector : ""
              }`}
            >
              <div className={classes.canvasShell} style={{ borderRadius: 0 }}>
                <div className={classes.canvasToolbar}>
                  <div>
                    <Typography variant="h6" className={classes.sectionTitle}>
                      Canvas visual
                    </Typography>
                    <Typography variant="body2" className={classes.helper} style={{ color: "rgba(255,255,255,0.72)" }}>
                      Arraste os blocos, clique para editar e monte o fluxo sem usar JSON.
                    </Typography>
                  </div>
                  <div className={classes.toolbarButtons}>
                    {lanes.map(lane => {
                      const Icon = laneMeta[lane].icon;
                      return (
                        <Button
                          key={lane}
                          size="small"
                          variant="contained"
                          startIcon={<Icon />}
                          onClick={() => addNode(lane)}
                          style={{ backgroundColor: laneMeta[lane].color, color: "#fff" }}
                        >
                          {laneMeta[lane].title.slice(0, -1)}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className={classes.viewport} ref={viewportRef}>
                  <div className={classes.viewportInner} ref={viewportInnerRef}>
                    {lanes.map((lane, index) => (
                      <React.Fragment key={lane}>
                        <div
                          className={classes.laneBand}
                          style={{
                            left: 20 + index * 410,
                            background: `linear-gradient(180deg, ${laneMeta[lane].color}18 0%, transparent 28%)`
                          }}
                        />
                        <div className={classes.laneHeader} style={{ left: 50 + index * 410 }}>
                          <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                            {laneMeta[lane].title}
                          </Typography>
                          <Typography variant="body2" style={{ color: "rgba(255,255,255,0.72)" }}>
                            {form.nodes.filter(node => node.lane === lane).length} bloco(s)
                          </Typography>
                        </div>
                      </React.Fragment>
                    ))}

                    <svg width="1300" height="900" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                      {(form.edges || []).map((edge, index) => {
                        const path = renderEdgePath(edge);
                        if (!path) {
                          return null;
                        }

                        return (
                          <path
                            key={`${edge.from}-${edge.to}-${index}`}
                            d={path}
                            stroke="rgba(255,255,255,0.42)"
                            strokeWidth="3"
                            fill="none"
                          />
                        );
                      })}
                      {connectionDrag ? (
                        <path
                          d={`M ${connectionDrag.x1} ${connectionDrag.y1} C ${connectionDrag.x1 + 80} ${connectionDrag.y1}, ${connectionDrag.x2 - 80} ${connectionDrag.y2}, ${connectionDrag.x2} ${connectionDrag.y2}`}
                          stroke="rgba(255,255,255,0.55)"
                          strokeWidth="3"
                          fill="none"
                          strokeDasharray="8 6"
                        />
                      ) : null}
                    </svg>

                    {form.nodes.map(node => (
                      <div
                        key={node.id}
                        data-node-id={node.id}
                        ref={element => {
                          if (element) {
                            nodeRefs.current[node.id] = element;
                          } else {
                            delete nodeRefs.current[node.id];
                          }
                        }}
                        className={`${classes.node} ${selectedNodeId === node.id ? classes.nodeSelected : ""}`}
                        style={{
                          left: node.x,
                          top: node.y,
                          background: `linear-gradient(180deg, ${laneMeta[node.lane].color} 0%, ${laneMeta[node.lane].color}d9 100%)`
                        }}
                        onClick={() => setSelectedNodeId(node.id)}
                      >
                        <div className={classes.nodeHeader}>
                          <div>
                            <Typography variant="caption" style={{ opacity: 0.8 }}>
                              {laneMeta[node.lane].title.slice(0, -1)}
                            </Typography>
                            <Typography variant="subtitle1" style={{ fontWeight: 700 }}>
                              {getLabel(node.lane, node.type)}
                            </Typography>
                          </div>
                          <div>
                            <IconButton size="small" onMouseDown={event => startDrag(event, node.id)}>
                              <DragIndicatorIcon className={classes.dragHandle} />
                            </IconButton>
                            <IconButton size="small" onClick={() => removeNode(node.id)}>
                              <DeleteOutlineIcon style={{ color: "#fff" }} fontSize="small" />
                            </IconButton>
                          </div>
                        </div>
                        <Typography variant="body2" style={{ opacity: 0.82 }}>
                          {node.type ? "Configurado no painel lateral" : "Escolha o tipo deste bloco"}
                        </Typography>
                        <div className={classes.chipWrap}>
                          <Chip size="small" label={node.lane} style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#fff" }} />
                          {node.type ? (
                            <Chip size="small" label={node.type} style={{ backgroundColor: "rgba(255,255,255,0.18)", color: "#fff" }} />
                          ) : null}
                        </div>
                        <div
                          className={`${classes.connector} ${classes.inputConnector}`}
                          data-connector-side="input"
                          onMouseDown={event => event.stopPropagation()}
                          onMouseEnter={() => finishConnection(node.id)}
                          onMouseUp={() => finishConnection(node.id)}
                        />
                        <div
                          className={`${classes.connector} ${classes.outputConnector}`}
                          data-connector-side="output"
                          onMouseDown={event => handleConnectorMouseDown(event, node.id)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {selectedNode ? (
                <Paper className={classes.inspector} variant="outlined" style={{ borderRadius: 0 }}>
                  <div className={classes.inspectorHeader}>
                    <div>
                      <Typography variant="h6" className={classes.sectionTitle}>
                        Propriedades
                      </Typography>
                      <Typography variant="body2" className={classes.helper}>
                        Clique no X para fechar e deixar o canvas em tela cheia.
                      </Typography>
                    </div>
                    <IconButton size="small" onClick={() => setSelectedNodeId(null)}>
                      <CloseIcon />
                    </IconButton>
                  </div>
                  <Divider style={{ margin: "16px 0" }} />
                  {renderNodeFields()}

                  <div className={classes.field}>
                    <Divider />
                  </div>

                  <div className={classes.field}>
                    <Typography variant="subtitle2" className={classes.sectionTitle}>
                      Referencias visuais
                    </Typography>
                    <div className={classes.chipWrap}>
                      {resources.tags.slice(0, 8).map(tag => (
                        <Chip key={tag.id} size="small" label={tag.name} style={{ backgroundColor: tag.color, color: "#fff" }} />
                      ))}
                      {resources.queues.slice(0, 8).map(queue => (
                        <Chip key={queue.id} size="small" label={queue.name} />
                      ))}
                    </div>
                  </div>
                </Paper>
              ) : null}
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog} color="secondary" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" color="primary" variant="contained">
              Salvar fluxo
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth="sm" fullWidth>
        <form onSubmit={runTest}>
          <DialogTitle>Acionar fluxo manualmente</DialogTitle>
          <DialogContent dividers>
            <TextField
              select
              label="Fluxo"
              value={testFlowId}
              onChange={event => setTestFlowId(event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
              required
            >
              {flows.map(flow => (
                <MenuItem key={flow.id} value={flow.id}>
                  {flow.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Ticket ID"
              value={testTicketId}
              onChange={event => setTestTicketId(event.target.value)}
              variant="outlined"
              margin="dense"
              fullWidth
              required
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTestDialogOpen(false)} color="secondary" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" color="primary" variant="contained">
              Acionar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <MainHeader>
        <Title>Fluxos</Title>
        <MainHeaderButtonsWrapper>
          <Button color="default" variant="outlined" startIcon={<PlayArrowIcon />} onClick={() => setTestDialogOpen(true)}>
            Testar fluxo
          </Button>
          <Button color="primary" variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={openNew}>
            Novo fluxo
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.tableCard}>
        <Typography className={classes.helper} style={{ marginBottom: 16 }}>
          O editor visual agora usa canvas com blocos arrastáveis e painel humano de configuração.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Gatilhos</TableCell>
              <TableCell>Condicoes</TableCell>
              <TableCell>Acoes</TableCell>
              <TableCell>Ativo</TableCell>
              <TableCell align="right">Acoes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {flows.map(flow => (
              <TableRow key={flow.id}>
                <TableCell>
                  <Typography variant="body2" style={{ fontWeight: 700 }}>
                    {flow.name}
                  </Typography>
                  {flow.description ? (
                    <Typography variant="caption" className={classes.helper}>
                      {flow.description}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>{(flow.triggers || []).length}</TableCell>
                <TableCell>{(flow.conditions || []).length}</TableCell>
                <TableCell>{(flow.actions || []).length}</TableCell>
                <TableCell>{flow.active ? "Sim" : "Nao"}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(flow)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => removeFlow(flow.id)}>
                    <DeleteOutlineIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Flows;
