import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
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

const initialForm = {
  id: null,
  name: "",
  type: "text",
  required: false,
  active: true,
  sortOrder: 0,
  options: ""
};

const ContactFields = () => {
  const [fields, setFields] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);

  const loadFields = async () => {
    try {
      const { data } = await api.get("/contact-field-definitions");
      setFields(data);
    } catch (err) {
      toastError(err);
    }
  };

  useEffect(() => {
    loadFields();
  }, []);

  const handleClose = () => {
    setOpen(false);
    setForm(initialForm);
  };

  const handleSubmit = async event => {
    event.preventDefault();

    const payload = {
      ...form,
      sortOrder: Number(form.sortOrder || 0),
      options:
        form.type === "select"
          ? String(form.options || "")
              .split("\n")
              .map(option => option.trim())
              .filter(Boolean)
          : []
    };

    try {
      if (form.id) {
        await api.put(`/contact-field-definitions/${form.id}`, payload);
      } else {
        await api.post("/contact-field-definitions", payload);
      }

      toast.success("Campo salvo");
      handleClose();
      loadFields();
    } catch (err) {
      toastError(err);
    }
  };

  const handleEdit = field => {
    setForm({
      ...field,
      options: Array.isArray(field.options) ? field.options.join("\n") : ""
    });
    setOpen(true);
  };

  const handleDelete = async fieldId => {
    try {
      await api.delete(`/contact-field-definitions/${fieldId}`);
      toast.success("Campo removido");
      loadFields();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <form onSubmit={handleSubmit}>
          <DialogTitle>
            {form.id ? "Editar campo de contato" : "Novo campo de contato"}
          </DialogTitle>
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
              autoFocus
            />
            <TextField
              select
              label="Tipo"
              value={form.type}
              onChange={event => {
                const { value } = event.target;
                setForm(prev => ({ ...prev, type: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
            >
              <MenuItem value="text">Texto</MenuItem>
              <MenuItem value="textarea">Texto longo</MenuItem>
              <MenuItem value="number">Numero</MenuItem>
              <MenuItem value="date">Data</MenuItem>
              <MenuItem value="select">Lista</MenuItem>
            </TextField>
            <TextField
              label="Ordem"
              type="number"
              value={form.sortOrder}
              onChange={event => {
                const { value } = event.target;
                setForm(prev => ({ ...prev, sortOrder: value }));
              }}
              variant="outlined"
              margin="dense"
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.required)}
                  onChange={event => {
                    const { checked } = event.target;
                    setForm(prev => ({
                      ...prev,
                      required: checked
                    }));
                  }}
                />
              }
              label="Obrigatorio"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(form.active)}
                  onChange={event => {
                    const { checked } = event.target;
                    setForm(prev => ({
                      ...prev,
                      active: checked
                    }));
                  }}
                />
              }
              label="Ativo"
            />
            {form.type === "select" && (
              <TextField
                label="Opcoes (uma por linha)"
                value={form.options}
                onChange={event => {
                  const { value } = event.target;
                  setForm(prev => ({ ...prev, options: value }));
                }}
                variant="outlined"
                margin="dense"
                multiline
                rows={4}
                fullWidth
              />
            )}
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
        <Title>Campos Globais de Contato</Title>
        <MainHeaderButtonsWrapper>
          <Button color="primary" variant="contained" onClick={() => setOpen(true)}>
            Novo campo
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper style={{ padding: 16 }}>
        <Typography color="textSecondary" style={{ marginBottom: 16 }}>
          Defina aqui os campos que aparecem em todos os contatos.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Obrigatorio</TableCell>
              <TableCell>Ativo</TableCell>
              <TableCell>Ordem</TableCell>
              <TableCell align="right">Acoes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fields.map(field => (
              <TableRow key={field.id}>
                <TableCell>{field.name}</TableCell>
                <TableCell>{field.type}</TableCell>
                <TableCell>{field.required ? "Sim" : "Nao"}</TableCell>
                <TableCell>{field.active ? "Sim" : "Nao"}</TableCell>
                <TableCell>{field.sortOrder}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => handleEdit(field)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(field.id)}>
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

export default ContactFields;
