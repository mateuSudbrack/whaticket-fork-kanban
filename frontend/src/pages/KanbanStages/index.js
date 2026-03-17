import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@material-ui/core";
import EditIcon from "@material-ui/icons/Edit";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import { toast } from "react-toastify";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const initialPipelineForm = {
  id: null,
  name: "",
  color: "#1976d2",
  sortOrder: 0
};

const initialStageForm = {
  id: null,
  pipelineId: "",
  name: "",
  color: "#1976d2",
  sortOrder: 0
};

const KanbanStages = () => {
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState("");
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [pipelineForm, setPipelineForm] = useState(initialPipelineForm);
  const [stageForm, setStageForm] = useState(initialStageForm);

  const loadPipelines = async () => {
    try {
      const { data } = await api.get("/kanban-pipelines");
      setPipelines(data);
      if (!selectedPipelineId && data.length) {
        setSelectedPipelineId(String(data[0].id));
      }
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadPipelines();
  }, []);

  const selectedPipeline = useMemo(
    () => pipelines.find(item => String(item.id) === String(selectedPipelineId)),
    [pipelines, selectedPipelineId]
  );

  const handleClosePipelineDialog = () => {
    setPipelineForm(initialPipelineForm);
    setPipelineDialogOpen(false);
  };

  const handleCloseStageDialog = () => {
    setStageForm(initialStageForm);
    setStageDialogOpen(false);
  };

  const handleSubmitPipeline = async event => {
    event.preventDefault();

    try {
      const payload = {
        ...pipelineForm,
        sortOrder: Number(pipelineForm.sortOrder || 0)
      };

      if (pipelineForm.id) {
        await api.put(`/kanban-pipelines/${pipelineForm.id}`, payload);
      } else {
        await api.post("/kanban-pipelines", payload);
      }

      toast.success("Pipeline salvo");
      handleClosePipelineDialog();
      loadPipelines();
    } catch (err) {
      toastError(err);
    }
  };

  const handleSubmitStage = async event => {
    event.preventDefault();

    try {
      const payload = {
        ...stageForm,
        pipelineId: Number(stageForm.pipelineId),
        sortOrder: Number(stageForm.sortOrder || 0)
      };

      if (stageForm.id) {
        await api.put(`/kanban-stages/${stageForm.id}`, payload);
      } else {
        await api.post("/kanban-stages", payload);
      }

      toast.success("Estagio salvo");
      handleCloseStageDialog();
      loadPipelines();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeletePipeline = async pipelineId => {
    try {
      await api.delete(`/kanban-pipelines/${pipelineId}`);
      toast.success("Pipeline removido");
      if (String(selectedPipelineId) === String(pipelineId)) {
        setSelectedPipelineId("");
      }
      loadPipelines();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteStage = async stageId => {
    try {
      await api.delete(`/kanban-stages/${stageId}`);
      toast.success("Estagio removido");
      loadPipelines();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <Dialog open={pipelineDialogOpen} onClose={handleClosePipelineDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmitPipeline}>
          <DialogTitle>
            {pipelineForm.id ? "Editar pipeline" : "Novo pipeline"}
          </DialogTitle>
          <DialogContent dividers>
            <TextField
              label="Nome"
              value={pipelineForm.name}
              onChange={event => {
                const { value } = event.target;
                setPipelineForm(prev => ({ ...prev, name: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
              required
            />
            <TextField
              label="Cor"
              value={pipelineForm.color}
              onChange={event => {
                const { value } = event.target;
                setPipelineForm(prev => ({ ...prev, color: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Ordem"
              type="number"
              value={pipelineForm.sortOrder}
              onChange={event => {
                const { value } = event.target;
                setPipelineForm(prev => ({
                  ...prev,
                  sortOrder: value
                }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClosePipelineDialog} color="secondary" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" color="primary" variant="contained">
              Salvar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <Dialog open={stageDialogOpen} onClose={handleCloseStageDialog} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmitStage}>
          <DialogTitle>{stageForm.id ? "Editar estagio" : "Novo estagio"}</DialogTitle>
          <DialogContent dividers>
            <TextField
              select
              SelectProps={{ native: true }}
              label="Pipeline"
              value={stageForm.pipelineId}
              onChange={event => {
                const { value } = event.target;
                setStageForm(prev => ({ ...prev, pipelineId: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
              required
            >
              <option value="">Selecione</option>
              {pipelines.map(pipeline => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </TextField>
            <TextField
              label="Nome"
              value={stageForm.name}
              onChange={event => {
                const { value } = event.target;
                setStageForm(prev => ({ ...prev, name: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
              required
            />
            <TextField
              label="Cor"
              value={stageForm.color}
              onChange={event => {
                const { value } = event.target;
                setStageForm(prev => ({ ...prev, color: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Ordem"
              type="number"
              value={stageForm.sortOrder}
              onChange={event => {
                const { value } = event.target;
                setStageForm(prev => ({ ...prev, sortOrder: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseStageDialog} color="secondary" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" color="primary" variant="contained">
              Salvar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <MainHeader>
        <Title>Pipelines e Estagios</Title>
        <MainHeaderButtonsWrapper>
          <Button
            color="primary"
            variant="contained"
            onClick={() => setPipelineDialogOpen(true)}
            style={{ marginRight: 8 }}
          >
            Novo pipeline
          </Button>
          <Button
            color="primary"
            variant="outlined"
            onClick={() => {
              setStageForm(prev => ({
                ...initialStageForm,
                pipelineId: selectedPipelineId || ""
              }));
              setStageDialogOpen(true);
            }}
            disabled={!selectedPipelineId}
          >
            Novo estagio
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Paper style={{ padding: 16 }}>
            <Typography variant="subtitle1" gutterBottom>
              Pipelines
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Cor</TableCell>
                  <TableCell>Ordem</TableCell>
                  <TableCell align="right">Acoes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pipelines.map(pipeline => (
                  <TableRow
                    key={pipeline.id}
                    hover
                    selected={String(selectedPipelineId) === String(pipeline.id)}
                    onClick={() => setSelectedPipelineId(String(pipeline.id))}
                    style={{ cursor: "pointer" }}
                  >
                    <TableCell>{pipeline.name}</TableCell>
                    <TableCell>{pipeline.color}</TableCell>
                    <TableCell>{pipeline.sortOrder}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={event => {
                          event.stopPropagation();
                          setPipelineForm(pipeline);
                          setPipelineDialogOpen(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={event => {
                          event.stopPropagation();
                          handleDeletePipeline(pipeline.id);
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper style={{ padding: 16 }}>
            <Typography variant="subtitle1" gutterBottom>
              {selectedPipeline
                ? `Estagios de ${selectedPipeline.name}`
                : "Selecione um pipeline"}
            </Typography>
            <Divider style={{ marginBottom: 16 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Cor</TableCell>
                  <TableCell>Ordem</TableCell>
                  <TableCell align="right">Acoes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(selectedPipeline?.stages || []).map(stage => (
                  <TableRow key={stage.id}>
                    <TableCell>{stage.name}</TableCell>
                    <TableCell>{stage.color}</TableCell>
                    <TableCell>{stage.sortOrder}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setStageForm({
                            ...stage,
                            pipelineId: String(stage.pipelineId)
                          });
                          setStageDialogOpen(true);
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleDeleteStage(stage.id)}>
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
      </Grid>
    </MainContainer>
  );
};

export default KanbanStages;
