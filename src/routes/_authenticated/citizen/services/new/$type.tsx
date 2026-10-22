import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  createServiceApplication,
  REQUIRED_DOCS,
  SERVICE_TYPES,
} from "@/lib/api/services.functions";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/citizen/services/new/$type")({
  component: NewApp,
});

const LABELS: Record<string, string> = {
  income_certificate: "Income Certificate",
  pension: "Pension Application",
  ration_card: "Ration Card",
  caste_certificate: "Caste Certificate",
  residence_certificate: "Residence Certificate",
  birth_certificate: "Birth Certificate",
  death_certificate: "Death Certificate",
};

function NewApp() {
  const { type } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const valid = (SERVICE_TYPES as readonly string[]).includes(type);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    citizenName: "",
    aadhaarNumber: "",
    mobileNumber: "",
    email: user?.email ?? "",
    address: "",
    village: "",
    mandal: "",
    district: "",
  });

  if (!valid) return <div className="p-6 text-destructive">Unknown service type.</div>;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[0-9]{12}$/.test(form.aadhaarNumber)) {
      toast.error("Aadhaar number must contain exactly 12 digits");
      return;
    }
    if (!/^[0-9]{10}$/.test(form.mobileNumber)) {
      toast.error("Mobile number must contain exactly 10 digits");
      return;
    }
    setBusy(true);
    try {
      const r = await createServiceApplication({
        data: {
          applicationType: type as (typeof SERVICE_TYPES)[number],
          citizenName: form.citizenName,
          aadhaarNumber: form.aadhaarNumber,
          mobileNumber: form.mobileNumber,
          email: form.email || null,
          address: form.address,
          village: form.village,
          mandal: form.mandal,
          district: form.district,
        },
      });
      toast.success(`Application submitted: ${r.application_number}`);
      navigate({ to: "/citizen/services/$id", params: { id: r.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      let value = e.target.value;

      if (k === "aadhaarNumber") {
        value = value.replace(/\D/g, "").slice(0, 12);
      }

      if (k === "mobileNumber") {
        value = value.replace(/\D/g, "").slice(0, 10);
      }

      setForm({ ...form, [k]: value });
    };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Apply: {LABELS[type]}</h1>
        <p className="text-sm text-muted-foreground">
          Fill in your details. You can upload required documents after submission.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <div className="text-sm font-semibold">Required documents</div>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
          {REQUIRED_DOCS[type as keyof typeof REQUIRED_DOCS].map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>

      <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label="Full name"
            required
            value={form.citizenName}
            onChange={set("citizenName")}
          />
          <Field
            label="Aadhaar number"
            required
            value={form.aadhaarNumber}
            onChange={set("aadhaarNumber")}
          />
          <Field
            label="Mobile number"
            required
            value={form.mobileNumber}
            onChange={set("mobileNumber")}
          />
          <Field label="Email" type="email" value={form.email} onChange={set("email")} />
          <Field label="Village / Ward" required value={form.village} onChange={set("village")} />
          <Field label="Mandal" required value={form.mandal} onChange={set("mandal")} />
          <Field label="District" required value={form.district} onChange={set("district")} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">
            Address <span className="text-destructive">*</span>
          </label>
          <textarea
            required
            value={form.address}
            onChange={set("address")}
            rows={3}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          disabled={busy}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        required={required}
        type={type}
        value={value}
        onChange={onChange}
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />
    </div>
  );
}
