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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Create user with admin client (bypasses email confirmation rate limits)
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true, // Mark email as confirmed so user can login immediately
      user_metadata: {
        full_name: data.full_name,
        mobile_number: data.mobile_number,
        intended_role: "citizen",
      },
    });

    if (error || !created.user) {
      throw new Error(error?.message ?? "Failed to create account");
    }

    const userId = created.user.id;

    // Explicitly ensure citizen role exists (trigger should do this, but be defensive)
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role: "citizen",
    }).onConflict("user_id,role").doNothing();

    // Update profile with additional details
    await supabaseAdmin.from("profiles").update({
      full_name: data.full_name,
      mobile_number: data.mobile_number,
      address: data.address,
      village: data.village,
    }).eq("id", userId);

    return { success: true, userId };
  });
