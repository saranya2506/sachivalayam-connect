import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { StatusBadge } from "@/components/AppShell";
import { toast } from "sonner";
import {
  requestMissingDocuments,
  updateServiceStatus,
  verifyDocument,
} from "@/lib/api/services.functions";
import { Upload, FileCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/citizen/services/$id")({
  component: ServiceDetail,
});

interface App {
  id: string;
  application_number: string;
  application_type: string;
  status: string;
  citizen_id: string;
  citizen_name: string;
  aadhaar_number: string;
  mobile_number: string;
  email: string | null;
  address: string;
  village: string;
  mandal: string;
  district: string;
  assigned_officer_id: string | null;
  department: string | null;
  last_remark: string | null;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  completed_at: string | null;
}
interface Doc {
  id: string;
  doc_type: string;
  file_path: string | null;
  status: string;
  notes: string | null;
  updated_at: string;
}
interface TL {
  id: string;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_by: string | null;
}

function ServiceDetail() {
  const { id } = Route.useParams();
  const { user, role } = useAuth();
  const [app, setApp] = useState<App | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [tl, setTl] = useState<TL[]>([]);
  const [officer, setOfficer] = useState<{
    full_name: string;
    email: string;
    mobile_number: string | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data: a } = await supabase
      .from("service_applications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    setApp(a as App | null);
    const { data: d } = await supabase
      .from("service_app_documents")
      .select("*")
      .eq("application_id", id)
      .order("created_at");
    setDocs((d as Doc[]) ?? []);
    const { data: t } = await supabase
      .from("service_app_timeline")
      .select("*")
      .eq("application_id", id)
      .order("created_at");
    setTl((t as TL[]) ?? []);
    if (a?.assigned_officer_id) {
      const { data: o } = await supabase
        .from("profiles")
        .select("full_name,email,mobile_number")
        .eq("id", a.assigned_officer_id)
        .maybeSingle();
      setOfficer(o as never);
    } else setOfficer(null);
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  if (!app) return <div className="p-6 text-muted-foreground">Loading…</div>;

  const isCitizen = user?.id === app.citizen_id;
  const isOfficer = user?.id === app.assigned_officer_id;
  const isAdmin = role === "admin" || role === "government_authority";

  const uploadDoc = async (docId: string, file: File) => {
    setBusy(true);
    try {
      const path = `${user!.id}/${app.id}/${docId}-${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("service-documents")
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { error: updErr } = await supabase
        .from("service_app_documents")
        .update({
          file_path: path,
          status: "uploaded",
          uploaded_by: user!.id,
        })
        .eq("id", docId);
      if (updErr) throw updErr;
      // If application was documents_required → flip to under_verification
      if (app.status === "documents_required") {
        await supabase
          .from("service_applications")
          .update({ status: "under_verification" })
          .eq("id", app.id);
        await supabase.from("service_app_timeline").insert({
          application_id: app.id,
          status: "under_verification",
          remarks: "Citizen uploaded documents",
          updated_by: user!.id,
        });
      }
      toast.success("Document uploaded");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadDoc = async (path: string) => {
    const { data } = await supabase.storage.from("service-documents").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const requestDocs = async () => {
    const input = prompt("Document types to request (comma-separated):");
    if (!input) return;
    const remarks = prompt("Remarks (optional):") ?? undefined;
    setBusy(true);
    try {
      await requestMissingDocuments({
        data: {
          applicationId: app.id,
          docTypes: input
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          remarks,
        },
      });
      toast.success("Requested");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (
    status: "under_verification" | "approved" | "rejected" | "completed",
  ) => {
    const remarks = prompt(`Remarks for ${status}:`) ?? undefined;
    setBusy(true);
    try {
      await updateServiceStatus({ data: { applicationId: app.id, status, remarks } });
      toast.success("Updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const verifyDoc = async (docId: string, status: "verified" | "rejected") => {
    setBusy(true);
    try {
      await verifyDocument({ data: { documentId: docId, status } });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const missing = docs.filter((d) => d.status === "pending");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-sm text-muted-foreground">{app.application_number}</div>
          <h1 className="text-2xl font-bold capitalize">
            {app.application_type.replace(/_/g, " ")}
          </h1>
          <div className="mt-1">
            <StatusBadge status={app.status} />
          </div>
        </div>
        {(isOfficer || isAdmin) && (
          <div className="flex flex-wrap gap-2">
            {app.status !== "approved" &&
              app.status !== "completed" &&
              app.status !== "rejected" && (
                <>
                  <button
                    disabled={busy}
                    onClick={requestDocs}
                    className="rounded border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                  >
                    Request documents
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setStatus("under_verification")}
                    className="rounded bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    Under verification
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setStatus("approved")}
                    className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => setStatus("rejected")}
                    className="rounded bg-destructive px-3 py-1.5 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                  >
                    Reject
                  </button>
                </>
              )}
            {app.status === "approved" && (
              <button
                disabled={busy}
                onClick={() => setStatus("completed")}
                className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Mark completed
              </button>
            )}
          </div>
        )}
      </div>

      {isCitizen && missing.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-4 text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          <div className="font-semibold">Documents required</div>
          <ul className="mt-1 list-disc pl-5 text-sm">
            {missing.map((d) => (
              <li key={d.id}>
                {d.doc_type}
                {d.notes && (
                  <>
                    {" "}
                    — <em>{d.notes}</em>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <Section title="Documents">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Document</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {docs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-3 text-muted-foreground">
                      None.
                    </td>
                  </tr>
                )}
                {docs.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2">
                      <div className="font-medium">{d.doc_type}</div>
                      {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                    </td>
                    <td className="p-2">
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="p-2 space-x-2 whitespace-nowrap">
                      {d.file_path && (
                        <button
                          onClick={() => downloadDoc(d.file_path!)}
                          className="text-primary hover:underline text-xs"
                        >
                          View
                        </button>
                      )}
                      {isCitizen && d.status !== "verified" && (
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted">
                          <Upload className="h-3 w-3" /> {d.file_path ? "Replace" : "Upload"}
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) uploadDoc(d.id, f);
                            }}
                          />
                        </label>
                      )}
                      {(isOfficer || isAdmin) && d.file_path && d.status === "uploaded" && (
                        <>
                          <button
                            onClick={() => verifyDoc(d.id, "verified")}
                            className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => verifyDoc(d.id, "rejected")}
                            className="rounded bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          <Section title="Timeline">
            <ol className="space-y-3">
              {tl.map((t) => (
                <li key={t.id} className="flex gap-3 border-l-2 border-primary/40 pl-3">
                  <FileCheck className="h-4 w-4 flex-none text-primary" />
                  <div>
                    <div className="text-sm font-medium capitalize">
                      {t.status.replace(/_/g, " ")}
                    </div>
                    {t.remarks && <div className="text-sm text-muted-foreground">{t.remarks}</div>}
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Application">
            <Info k="Applicant" v={app.citizen_name} />
            <Info k="Aadhaar" v={app.aadhaar_number} />
            <Info k="Mobile" v={app.mobile_number} />
            {app.email && <Info k="Email" v={app.email} />}
            <Info
              k="Address"
              v={`${app.address}, ${app.village}, ${app.mandal}, ${app.district}`}
            />
            <Info k="Applied" v={new Date(app.created_at).toLocaleString()} />
            <Info k="Last updated" v={new Date(app.updated_at).toLocaleString()} />
            {app.approved_at && (
              <Info k="Approved" v={new Date(app.approved_at).toLocaleString()} />
            )}
            {app.completed_at && (
              <Info k="Completed" v={new Date(app.completed_at).toLocaleString()} />
            )}
            {app.last_remark && <Info k="Latest remark" v={app.last_remark} />}
          </Section>
          <Section title="Assigned officer">
            {officer ? (
              <>
                <Info k="Name" v={officer.full_name} />
                <Info k="Email" v={officer.email} />
                {officer.mobile_number && <Info k="Mobile" v={officer.mobile_number} />}
                {app.department && <Info k="Department" v={app.department} />}
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Not yet assigned.</div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b p-3 text-sm font-semibold">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  );
}
function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="mb-2 text-sm">
      <div className="text-xs text-muted-foreground">{k}</div>
      <div>{v}</div>
    </div>
  );
}
