import { FormEvent, useEffect, useState } from "react";
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { useToast } from "../context/ToastContext";
import type { Batch, NoteItem } from "../types";

export function NotesPage() {
  const { pushToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [batchFilter, setBatchFilter] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    batch_id: "",
    title: "",
    description: "",
    tags: "",
    file: null as File | null,
  });

  const load = async () => {
    setLoading(true);
    try {
      const [batchData, noteData] = await Promise.all([
        api.listBatches("?page=1&page_size=200"),
        api.listNotes(batchFilter ? `?batch_id=${batchFilter}` : ""),
      ]);
      setBatches(batchData.items);
      setNotes(noteData.items);
    } catch {
      pushToast("error", "Could not load notes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [batchFilter]);

  const upload = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.file || !form.batch_id) {
      pushToast("error", "Batch and file are required");
      return;
    }
    const formData = new FormData();
    formData.append("batch_id", form.batch_id);
    formData.append("title", form.title);
    formData.append("description", form.description);
    formData.append("tags", form.tags);
    formData.append("file", form.file);
    setUploading(true);
    try {
      await api.uploadNote(formData);
      pushToast("success", "Note uploaded");
      setForm({ batch_id: "", title: "", description: "", tags: "", file: null });
      await load();
    } catch {
      pushToast("error", "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const download = async (noteId: number, filename: string) => {
    try {
      const blob = await api.downloadNote(noteId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      pushToast("error", "Could not download file");
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Typography variant="h5">Upload Study Material</Typography>
        <Box
          component="form"
          onSubmit={upload}
          sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}
        >
          <FormControl fullWidth required>
            <InputLabel>Batch</InputLabel>
            <Select
              label="Batch"
              value={form.batch_id}
              onChange={(e) => setForm((prev) => ({ ...prev, batch_id: e.target.value }))}
            >
              <MenuItem value="">Select batch</MenuItem>
              {batches.map((batch) => (
                <MenuItem key={batch.id} value={batch.id}>
                  {batch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Title"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
            fullWidth
          />
          <TextField
            label="Tags"
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="comma separated"
            fullWidth
          />
          <TextField
            label="Attachment"
            type="file"
            inputProps={{ accept: ".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" }}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, file: (e.target as HTMLInputElement).files?.[0] || null }))
            }
            required
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
          <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
          <Box sx={{ gridColumn: { xs: "1", sm: "1 / -1" } }}>
            <Button type="submit" variant="contained" disabled={uploading}>
              {uploading ? "Uploading..." : "Upload Note"}
            </Button>
          </Box>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5, borderColor: "#e8ddcc" }}>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
          <Typography variant="h5">Notes Library</Typography>
          <FormControl sx={{ minWidth: { xs: "100%", sm: 280 } }} size="small">
            <InputLabel>Batch</InputLabel>
            <Select label="Batch" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <MenuItem value="">All batches</MenuItem>
              {batches.map((batch) => (
                <MenuItem key={batch.id} value={batch.id}>
                  {batch.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        {!notes.length ? (
          <Box sx={{ mt: 1.5 }}>
            <EmptyState title="No notes uploaded yet" />
          </Box>
        ) : (
          <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
            {notes.map((note) => (
              <Paper key={note.id} variant="outlined" sx={{ p: 2, borderColor: "#e8ddcc" }}>
                <Typography variant="caption" color="text.secondary">
                  Batch #{note.batch_id}
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {note.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {note.description || "No description"}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                  Tags: {note.tags || "-"}
                </Typography>
                <Button
                  type="button"
                  variant="outlined"
                  sx={{ mt: 1.25 }}
                  onClick={() => void download(note.id, note.file_name)}
                >
                  Download {note.file_name}
                </Button>
              </Paper>
            ))}
          </Box>
        )}
      </Paper>
    </Stack>
  );
}
