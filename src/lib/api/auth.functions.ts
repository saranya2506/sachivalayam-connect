import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const registerCitizenSchema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  mobile_number: z.string().min(5).max(20),
  address: z.string().max(300).optional(),
  village: z.string().max(120).optional(),
  password: z.string().min(8).max(72),
});

export const registerCitizen = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => registerCitizenSchema.parse(d))
  .handler(async ({ data }) => {
    // Use supabaseAdmin.auth.admin.createUser so email is pre-confirmed and
    // the user can log in immediately without an email verification step.
    // supabaseAdmin requires SUPABASE_SERVICE_ROLE_KEY in the environment.
    // If that key is unavailable (e.g. Vercel without env vars set), we fall
    // back to the standard public signUp which still works but may require
    // email confirmation depending on the project's Auth settings.
    let userId: string;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: {
          full_name: data.full_name,
          mobile_number: data.mobile_number,
          intended_role: "citizen",
        },
      });

      if (error || !created.user) throw new Error(error?.message ?? "Failed to create account");
      userId = created.user.id;

      // Ensure citizen role exists defensively (DB trigger should set it)
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: userId, role: "citizen" }, { ignoreDuplicates: true });

      // Update profile with additional details
      await supabaseAdmin
        .from("profiles")
        .update({
          full_name: data.full_name,
          mobile_number: data.mobile_number,
          address: data.address ?? null,
          village: data.village ?? null,
        })
        .eq("id", userId);
    } catch (adminErr) {
      // Service role key not available — fall back to public signup.
      // The DB trigger will assign the citizen role automatically.
      const { createClient } = await import("@supabase/supabase-js");
      const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
      const SUPABASE_ANON_KEY =
        process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        // Surface the original admin error since env vars are completely missing
        throw adminErr;
      }

      const publicClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });

      const { data: signed, error: signUpErr } = await publicClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
            mobile_number: data.mobile_number,
            intended_role: "citizen",
          },
        },
      });

      if (signUpErr || !signed.user) {
        throw new Error(signUpErr?.message ?? "Failed to create account");
      }
      userId = signed.user.id;

      // Profile update: use the user's own session if available, else skip
      // (trigger will have set full_name from user_metadata already)
    }

    return { success: true, userId };
  });
