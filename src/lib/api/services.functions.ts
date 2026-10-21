import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const SERVICE_TYPES = [
  "income_certificate",
  "pension",
  "ration_card",
  "caste_certificate",
  "residence_certificate",
  "birth_certificate",
  "death_certificate",
] as const;

export const REQUIRED_DOCS: Record<(typeof SERVICE_TYPES)[number], string[]> = {
  income_certificate: ["Aadhaar", "Income Proof", "Residence Proof"],
  pension: ["Aadhaar", "Age Proof", "Bank Passbook"],
  ration_card: ["Aadhaar", "Family Details", "Address Proof"],
  caste_certificate: ["Aadhaar", "Previous Caste Record", "Residence Proof"],
  residence_certificate: ["Aadhaar", "Address Proof"],
  birth_certificate: ["Birth Proof", "Parent Details"],
  death_certificate: ["Death Proof", "Identity Documents"],
};

/** Try to get the supabaseAdmin client. Returns null if service role key is unavailable. */
async function tryGetAdmin() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return null;
  }
}

const createSchema = z.object({
  applicationType: z.enum(SERVICE_TYPES),
  citizenName: z.string().min(2).max(120),
  aadhaarNumber: z.string().min(8).max(20),
  mobileNumber: z.string().min(6).max(20),
  email: z.string().email().optional().nullable(),
  address: z.string().min(2).max(500),
  village: z.string().min(1).max(120),
  mandal: z.string().min(1).max(120),
  district: z.string().min(1).max(120),
});

export const createServiceApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const required = REQUIRED_DOCS[data.applicationType];

    // Citizen inserts their own application — user JWT is fine (citizen INSERT RLS)
    const { data: app, error } = await context.supabase
      .from("service_applications")
      .insert({
        citizen_id: context.userId,
        application_type: data.applicationType,
        citizen_name: data.citizenName,
        aadhaar_number: data.aadhaarNumber,
        mobile_number: data.mobileNumber,
        email: data.email ?? null,
        address: data.address,
        village: data.village,
        mandal: data.mandal,
        district: data.district,
        status: "submitted",
      } as never)
      .select()
      .single();
    if (error || !app) throw new Error(error?.message ?? "Failed to create application");

    // Documents and timeline — citizen RLS covers these inserts
    await context.supabase
      .from("service_app_documents")
      .insert(
        required.map((doc) => ({ application_id: app.id, doc_type: doc, status: "pending" })),
      );
    await context.supabase.from("service_app_timeline").insert({
      application_id: app.id,
      status: "submitted",
      remarks: "Application submitted",
      updated_by: context.userId,
    });

    // Audit log — best-effort only
    const admin = await tryGetAdmin();
    if (admin) {
      await admin
        .from("audit_logs")
        .insert({
          actor_id: context.userId,
          action: "SERVICE_APP_CREATED",
          entity_type: "service_application",
          entity_id: app.id,
          metadata: { type: data.applicationType, number: app.application_number },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return { id: app.id, application_number: app.application_number };
  });

const assignSchema = z.object({
  applicationId: z.string().uuid(),
  officerId: z.string().uuid(),
  remarks: z.string().max(500).optional(),
});

export const assignServiceOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "government_authority",
    });
    if (!isAdmin && !isGov) throw new Error("Forbidden");

    // Read application using user JWT — admin/gov RLS "Admin all applications" covers this
    const { data: existing, error: readErr } = await context.supabase
      .from("service_applications")
      .select("assigned_admin_id,citizen_id,application_number,id")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (readErr) throw new Error(`Could not read application: ${readErr.message}`);
    if (!existing) throw new Error("Application not found.");

    if (existing.assigned_admin_id && existing.assigned_admin_id !== context.userId && !isGov) {
      throw new Error(
        "Already assigned by another admin. Only the original admin or Government Authority can reassign.",
      );
    }

    // Read officer profile using user JWT (admin/gov can read all profiles via RLS)
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("department")
      .eq("id", data.officerId)
      .maybeSingle();

    // Update application using user JWT — "Admin all applications" RLS covers UPDATE
    const { data: app, error: updateErr } = await context.supabase
      .from("service_applications")
      .update({
        assigned_officer_id: data.officerId,
        assigned_admin_id: context.userId,
        assigned_at: new Date().toISOString(),
        assignment_remarks: data.remarks ?? null,
        department: prof?.department ?? null,
        status: "assigned",
        last_remark: data.remarks ?? null,
      })
      .eq("id", data.applicationId)
      .select()
      .single();
    if (updateErr) throw new Error(`Update failed: ${updateErr.message}`);
    if (!app) throw new Error("Application update returned no data.");

    // Timeline insert using user JWT
    await context.supabase.from("service_app_timeline").insert({
      application_id: data.applicationId,
      status: "assigned",
      remarks: data.remarks,
      updated_by: context.userId,
    });

    // Best-effort secondary ops
    const admin = await tryGetAdmin();
    if (admin) {
      await admin
        .from("notifications")
        .insert([
          {
            user_id: data.officerId,
            title: `New application assigned: ${app.application_number}`,
            link: `/citizen/services/${app.id}`,
          },
          {
            user_id: app.citizen_id,
            title: `Your application ${app.application_number} has been assigned`,
            link: `/citizen/services/${app.id}`,
          },
        ])
        .then(
          () => {},
          () => {},
        );
      await admin
        .from("audit_logs")
        .insert({
          actor_id: context.userId,
          action: "SERVICE_APP_ASSIGNED",
          entity_type: "service_application",
          entity_id: data.applicationId,
          metadata: { officer_id: data.officerId, admin_id: context.userId },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return { ok: true };
  });

const requestDocsSchema = z.object({
  applicationId: z.string().uuid(),
  docTypes: z.array(z.string().min(1).max(120)).min(1).max(20),
  remarks: z.string().max(500).optional(),
});

export const requestMissingDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => requestDocsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "government_authority",
    });

    const { data: app, error: readErr } = await context.supabase
      .from("service_applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (readErr) throw new Error(`Could not read application: ${readErr.message}`);
    if (!app) throw new Error("Application not found.");

    if (app.assigned_officer_id !== context.userId && !isAdmin && !isGov)
      throw new Error("Forbidden");

    await context.supabase.from("service_app_documents").insert(
      data.docTypes.map((t) => ({
        application_id: data.applicationId,
        doc_type: t,
        status: "pending",
        requested_by: context.userId,
        notes: data.remarks ?? null,
      })),
    );

    await context.supabase
      .from("service_applications")
      .update({ status: "documents_required", last_remark: data.remarks ?? null })
      .eq("id", data.applicationId);

    await context.supabase.from("service_app_timeline").insert({
      application_id: data.applicationId,
      status: "documents_required",
      remarks: `Requested: ${data.docTypes.join(", ")}${data.remarks ? " — " + data.remarks : ""}`,
      updated_by: context.userId,
    });

    // Best-effort notification to citizen
    const admin = await tryGetAdmin();
    if (admin) {
      await admin
        .from("notifications")
        .insert({
          user_id: app.citizen_id,
          title: `Documents required for ${app.application_number}`,
          body: data.docTypes.join(", "),
          link: `/citizen/services/${app.id}`,
        })
        .then(
          () => {},
          () => {},
        );
    }

    return { ok: true };
  });

const updateStatusSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(["under_verification", "approved", "rejected", "completed"]),
  remarks: z.string().max(1000).optional(),
});

const SERVICE_TRANSITIONS: Record<string, string[]> = {
  submitted: ["assigned", "under_verification", "rejected"],
  assigned: ["under_verification", "documents_required", "rejected"],
  under_verification: ["documents_required", "approved", "rejected"],
  documents_required: ["under_verification", "rejected"],
  approved: ["completed"],
  rejected: [],
  completed: [],
};

export const updateServiceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "government_authority",
    });

    const { data: app, error: readErr } = await context.supabase
      .from("service_applications")
      .select("*")
      .eq("id", data.applicationId)
      .maybeSingle();
    if (readErr) throw new Error(`Could not read application: ${readErr.message}`);
    if (!app) throw new Error("Application not found.");

    if (!SERVICE_TRANSITIONS[app.status]?.includes(data.status)) {
      throw new Error(`Invalid transition: ${app.status} → ${data.status}`);
    }

    if (app.assigned_officer_id !== context.userId && !isAdmin && !isGov)
      throw new Error("Forbidden");

    const patch: {
      status: typeof data.status;
      last_remark: string | null;
      approved_at?: string;
      completed_at?: string;
    } = { status: data.status, last_remark: data.remarks ?? null };
    if (data.status === "approved") patch.approved_at = new Date().toISOString();
    if (data.status === "completed") patch.completed_at = new Date().toISOString();

    const { error: updateErr } = await context.supabase
      .from("service_applications")
      .update(patch)
      .eq("id", data.applicationId);
    if (updateErr) throw new Error(`Status update failed: ${updateErr.message}`);

    await context.supabase.from("service_app_timeline").insert({
      application_id: data.applicationId,
      status: data.status,
      remarks: data.remarks,
      updated_by: context.userId,
    });

    // Best-effort secondary ops
    const admin = await tryGetAdmin();
    if (admin) {
      await admin
        .from("notifications")
        .insert({
          user_id: app.citizen_id,
          title: `Application ${app.application_number}: ${data.status.replace(/_/g, " ")}`,
          link: `/citizen/services/${app.id}`,
        })
        .then(
          () => {},
          () => {},
        );
      await admin
        .from("audit_logs")
        .insert({
          actor_id: context.userId,
          action: "SERVICE_APP_STATUS_CHANGED",
          entity_type: "service_application",
          entity_id: data.applicationId,
          metadata: { from: app.status, to: data.status, remarks: data.remarks },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return { ok: true };
  });

const verifyDocSchema = z.object({
  documentId: z.string().uuid(),
  status: z.enum(["verified", "rejected"]),
  notes: z.string().max(500).optional(),
});

export const verifyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => verifyDocSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("service_app_documents")
      .update({ status: data.status, notes: data.notes ?? null })
      .eq("id", data.documentId);
    if (error) throw new Error(`Document update failed: ${error.message}`);
    return { ok: true };
  });
