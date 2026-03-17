import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField
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

const initialForm = {
  id: null,
  name: "",
  color: "#1976d2",
  sortOrder: 0
};

const KanbanStages = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [stages, setStages] = useState([]);

  const loadStages = async () => {
    try {
      const { data } = await api.get("/kanban-stages");
      setStages(data);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadStages();
  }, []);

  const handleClose = () => {
    setForm(initialForm);
    setOpen(false);
  };

  const handleSubmit = async event => {
    event.preventDefault();

    try {
      const payload = {
        ...form,
        sortOrder: Number(form.sortOrder)
      };

      if (form.id) {
        await api.put(`/kanban-stages/${form.id}`, payload);
      } else {
        await api.post("/kanban-stages", payload);
      }

      toast.success("Estagio salvo");
      handleClose();
      loadStages();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async stageId => {
    try {
      await api.delete(`/kanban-stages/${stageId}`);
      toast.success("Estagio removido");
      loadStages();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {form.id ? "Editar estagio do kanban" : "Novo estagio do kanban"}
          </DialogTitle>
          <DialogContent dividers>
            <TextField
              label="Nome"
              value={form.name}
              onChange={event =>
                setForm(prev => ({ ...prev, name: event.target.value }))
              }
              variant="outlined"
              margin="dense"
              fullWidth
              required
            />
            <TextField
              label="Cor"
              value={form.color}
              onChange={event =>
                setForm(prev => ({ ...prev, color: event.target.value }))
              }
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <TextField
              label="Ordem"
              type="number"
              value={form.sortOrder}
              onChange={event =>
                setForm(prev => ({ ...prev, sortOrder: event.target.value }))
              }
              variant="outlined"
              margin="dense"
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose} color="secondary" variant="outlined">
              Cancelar
            </Button>
            <Button type="submit" color="primary" variant="contained">
              Salvar
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      <MainHeader>
        <Title>Estagios do Kanban</Title>
        <MainHeaderButtonsWrapper>
          <Button color="primary" variant="contained" onClick={() => setOpen(true)}>
            Novo estagio
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper style={{ padding: 16 }}>
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
            {stages.map(stage => (
              <TableRow key={stage.id}>
                <TableCell>{stage.name}</TableCell>
                <TableCell>{stage.color}</TableCell>
                <TableCell>{stage.sortOrder}</TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setForm(stage);
                      setOpen(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(stage.id)}>
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

export default KanbanStages;
