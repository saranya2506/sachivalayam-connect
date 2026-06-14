import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { registerAdminRequest } from "@/lib/api/sachivalayam.functions";

export const Route = createFileRoute("/register-admin")({ component: RegisterAdmin });

const schema = z.object({
  full_name: z.string().min(2).max(120),
  email: z.string().email(),
  mobile_number: z.string().min(5).max(20),
  employee_id: z.string().min(2).max(50),
  department: z.string().min(1).max(100),
  district: z.string().min(1).max(100),
  mandal: z.string().min(1).max(100),
  village_ward: z.string().min(1).max(100),
  password: z.string().min(8).max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords don't match" });

function RegisterAdmin() {
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", mobile_number: "", employee_id: "", department: "", district: "", mandal: "", village_ward: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setBusy(true);
    try {
      await registerAdminRequest({ data: {
        fullName: form.full_name, email: form.email, password: form.password,
        mobileNumber: form.mobile_number, employeeId: form.employee_id, department: form.department,
        district: form.district, mandal: form.mandal, villageWard: form.village_ward,
      }});
      toast.success("Registration submitted. Awaiting Government Authority approval.");
      nav({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold">Sachivalayam Admin Registration</h1>
        <p className="mb-5 text-sm text-muted-foreground">Verification required. You can sign in only after Government Authority approves your request.</p>
        <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {[
            ["full_name", "Full Name", "text"],
            ["email", "Email", "email"],
            ["mobile_number", "Mobile Number", "tel"],
            ["employee_id", "Employee ID", "text"],
            ["department", "Department", "text"],
            ["district", "District", "text"],
            ["mandal", "Mandal / Municipality", "text"],
            ["village_ward", "Village / Ward", "text"],
            ["password", "Password", "password"],
            ["confirm", "Confirm Password", "password"],
          ].map(([k, label, type]) => (
            <div key={k as string}>
              <label className="block text-sm font-medium">{label as string} *</label>
              <input required type={type as string} value={form[k as keyof typeof form]} onChange={upd(k as keyof typeof form)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
          <button disabled={busy} className="md:col-span-2 w-full rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
        <p className="mt-4 text-sm text-center"><Link to="/auth" className="text-primary hover:underline">Back to login</Link></p>
      </div>
    </div>
  );
}
