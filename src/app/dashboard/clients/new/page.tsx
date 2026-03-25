"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STAGES, INDUSTRIES, SOURCES } from "@/lib/clients";

type EmployeeOption = { id: string; full_name: string };

export default function AddClientPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");

  const [form, setForm] = useState({
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    industry: "",
    source: "",
    current_stage: "Lead",
    assigned_to: "",
    notes: "",
  });

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [empRes, meRes] = await Promise.all([
        supabase.from("employees").select("id, full_name").eq("is_active", true).order("full_name"),
        user
          ? supabase.from("employees").select("full_name").eq("email", user.email!).single()
          : Promise.resolve({ data: null }),
      ]);

      if (empRes.data) setEmployees(empRes.data);
      if (meRes.data) setCurrentUserName(meRes.data.full_name);
    };
    init();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const supabase = createClient();

    const { data: newClient, error: insertError } = await supabase
      .from("clients")
      .insert({
        company_name: form.company_name.trim(),
        contact_person: form.contact_person.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        industry: form.industry || null,
        source: form.source || null,
        current_stage: form.current_stage,
        assigned_to: form.assigned_to || null,
        notes: form.notes.trim() || null,
      })
      .select()
      .single();

    if (insertError || !newClient) {
      setError(insertError?.message ?? "Failed to create client");
      setSaving(false);
      return;
    }

    // Log first stage entry in history
    await supabase.from("client_stage_history").insert({
      client_id: newClient.id,
      from_stage: null,
      to_stage: form.current_stage,
      changed_by: currentUserName || "System",
      notes: "Client created",
    });

    router.push(`/dashboard/clients/${newClient.id}`);
  };

  return (
    <div className="text-white">
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center gap-3">
        <Link
          href="/dashboard/clients"
          className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center"
        >
          ← Back
        </Link>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Clients
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">Add Client</h1>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Company + Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Company Name" required>
              <input
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                required
                placeholder="e.g. Zara India"
                className={inputClass}
              />
            </Field>
            <Field label="Contact Person" required>
              <input
                name="contact_person"
                value={form.contact_person}
                onChange={handleChange}
                required
                placeholder="e.g. Rahul Mehra"
                className={inputClass}
              />
            </Field>
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Email">
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="contact@company.com"
                className={inputClass}
              />
            </Field>
            <Field label="Phone">
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className={inputClass}
              />
            </Field>
          </div>

          {/* Industry + Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Industry">
              <select name="industry" value={form.industry} onChange={handleChange} className={selectClass}>
                <option value="">Select industry</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Source">
              <select name="source" value={form.source} onChange={handleChange} className={selectClass}>
                <option value="">Select source</option>
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Initial Stage */}
          <Field label="Initial Stage" required>
            <select name="current_stage" value={form.current_stage} onChange={handleChange} required className={selectClass}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>

          {/* Assigned To */}
          <Field label="Assigned To">
            <select name="assigned_to" value={form.assigned_to} onChange={handleChange} className={selectClass}>
              <option value="">Unassigned</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              name="notes"
              value={form.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Any initial notes about this client…"
              className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 resize-none"
            />
          </Field>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-white text-black text-sm font-semibold px-6 py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {saving ? "Saving…" : "Add Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-300 font-medium mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 min-h-[44px]";

const selectClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 min-h-[44px]";
