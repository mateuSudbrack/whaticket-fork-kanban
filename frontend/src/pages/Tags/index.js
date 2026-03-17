import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Switch,
  FormControlLabel,
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
  active: true
};

const Tags = () => {
  const [tags, setTags] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);

  const loadTags = async () => {
    try {
      const { data } = await api.get("/tags");
      setTags(data);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleClose = () => {
    setForm(initialForm);
    setOpen(false);
  };

  const handleSubmit = async event => {
    event.preventDefault();

    try {
      if (form.id) {
        await api.put(`/tags/${form.id}`, form);
      } else {
        await api.post("/tags", form);
      }
      toast.success("Etiqueta salva");
      handleClose();
      loadTags();
    } catch (err) {
      toastError(err);
    }
  };

  const handleDelete = async id => {
    try {
      await api.delete(`/tags/${id}`);
      toast.success("Etiqueta removida");
      loadTags();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>{form.id ? "Editar etiqueta" : "Nova etiqueta"}</DialogTitle>
          <DialogContent dividers>
            <TextField
              label="Nome"
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
            <TextField
              label="Cor"
              value={form.color}
              onChange={event => {
                const { value } = event.target;
                setForm(prev => ({ ...prev, color: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
            />
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
              label="Ativa"
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
        <Title>Etiquetas</Title>
        <MainHeaderButtonsWrapper>
          <Button color="primary" variant="contained" onClick={() => setOpen(true)}>
            Nova etiqueta
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper style={{ padding: 16 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Cor</TableCell>
              <TableCell>Ativa</TableCell>
              <TableCell align="right">Acoes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tags.map(tag => (
              <TableRow key={tag.id}>
                <TableCell>{tag.name}</TableCell>
                <TableCell>{tag.color}</TableCell>
                <TableCell>{tag.active ? "Sim" : "Nao"}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => {
                    setForm(tag);
                    setOpen(true);
                  }}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(tag.id)}>
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

export default Tags;
