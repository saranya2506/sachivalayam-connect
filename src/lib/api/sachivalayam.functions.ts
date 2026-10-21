import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a public Supabase client using anon key (no service role needed). */
async function publicClient() {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!url || !key) throw new Error("Missing Supabase environment variables.");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Try to get the supabaseAdmin client. Returns null if the service role key is
 * unavailable (e.g. Vercel without SUPABASE_SERVICE_ROLE_KEY set). Callers
 * should handle null gracefully for non-critical operations.
 */
async function tryGetAdmin() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return supabaseAdmin;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Admin self-registration
// ---------------------------------------------------------------------------
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
    const pub = await publicClient();

    // Employee ID uniqueness check (public anon client can read via RLS select)
    // Use supabaseAdmin if available for reliable bypass, else skip (Supabase rejects dupes)
    const admin = await tryGetAdmin();
    if (admin) {
      const { data: dup } = await admin
        .from("admin_registrations")
        .select("id")
        .eq("employee_id", data.employeeId)
        .maybeSingle();
      if (dup) throw new Error("Employee ID is already registered.");

      // Email existence check
      try {
        const { data: existingUsers } = await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        const emailTaken = existingUsers?.users?.some(
          (u) => u.email?.toLowerCase() === data.email.toLowerCase(),
        );
        if (emailTaken) throw new Error("An account with this email already exists.");
      } catch (e) {
        if (e instanceof Error && e.message.includes("already exists")) throw e;
        // Otherwise ignore — Supabase will reject duplicate email at signup
      }
    }

    // Create user — prefer admin API (auto-confirms email), fall back to public signUp
    let userId: string;
    let createdViaAdmin = false;
    if (admin) {
      try {
        const { data: created, error } = await admin.auth.admin.createUser({
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
        userId = created.user.id;
        createdViaAdmin = true;
      } catch (e) {
        if (
          e instanceof Error &&
          (e.message.includes("already") || e.message.includes("Failed to create"))
        )
          throw e;
        // Service role failed — fall through to public signUp
      }
    }

    if (!createdViaAdmin) {
      const { data: signed, error: signUpErr } = await pub.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            mobile_number: data.mobileNumber,
            intended_role: "admin",
          },
        },
      });
      if (signUpErr || !signed.user)
        throw new Error(signUpErr?.message ?? "Failed to create account");
      userId = signed.user.id;
    }

    // Best-effort: update profile and insert registration request
    if (admin) {
      await admin
        .from("profiles")
        .update({
          mobile_number: data.mobileNumber,
          department: data.department,
          active_status: false,
        })
        .eq("id", userId!);

      const { error: regErr } = await admin.from("admin_registrations").insert({
        user_id: userId!,
        employee_id: data.employeeId,
        district: data.district,
        mandal: data.mandal,
        village_ward: data.villageWard,
        department: data.department,
        verification_status: "pending",
      });
      if (regErr) {
        await admin.auth.admin.deleteUser(userId!).catch(() => {});
        throw new Error(`Failed to create approval request: ${regErr.message}`);
      }
      await admin
        .from("audit_logs")
        .insert({
          actor_id: userId!,
          actor_email: data.email,
          action: "ADMIN_REGISTRATION_SUBMITTED",
          entity_type: "admin_registration",
          entity_id: userId!,
          metadata: { employee_id: data.employeeId, department: data.department },
        })
        .then(
          () => {},
          () => {},
        );
    } else {
      // No service role — insert registration using public client after sign-in
      // The user just signed up, sign them in to get a JWT for RLS writes
      const { data: session } = await pub.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });
      if (session.session) {
        const { createClient } = await import("@supabase/supabase-js");
        const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
        const key =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
        const userClient = createClient(url, key, {
          global: {
            headers: { Authorization: `Bearer ${session.session.access_token}` },
          },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        await userClient.from("admin_registrations").insert({
          user_id: userId!,
          employee_id: data.employeeId,
          district: data.district,
          mandal: data.mandal,
          village_ward: data.villageWard,
          department: data.department,
          verification_status: "pending",
        });
        await pub.auth.signOut();
      }
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Bootstrap status (public — no auth needed)
// ---------------------------------------------------------------------------
export const getBootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const admin = await tryGetAdmin();
  if (admin) {
    const { data } = await admin
      .from("system_state")
      .select("bootstrap_completed")
      .eq("id", 1)
      .maybeSingle();
    const { count } = await admin
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "government_authority");
    return { bootstrapCompleted: !!data?.bootstrap_completed, govAuthorityCount: count ?? 0 };
  }
  // Fallback: use public anon client (system_state and user_roles have SELECT for anon/auth)
  const pub = await publicClient();
  const { data } = await pub
    .from("system_state")
    .select("bootstrap_completed")
    .eq("id", 1)
    .maybeSingle();
  const { count } = await pub
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "government_authority");
  return { bootstrapCompleted: !!data?.bootstrap_completed, govAuthorityCount: count ?? 0 };
});

// ---------------------------------------------------------------------------
// Bootstrap first Government Authority
// ---------------------------------------------------------------------------
const bootstrapSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
});

export const bootstrapGovAuthority = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data }) => {
    const pub = await publicClient();
    const admin = await tryGetAdmin();

    // Check if gov authority already exists
    const checkClient = admin ?? pub;
    const { count } = await checkClient
      .from("user_roles")
      .select("*", { count: "exact", head: true })
      .eq("role", "government_authority");
    if ((count ?? 0) > 0) throw new Error("Government Authority is already configured.");

    let userId: string;
    let createdViaAdmin = false;

    if (admin) {
      try {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
          user_metadata: { full_name: data.fullName, intended_role: "government_authority" },
        });
        if (error || !created.user) throw new Error(error?.message ?? "Failed to create user");
        userId = created.user.id;
        createdViaAdmin = true;
      } catch (e) {
        if (e instanceof Error && e.message.includes("Failed to create")) throw e;
      }
    }

    if (!createdViaAdmin) {
      const { data: signed, error: signUpErr } = await pub.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.fullName, intended_role: "government_authority" } },
      });
      if (signUpErr || !signed.user) throw new Error(signUpErr?.message ?? "Failed to create user");
      userId = signed.user.id;
    }

    if (admin) {
      await admin.from("user_roles").delete().eq("user_id", userId!);
      await admin.from("user_roles").insert({ user_id: userId!, role: "government_authority" });
      await admin.from("system_state").update({ bootstrap_completed: true }).eq("id", 1);
      await admin
        .from("audit_logs")
        .insert({
          actor_id: userId!,
          actor_email: data.email,
          action: "BOOTSTRAP_GOV_AUTHORITY",
          entity_type: "user",
          entity_id: userId!,
        })
        .then(
          () => {},
          () => {},
        );
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Approve / reject admin registration (gov authority only)
// ---------------------------------------------------------------------------
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

    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "government_authority",
    });
    if (!isGov) throw new Error("Forbidden: not a Government Authority");

    // Read registration using user JWT (gov authority SELECT RLS covers this)
    const { data: reg, error: regErr } = await context.supabase
      .from("admin_registrations")
      .select("*")
      .eq("id", registrationId)
      .maybeSingle();
    if (regErr) throw new Error(`Lookup failed: ${regErr.message}`);
    if (!reg) throw new Error("Registration not found.");

    // UPDATE admin_registrations — no RLS UPDATE policy, needs service role
    const admin = await tryGetAdmin();
    if (admin) {
      const { error: updErr } = await admin
        .from("admin_registrations")
        .update({
          verification_status: data.decision,
          verification_remarks: data.remarks ?? null,
          verification_date: new Date().toISOString(),
          verified_by: context.userId,
        })
        .eq("id", registrationId);
      if (updErr) throw new Error(`Update failed: ${updErr.message}`);

      if (data.decision === "approved") {
        await admin.from("user_roles").delete().eq("user_id", reg.user_id);
        await admin.from("user_roles").insert({ user_id: reg.user_id, role: "admin" });
        await admin.from("profiles").update({ active_status: true }).eq("id", reg.user_id);
      } else {
        await admin.from("profiles").update({ active_status: false }).eq("id", reg.user_id);
      }
      // Best-effort secondary ops
      await admin
        .from("notifications")
        .insert({
          user_id: reg.user_id,
          title:
            data.decision === "approved"
              ? "Admin registration approved"
              : "Admin registration rejected",
          body: data.remarks ?? null,
          link: "/auth",
        })
        .then(
          () => {},
          () => {},
        );
      await admin
        .from("audit_logs")
        .insert({
          actor_id: context.userId,
          action: `ADMIN_${data.decision.toUpperCase()}`,
          entity_type: "admin_registration",
          entity_id: registrationId,
          metadata: { remarks: data.remarks },
        })
        .then(
          () => {},
          () => {},
        );
    } else {
      // No service role available — we can't update admin_registrations (no UPDATE RLS)
      // or user_roles. Surface a clear error so the admin knows what to fix.
      throw new Error(
        "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set in the deployment environment. Please add it in Vercel → Settings → Environment Variables.",
      );
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Toggle user active (gov authority only)
// ---------------------------------------------------------------------------
export const toggleUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "government_authority",
    });
    if (!isGov) throw new Error("Forbidden");

    const admin = await tryGetAdmin();
    if (!admin)
      throw new Error(
        "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Please add it in Vercel → Settings → Environment Variables.",
      );

    await admin.from("profiles").update({ active_status: data.active }).eq("id", data.userId);
    await admin
      .from("audit_logs")
      .insert({
        actor_id: context.userId,
        action: data.active ? "ENABLE_USER" : "DISABLE_USER",
        entity_type: "user",
        entity_id: data.userId,
      })
      .then(
        () => {},
        () => {},
      );
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Create officer (admin only)
// ---------------------------------------------------------------------------
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
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const pub = await publicClient();
    const admin = await tryGetAdmin();

    let createdUserId: string;
    let createdViaAdmin = false;

    if (admin) {
      try {
        const { data: created, error } = await admin.auth.admin.createUser({
          email: data.email,
          password: data.password,
          email_confirm: true,
          user_metadata: {
            full_name: data.fullName,
            intended_role: "officer",
            mobile_number: data.mobileNumber,
          },
        });
        if (error || !created.user) throw new Error(error?.message ?? "Failed to create officer");
        createdUserId = created.user.id;
        createdViaAdmin = true;
      } catch (e) {
        if (e instanceof Error && e.message.includes("Failed to create")) throw e;
      }
    }

    if (!createdViaAdmin) {
      const { data: signed, error: signUpErr } = await pub.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            intended_role: "officer",
            mobile_number: data.mobileNumber,
          },
        },
      });
      if (signUpErr || !signed.user)
        throw new Error(signUpErr?.message ?? "Failed to create officer");
      createdUserId = signed.user.id;
    }

    if (admin) {
      await admin.from("user_roles").delete().eq("user_id", createdUserId!);
      await admin.from("user_roles").insert({ user_id: createdUserId!, role: "officer" });
      await admin.from("profiles").update({ department: data.department }).eq("id", createdUserId!);
      await admin.from("officers").insert({
        user_id: createdUserId!,
        department: data.department,
        created_by: context.userId,
      });
      await admin
        .from("audit_logs")
        .insert({
          actor_id: context.userId,
          action: "OFFICER_CREATED",
          entity_type: "user",
          entity_id: createdUserId!,
          metadata: { department: data.department },
        })
        .then(
          () => {},
          () => {},
        );
    } else {
      // No service role — DB trigger will assign officer role from user_metadata
      // Insert officers record using context (admin insert RLS covers officers table)
      await context.supabase.from("officers").insert({
        user_id: createdUserId!,
        department: data.department,
        created_by: context.userId,
      });
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Assign complaint (admin / gov authority)
// ---------------------------------------------------------------------------
const assignSchema = z.object({
  complaintId: z.string().uuid(),
  officerId: z.string().uuid(),
  remarks: z.string().max(500).optional(),
});

export const assignComplaint = createServerFn({ method: "POST" })
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

    // Read & update using user JWT — admin/gov RLS covers this
    const { data: existing, error: readErr } = await context.supabase
      .from("complaints")
      .select("assigned_admin_id,assigned_officer_id")
      .eq("id", data.complaintId)
      .maybeSingle();
    if (readErr) throw new Error(`Could not read complaint: ${readErr.message}`);
    if (!existing) throw new Error("Complaint not found.");

    if (existing.assigned_admin_id && existing.assigned_admin_id !== context.userId && !isGov) {
      throw new Error(
        "Already assigned by another admin. Only the original admin or Government Authority can reassign.",
      );
    }

    const { data: officerProfile } = await context.supabase
      .from("profiles")
      .select("department")
      .eq("id", data.officerId)
      .maybeSingle();

    const { data: complaint, error: updateErr } = await context.supabase
      .from("complaints")
      .update({
        assigned_officer_id: data.officerId,
        assigned_admin_id: context.userId,
        assigned_at: new Date().toISOString(),
        assignment_remarks: data.remarks ?? null,
        department: officerProfile?.department ?? null,
        status: "assigned",
        last_remark: data.remarks ?? null,
      })
      .eq("id", data.complaintId)
      .select()
      .single();
    if (updateErr) throw new Error(`Assign failed: ${updateErr.message}`);
    if (!complaint) throw new Error("Complaint update returned no data.");

    // Timeline insert using user JWT
    await context.supabase.from("complaint_timeline").insert({
      complaint_id: data.complaintId,
      status: "assigned",
      remarks: data.remarks,
      updated_by: context.userId,
    });

    // Best-effort secondary ops — don't fail the whole operation if service role is missing
    const admin = await tryGetAdmin();
    if (admin) {
      await admin
        .from("notifications")
        .insert([
          {
            user_id: data.officerId,
            title: `New complaint assigned: ${complaint.complaint_number}`,
            link: `/complaints/${complaint.id}`,
          },
          {
            user_id: complaint.citizen_id,
            title: `Your complaint ${complaint.complaint_number} has been assigned`,
            link: `/complaints/${complaint.id}`,
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
          action: "COMPLAINT_ASSIGNED",
          entity_type: "complaint",
          entity_id: data.complaintId,
          metadata: { officer_id: data.officerId, admin_id: context.userId },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Archive / restore admin registration (gov authority only)
// ---------------------------------------------------------------------------
export const archiveAdminRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ registrationId: z.string().uuid(), archive: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isGov } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "government_authority",
    });
    if (!isGov) throw new Error("Forbidden: not a Government Authority");

    const admin = await tryGetAdmin();
    if (!admin)
      throw new Error(
        "Server configuration error: SUPABASE_SERVICE_ROLE_KEY is not set. Please add it in Vercel → Settings → Environment Variables.",
      );

    const { error } = await admin
      .from("admin_registrations")
      .update({
        archived: data.archive,
        archived_at: data.archive ? new Date().toISOString() : null,
        archived_by: data.archive ? context.userId : null,
      })
      .eq("id", data.registrationId);
    if (error) throw new Error(error.message);

    await admin
      .from("audit_logs")
      .insert({
        actor_id: context.userId,
        action: data.archive ? "ADMIN_REG_ARCHIVED" : "ADMIN_REG_RESTORED",
        entity_type: "admin_registration",
        entity_id: data.registrationId,
      })
      .then(
        () => {},
        () => {},
      );

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Update complaint status (officer or admin)
// ---------------------------------------------------------------------------
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
    const { data: complaint, error: readErr } = await context.supabase
      .from("complaints")
      .select("*")
      .eq("id", data.complaintId)
      .maybeSingle();
    if (readErr) throw new Error(`Could not read complaint: ${readErr.message}`);
    if (!complaint) throw new Error("Complaint not found.");

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const isAssigned = complaint.assigned_officer_id === context.userId;
    if (!isAdmin && !isAssigned) throw new Error("Forbidden");

    if (!VALID_TRANSITIONS[complaint.status]?.includes(data.status)) {
      throw new Error(`Invalid transition: ${complaint.status} → ${data.status}`);
    }

    const { error: updateErr } = await context.supabase
      .from("complaints")
      .update({ status: data.status, last_remark: data.remarks ?? null })
      .eq("id", data.complaintId);
    if (updateErr) throw new Error(`Status update failed: ${updateErr.message}`);

    await context.supabase.from("complaint_timeline").insert({
      complaint_id: data.complaintId,
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
          user_id: complaint.citizen_id,
          title: `Complaint ${complaint.complaint_number}: status changed to ${data.status.replace(/_/g, " ")}`,
          link: `/complaints/${complaint.id}`,
        })
        .then(
          () => {},
          () => {},
        );
      await admin
        .from("audit_logs")
        .insert({
          actor_id: context.userId,
          action: "COMPLAINT_STATUS_CHANGED",
          entity_type: "complaint",
          entity_id: data.complaintId,
          metadata: { from: complaint.status, to: data.status, remarks: data.remarks },
        })
        .then(
          () => {},
          () => {},
        );
    }

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Dev-only: seed Government Authority account
// ---------------------------------------------------------------------------
export const seedDemoAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { getRequest } = await import("@tanstack/react-start/server");
  const req = getRequest();
  const host = req?.headers.get("host") ?? "";
  const isDev =
    host.includes("id-preview--") ||
    host.includes("-dev.lovable.app") ||
    host.startsWith("localhost") ||
    host.startsWith("127.");
  if (!isDev) throw new Error("Demo seed disabled in production.");

  const admin = await tryGetAdmin();
  if (!admin) throw new Error("Service role key required for seeding.");

  const email = "authority@sachivalayam.gov";
  const password = "Authority@123";
  const full_name = "State IT Authority";

  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const found = existing?.users.find((u) => u.email === email);
  let userId = found?.id;
  if (!userId) {
    const { data: c, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, intended_role: "government_authority" },
    });
    if (error || !c.user) throw new Error(error?.message ?? "Failed to create authority user");
    userId = c.user.id;
  }
  await admin.from("user_roles").delete().eq("user_id", userId);
  await admin.from("user_roles").insert({ user_id: userId, role: "government_authority" });
  await admin.from("profiles").update({ active_status: true }).eq("id", userId);
  await admin.from("system_state").update({ bootstrap_completed: true }).eq("id", 1);

  return { ok: true, email, password };
});
