import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/citizen/new")({ component: NewComplaint });

const CATEGORIES = [
  ["water_supply", "Water Supply"],
  ["drainage", "Drainage"],
  ["roads", "Roads"],
  ["street_lights", "Street Lights"],
  ["sanitation", "Sanitation"],
  ["certificates", "Certificates"],
  ["pensions", "Pensions"],
  ["others", "Others"],
] as const;

function NewComplaint() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: "",
    category: "water_supply",
    description: "",
    location: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (form.title.length < 3) return toast.error("Title is too short");
    if (form.description.length < 10) return toast.error("Description is too short");
    setBusy(true);
    try {
      let photo_url: string | null = null;
      if (photo) {
        const path = `${user.id}/${Date.now()}-${photo.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("complaint-photos")
          .upload(path, photo);
        if (upErr) throw upErr;
        photo_url = path;
      }
      const { data: c, error } = await supabase
        .from("complaints")
        .insert({
          citizen_id: user.id,
          title: form.title,
          category: form.category as never,
          description: form.description,
          location: form.location,
          photo_url,
          status: "submitted",
        } as never)
        .select("id,complaint_number")
        .single();
      if (error) throw error;
      await supabase.from("complaint_timeline").insert({
        complaint_id: c.id,
        status: "submitted",
        remarks: "Complaint submitted",
        updated_by: user.id,
      });
      await supabase.from("notifications").insert({
        user_id: user.id,
        title: `Complaint ${c.complaint_number} submitted`,
        link: `/complaints/${c.id}`,
      });
      await supabase.from("audit_logs").insert({
        actor_id: user.id,
        actor_email: user.email,
        action: "COMPLAINT_SUBMITTED",
        entity_type: "complaint",
        entity_id: c.id,
      });
      toast.success(`Complaint ${c.complaint_number} submitted`);
      nav({ to: "/citizen" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold">New Complaint</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Provide as much detail as possible. You'll receive notifications as the status changes.
      </p>
      <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium">Title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Category *</label>
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            {CATEGORIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Location *</label>
          <input
            required
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Street, ward, landmark…"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Description *</label>
          <textarea
            required
            rows={5}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Photo (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="mt-1 w-full text-sm"
          />
        </div>
        <button
          disabled={busy}
          className="w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit complaint"}
        </button>
      </form>
    </div>
  );
}
