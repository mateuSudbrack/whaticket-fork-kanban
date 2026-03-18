import React, { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography
} from "@material-ui/core";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const FlowRunDialog = ({ open, onClose, ticketId }) => {
  const [flows, setFlows] = useState([]);
  const [flowId, setFlowId] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadFlows = async () => {
      try {
        const { data } = await api.get("/flows");
        setFlows((data || []).filter(flow => flow.active));
      } catch (err) {
        toastError(err);
      }
    };

    loadFlows();
  }, [open]);

  const handleSubmit = async event => {
    event.preventDefault();

    if (!flowId) {
      return;
    }

    setLoading(true);
    try {
      await api.post(`/flows/${flowId}/run/${ticketId}`);
      toast.success("Fluxo enviado");
      setFlowId("");
      onClose();
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFlowId("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Enviar fluxo</DialogTitle>
        <DialogContent dividers>
          <Typography color="textSecondary" style={{ marginBottom: 12 }}>
            Escolha um fluxo para acionar manualmente nesta conversa.
          </Typography>
          <TextField
            select
            label="Fluxo"
            value={flowId}
            onChange={event => setFlowId(event.target.value)}
            variant="outlined"
            margin="dense"
            fullWidth
            required
          >
            <MenuItem value="">Selecione</MenuItem>
            {flows.map(flow => (
              <MenuItem key={flow.id} value={flow.id}>
                {flow.name}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary" variant="outlined">
            Cancelar
          </Button>
          <Button
            type="submit"
            color="primary"
            variant="contained"
            disabled={loading || !flowId}
          >
            Enviar
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default FlowRunDialog;
