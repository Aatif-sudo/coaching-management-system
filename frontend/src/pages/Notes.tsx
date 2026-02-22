import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { EmptyState } from "../components/EmptyState";
import { LoadingSpinner } from "../components/LoadingSpinner";
import type { Batch, NoteItem } from "../types";
import { useToast } from "../context/ToastContext";

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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <h2 className="font-display text-xl text-charcoal">Upload Study Material</h2>
        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={upload}>
          <select
            value={form.batch_id}
            onChange={(e) => setForm((prev) => ({ ...prev, batch_id: e.target.value }))}
            required
          >
            <option value="">Select batch</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Title"
            required
          />
          <input
            value={form.tags}
            onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
            placeholder="Tags (comma separated)"
          />
          <input
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
            onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
            required
          />
          <textarea
            className="sm:col-span-2"
            rows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Description"
          />
          <button className="btn-primary sm:col-span-2 w-fit" type="submit" disabled={uploading}>
            {uploading ? "Uploading..." : "Upload Note"}
          </button>
        </form>
      </section>

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-charcoal">Notes Library</h2>
          <select value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)} className="w-full sm:w-72">
            <option value="">All batches</option>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </select>
        </div>

        {!notes.length ? (
          <EmptyState title="No notes uploaded yet" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {notes.map((note) => (
              <article key={note.id} className="rounded-lg border border-sand p-4">
                <p className="text-xs uppercase text-charcoal/60">Batch #{note.batch_id}</p>
                <h3 className="mt-1 font-semibold text-charcoal">{note.title}</h3>
                <p className="mt-1 text-sm text-charcoal/75">{note.description || "No description"}</p>
                <p className="mt-2 text-xs text-charcoal/60">Tags: {note.tags || "-"}</p>
                <button
                  type="button"
                  className="btn-secondary mt-3"
                  onClick={() => void download(note.id, note.file_name)}
                >
                  Download {note.file_name}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
