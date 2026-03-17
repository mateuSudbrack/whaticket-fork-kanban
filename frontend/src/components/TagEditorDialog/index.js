import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  makeStyles
} from "@material-ui/core";
import { toast } from "react-toastify";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useStyles = makeStyles(theme => ({
  chips: {
    display: "flex",
    gap: theme.spacing(1),
    flexWrap: "wrap",
    marginTop: theme.spacing(1)
  },
  field: {
    minWidth: 280,
    marginTop: theme.spacing(1)
  }
}));

const TagEditorDialog = ({
  entity,
  entityType,
  title,
  buttonLabel = "Adicionar etiquetas",
  onUpdated
}) => {
  const classes = useStyles();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadTags = async () => {
      try {
        const { data } = await api.get("/tags");
        setTags(data.filter(tag => tag.active));
      } catch (err) {
        toastError(err);
      }
    };

    loadTags();
  }, [open]);

  useEffect(() => {
    setSelectedTagIds((entity?.tags || []).map(tag => tag.id));
  }, [entity]);

  const selectedTags = useMemo(() => {
    const selectedIds = new Set(selectedTagIds);
    return tags.filter(tag => selectedIds.has(tag.id));
  }, [selectedTagIds, tags]);

  const handleSave = async () => {
    if (!entity?.id) {
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put(`/${entityType}/${entity.id}`, {
        tagIds: selectedTagIds
      });
      toast.success("Etiquetas atualizadas");
      setOpen(false);
      if (onUpdated) {
        onUpdated(data);
      }
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        color="primary"
        size="small"
        onClick={() => setOpen(true)}
      >
        {buttonLabel}
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{title}</DialogTitle>
        <DialogContent dividers>
          <FormControl variant="outlined" fullWidth className={classes.field}>
            <InputLabel id={`${entityType}-tags-label`}>Etiquetas</InputLabel>
            <Select
              labelId={`${entityType}-tags-label`}
              multiple
              value={selectedTagIds}
              onChange={event => setSelectedTagIds(event.target.value)}
              input={<OutlinedInput label="Etiquetas" />}
              renderValue={selected => {
                const selectedIds = new Set(selected);
                return tags
                  .filter(tag => selectedIds.has(tag.id))
                  .map(tag => tag.name)
                  .join(", ");
              }}
            >
              {tags.map(tag => (
                <MenuItem key={tag.id} value={tag.id}>
                  <Checkbox checked={selectedTagIds.indexOf(tag.id) > -1} />
                  <ListItemText primary={tag.name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <div className={classes.chips}>
            {selectedTags.map(tag => (
              <Chip
                key={tag.id}
                size="small"
                label={tag.name}
                style={{ backgroundColor: tag.color, color: "#fff" }}
              />
            ))}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} color="secondary" variant="outlined">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            color="primary"
            variant="contained"
            disabled={saving}
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TagEditorDialog;
