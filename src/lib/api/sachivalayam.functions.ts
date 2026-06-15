import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// --- Admin self-registration (atomic, server-side, no privilege leak) ---
const registerAdminSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  mobileNumber: z.string().min(5).max(20),
  employeeId: z.string().min(2).max(50),
  department: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  mandal: z.string().min(1).max(100),
  villageWard: z.string().min(1).max(100),
});
export const registerAdminRequest = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registerAdminSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Employee ID must be unique across admin_registrations
    const { data: dup } = await supabaseAdmin
      .from("admin_registrations").select("id").eq("employee_id", data.employeeId).maybeSingle();
    if (dup) throw new Error("Employee ID is already registered.");

    // Create auth user — trigger inserts profile (active=false) and citizen role.
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: data.fullName,
        mobile_number: data.mobileNumber,
        intended_role: "admin",
      },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create account");

    const userId = created.user.id;

    // Ensure profile fields are set and account is inactive until approval.
    await supabaseAdmin.from("profiles").update({
      mobile_number: data.mobileNumber,
      department: data.department,
      active_status: false,
    }).eq("id", userId);

    // Always create the registration request (using service role — bypasses RLS reliably).
    const { error: regErr } = await supabaseAdmin.from("admin_registrations").insert({
      user_id: userId,
      employee_id: data.employeeId,
      district: data.district,
      mandal: data.mandal,
      village_ward: data.villageWard,
      department: data.department,
      verification_status: "pending",
    });
    if (regErr) {
      // Roll back the orphan auth user so the user can retry cleanly.
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
      throw new Error(`Failed to create approval request: ${regErr.message}`);
    }

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      actor_email: data.email,
      action: "ADMIN_REGISTRATION_SUBMITTED",
      entity_type: "admin_registration",
      entity_id: userId,
      metadata: { employee_id: data.employeeId, department: data.department },
    });
    return { ok: true };
  });


// --- Bootstrap status (public) ---
export const getBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("system_state").select("bootstrap_completed").eq("id", 1).maybeSingle();
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "government_authority");
  return { bootstrapCompleted: !!data?.bootstrap_completed, govAuthorityCount: count ?? 0 };
});

// --- Bootstrap first Government Authority ---
const bootstrapSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});
export const bootstrapGovAuthority = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("user_roles").select("*", { count: "exact", head: true }).eq("role", "government_authority");
    if ((count ?? 0) > 0) throw new Error("Government Authority is already configured.");

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, intended_role: "government_authority" },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");

    // Trigger created profile + role=government_authority (because intended_role meta)
    // Make sure role is set even if trigger inserted citizen.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "government_authority" });
    await supabaseAdmin.from("system_state").update({ bootstrap_completed: true }).eq("id", 1);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: created.user.id, actor_email: data.email,
      action: "BOOTSTRAP_GOV_AUTHORITY", entity_type: "user", entity_id: created.user.id,
    });
    return { ok: true };
  });

// --- Approve / reject admin (gov authority only) ---
const decisionSchema = z.object({
  registrationId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  remarks: z.string().max(500).optional(),
});
export const decideAdminRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => decisionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const registrationId = String(data.registrationId).trim();
    console.log("[decideAdminRegistration] start", { registrationId, decision: data.decision, actor: context.userId });

    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "government_authority",
    });
    if (!isGov) throw new Error("Forbidden: not a Government Authority");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: reg, error: regErr } = await supabaseAdmin
      .from("admin_registrations").select("*").eq("id", registrationId).maybeSingle();
    console.log("[decideAdminRegistration] lookup", { found: !!reg, regErr: regErr?.message });
    if (regErr) throw new Error(`Lookup failed: ${regErr.message}`);
    if (!reg) throw new Error(`Registration not found for id=${registrationId}`);

    const { error: updErr } = await supabaseAdmin.from("admin_registrations").update({
      verification_status: data.decision,
      verification_remarks: data.remarks ?? null,
      verification_date: new Date().toISOString(),
      verified_by: context.userId,
    }).eq("id", registrationId);
    if (updErr) throw new Error(`Update failed: ${updErr.message}`);

    if (data.decision === "approved") {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", reg.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: reg.user_id, role: "admin" });
      await supabaseAdmin.from("profiles").update({ active_status: true }).eq("id", reg.user_id);
    } else {
      await supabaseAdmin.from("profiles").update({ active_status: false }).eq("id", reg.user_id);
    }

    await supabaseAdmin.from("notifications").insert({
      user_id: reg.user_id,
      title: data.decision === "approved" ? "Admin registration approved" : "Admin registration rejected",
      body: data.remarks ?? null,
      link: "/auth",
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: `ADMIN_${data.decision.toUpperCase()}`,
      entity_type: "admin_registration", entity_id: registrationId, metadata: { remarks: data.remarks },
    });
    return { ok: true };
  });

// --- Toggle user active (gov authority only) ---
export const toggleUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "government_authority",
    });
    if (!isGov) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ active_status: data.active }).eq("id", data.userId);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: data.active ? "ENABLE_USER" : "DISABLE_USER",
      entity_type: "user", entity_id: data.userId,
    });
    return { ok: true };
  });

// --- Create officer (admin only) ---
const officerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  department: z.string().min(1).max(100),
  mobileNumber: z.string().max(20).optional(),
});
export const createOfficer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => officerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email, password: data.password, email_confirm: true,
      user_metadata: { full_name: data.fullName, intended_role: "officer", mobile_number: data.mobileNumber },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Failed to create officer");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", created.user.id);
    await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "officer" });
    await supabaseAdmin.from("profiles").update({ department: data.department }).eq("id", created.user.id);
    await supabaseAdmin.from("officers").insert({
      user_id: created.user.id, department: data.department, created_by: context.userId,
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "OFFICER_CREATED",
      entity_type: "user", entity_id: created.user.id, metadata: { department: data.department },
    });
    return { ok: true };
  });

// --- Assign / update complaint ---
const assignSchema = z.object({
  complaintId: z.string().uuid(),
  officerId: z.string().uuid(),
  remarks: z.string().max(500).optional(),
});
export const assignComplaint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { data: isGov } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "government_authority" });
    if (!isAdmin && !isGov) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Multi-admin lock: only original assigning admin or gov authority can reassign.
    const { data: existing } = await supabaseAdmin.from("complaints")
      .select("assigned_admin_id,assigned_officer_id").eq("id", data.complaintId).maybeSingle();
    if (!existing) throw new Error("Complaint not found");
    if (existing.assigned_admin_id && existing.assigned_admin_id !== context.userId && !isGov) {
      const { data: who } = await supabaseAdmin.from("profiles").select("full_name").eq("id", existing.assigned_admin_id).maybeSingle();
      throw new Error(`Already assigned by Admin ${who?.full_name ?? "another admin"}.`);
    }

    const { data: officerProfile } = await supabaseAdmin.from("profiles").select("department").eq("id", data.officerId).maybeSingle();
    const { data: complaint } = await supabaseAdmin.from("complaints")
      .update({
        assigned_officer_id: data.officerId,
        assigned_admin_id: context.userId,
        assigned_at: new Date().toISOString(),
        assignment_remarks: data.remarks ?? null,
        department: officerProfile?.department ?? null,
        status: "assigned",
        last_remark: data.remarks ?? null,
      })
      .eq("id", data.complaintId).select().single();
    if (!complaint) throw new Error("Complaint not found");
    console.log("[assignComplaint]", { complaintId: data.complaintId, officerId: data.officerId, adminId: context.userId });
    await supabaseAdmin.from("complaint_timeline").insert({
      complaint_id: data.complaintId, status: "assigned", remarks: data.remarks, updated_by: context.userId,
    });
    await supabaseAdmin.from("notifications").insert([
      { user_id: data.officerId, title: `New complaint assigned: ${complaint.complaint_number}`, link: `/complaints/${complaint.id}` },
      { user_id: complaint.citizen_id, title: `Your complaint ${complaint.complaint_number} has been assigned`, link: `/complaints/${complaint.id}` },
    ]);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "COMPLAINT_ASSIGNED",
      entity_type: "complaint", entity_id: data.complaintId, metadata: { officer_id: data.officerId, admin_id: context.userId },
    });
    return { ok: true };
  });

// --- Archive / restore admin registration (gov authority only) ---
export const archiveAdminRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ registrationId: z.string().uuid(), archive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isGov } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "government_authority" });
    if (!isGov) throw new Error("Forbidden: not a Government Authority");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("admin_registrations").update({
      archived: data.archive,
      archived_at: data.archive ? new Date().toISOString() : null,
      archived_by: data.archive ? context.userId : null,
    }).eq("id", data.registrationId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: data.archive ? "ADMIN_REG_ARCHIVED" : "ADMIN_REG_RESTORED",
      entity_type: "admin_registration", entity_id: data.registrationId,
    });
    return { ok: true };
  });

const updateStatusSchema = z.object({
  complaintId: z.string().uuid(),
  status: z.enum(["under_review", "in_progress", "resolved", "rejected"]),
  remarks: z.string().max(1000).optional(),
});
const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ["assigned"],
  assigned: ["under_review", "rejected"],
  under_review: ["in_progress", "rejected"],
  in_progress: ["resolved"],
  resolved: [],
  rejected: [],
};
export const updateComplaintStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: complaint } = await supabaseAdmin.from("complaints").select("*").eq("id", data.complaintId).maybeSingle();
    if (!complaint) throw new Error("Complaint not found");

    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const isAssigned = complaint.assigned_officer_id === context.userId;
    if (!isAdmin && !isAssigned) throw new Error("Forbidden");

    if (!VALID_TRANSITIONS[complaint.status]?.includes(data.status)) {
      throw new Error(`Invalid transition: ${complaint.status} → ${data.status}`);
    }

    await supabaseAdmin.from("complaints").update({
      status: data.status, last_remark: data.remarks ?? null,
    }).eq("id", data.complaintId);
    await supabaseAdmin.from("complaint_timeline").insert({
      complaint_id: data.complaintId, status: data.status, remarks: data.remarks, updated_by: context.userId,
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: complaint.citizen_id,
      title: `Complaint ${complaint.complaint_number}: status changed to ${data.status.replace("_", " ")}`,
      link: `/complaints/${complaint.id}`,
    });
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "COMPLAINT_STATUS_CHANGED",
      entity_type: "complaint", entity_id: data.complaintId,
      metadata: { from: complaint.status, to: data.status, remarks: data.remarks },
    });
    return { ok: true };
  });

// --- Dev-only: seed Government Authority account ONLY. ---
// Admin, Officer, and Citizen accounts must be created through the real UI workflows:
//   • Citizens self-register at /register-citizen
//   • Admins self-register at /register-admin and await Authority approval
//   • Officers are created by an approved Admin from the Admin Dashboard
export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const host = req?.headers.get("host") ?? "";
  const isDev =
    host.includes("id-preview--") || host.includes("-dev.lovable.app") ||
    host.startsWith("localhost") || host.startsWith("127.");
  if (!isDev) throw new Error("Demo seed disabled in production.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const email = "authority@sachivalayam.gov";
  const password = "Authority@123";
  const full_name = "State IT Authority";

  const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users.find((u) => u.email === email);
  let userId = found?.id;
  if (!userId) {
    const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name, intended_role: "government_authority" },
    });
    if (error || !c.user) throw new Error(error?.message ?? "Failed to create authority user");
    userId = c.user.id;
  }
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "government_authority" });
  await supabaseAdmin.from("profiles").update({ active_status: true }).eq("id", userId);
  await supabaseAdmin.from("system_state").update({ bootstrap_completed: true }).eq("id", 1);

  return { ok: true, email, password };
});
