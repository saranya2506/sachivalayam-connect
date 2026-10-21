import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/authority/audit-logs")({
  component: AuditLogs,
});

interface Row {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: unknown;
  created_at: string;
  is_archived: boolean;
}

function AuditLogs() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("audit_logs")
      .select("*")
      .eq("is_archived", view === "archived")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as Row[]) ?? []);
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleArchive = async (id: string, archive: boolean) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("audit_logs")
        .update({
          is_archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
          archived_by: archive ? (user?.id ?? null) : null,
        })
        .eq("id", id);
      if (error) throw error;
      toast.success(archive ? "Archived" : "Restored");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const filtered = rows.filter(
    (r) =>
      search === "" ||
      r.action.toLowerCase().includes(search.toLowerCase()) ||
      r.actor_email?.toLowerCase().includes(search.toLowerCase()) ||
      (r.entity_id ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Audit Logs</h1>
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="flex gap-1 rounded-md border bg-background p-1">
            <button
              onClick={() => setView("active")}
              className={`rounded px-3 py-1 text-xs font-semibold ${view === "active" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Active
            </button>
            <button
              onClick={() => setView("archived")}
              className={`rounded px-3 py-1 text-xs font-semibold ${view === "archived" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              Archived
            </button>
          </div>
          <input
            placeholder="Filter by action, email, entity…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-md rounded-md border bg-background px-3 py-1.5 text-sm"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Time</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">Metadata</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No log entries.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-t align-top">
                  <td className="p-3 text-muted-foreground whitespace-nowrap">
                    {new Date(r.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">{r.actor_email ?? "system"}</td>
                  <td className="p-3 font-mono text-xs">{r.action}</td>
                  <td className="p-3 text-xs">
                    {r.entity_type}
                    {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : ""}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    <code>{r.metadata ? JSON.stringify(r.metadata) : ""}</code>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {view === "active" ? (
                      <button
                        disabled={busy}
                        onClick={() => toggleArchive(r.id, true)}
                        className="rounded border px-2 py-1 text-xs hover:bg-muted disabled:opacity-60"
                      >
                        Archive
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => toggleArchive(r.id, false)}
                        className="rounded bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                      >
                        Restore
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
