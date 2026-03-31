"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MANDATE_TYPES = [
  "Strategy & Consulting",
  "Branding & Identity",
  "Rebranding",
  "Brand Guidelines",
  "Market Research & Analysis",
  "Content Production & Shoot",
  "Creative Design (Digital & Offline Collaterals)",
  "Packaging Design",
  "Social Media Marketing",
  "Performance Marketing",
  "SEO, AISEO & Content Marketing",
  "Google My Business (GMB)",
  "Reddit & Quora Marketing",
  "Influencer Marketing Management",
  "PR Management & Coordination",
  "Website Design & Development",
  "Landing Page Development",
  "E-commerce Development",
  "AMC (Annual Maintenance Contract)",
  "Third-Party Listings & Marketplace Management",
  "360° Campaigns",
  "E-commerce Support Services",
  "Wikipedia Page Creation",
];

type Client = { id: string; company_name: string };
type Employee = { id: string; full_name: string };
type Deliverable = { label: string; target: string };

export default function NewMandatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500 text-sm">Loading…</div>}>
      <NewMandateForm />
    </Suspense>
  );
}

function NewMandateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledClientId = searchParams.get("client_id") ?? "";

  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    client_id: prefilledClientId,
    mandate_type: "",
    platform: "",
    description: "",
    start_date: "",
    renewal_date: "",
    monthly_value: "",
    status: "Active",
    fulfillment_percentage: "0",
  });
  const [assignedTeam, setAssignedTeam] = useState<string[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([
    { label: "", target: "" },
  ]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const [clientsRes, empRes] = await Promise.all([
        supabase.from("clients").select("id, company_name").order("company_name"),
        supabase.from("employees").select("id, full_name").order("full_name"),
      ]);
      setClients(clientsRes.data ?? []);
      setEmployees(empRes.data ?? []);
    };
    load();
  }, []);

  const toggleTeamMember = (id: string) => {
    setAssignedTeam((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const addDeliverable = () =>
    setDeliverables((prev) => [...prev, { label: "", target: "" }]);

  const removeDeliverable = (i: number) =>
    setDeliverables((prev) => prev.filter((_, idx) => idx !== i));

  const updateDeliverable = (i: number, field: keyof Deliverable, value: string) =>
    setDeliverables((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d))
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.client_id || !form.mandate_type) {
      setError("Client and Mandate Type are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let createdById: string | null = null;
    if (user?.email) {
      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .maybeSingle();
      createdById = emp?.id ?? null;
    }

    const cleanDeliverables = deliverables.filter(
      (d) => d.label.trim() || d.target.trim()
    );

    const { data, error: err } = await supabase
      .from("mandates")
      .insert({
        client_id: form.client_id,
        mandate_type: form.mandate_type,
        platform: form.platform.trim() || null,
        description: form.description.trim() || null,
        start_date: form.start_date || null,
        renewal_date: form.renewal_date || null,
        monthly_value: form.monthly_value ? parseFloat(form.monthly_value) : null,
        status: form.status,
        fulfillment_percentage: parseInt(form.fulfillment_percentage) || 0,
        assigned_team: assignedTeam.length ? assignedTeam : null,
        deliverable_targets: cleanDeliverables.length ? cleanDeliverables : null,
        created_by: createdById,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/mandates/${data.id}`);
  };

  return (
    <div className="text-white">
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center gap-3">
        <Link
          href="/dashboard/mandates"
          className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center shrink-0"
        >
          ← Back
        </Link>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Mandates</p>
          <h1 className="text-lg font-bold text-white mt-0.5">Add Mandate</h1>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {/* Core Details */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Core Details
            </p>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Client *</label>
              <select
                value={form.client_id}
                onChange={(e) => setForm((f) => ({ ...f, client_id: e.target.value }))}
                required
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
              >
                <option value="">Select client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company_name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Mandate Type *</label>
                <select
                  value={form.mandate_type}
                  onChange={(e) => setForm((f) => ({ ...f, mandate_type: e.target.value }))}
                  required
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                >
                  <option value="">Select type…</option>
                  {MANDATE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Platform</label>
                <input
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  placeholder="e.g. Instagram, Google…"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                placeholder="Scope of work, objectives…"
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 resize-none"
              />
            </div>
          </section>

          {/* Dates & Value */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Dates & Value
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Start Date</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                  style={{ colorScheme: "dark" }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Renewal Date</label>
                <input
                  type="date"
                  value={form.renewal_date}
                  onChange={(e) => setForm((f) => ({ ...f, renewal_date: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                  style={{ colorScheme: "dark" }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Monthly Value (₹)</label>
                <input
                  type="number"
                  value={form.monthly_value}
                  onChange={(e) => setForm((f) => ({ ...f, monthly_value: e.target.value }))}
                  placeholder="e.g. 50000"
                  min="0"
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                >
                  {["Active", "Paused", "Completed", "Cancelled"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* Deliverable Targets */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                Deliverable Targets
              </p>
              <button
                type="button"
                onClick={addDeliverable}
                className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {deliverables.map((d, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={d.label}
                    onChange={(e) => updateDeliverable(i, "label", e.target.value)}
                    placeholder="Deliverable (e.g. Reels)"
                    className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 min-h-[40px]"
                  />
                  <input
                    value={d.target}
                    onChange={(e) => updateDeliverable(i, "target", e.target.value)}
                    placeholder="Target (e.g. 8/month)"
                    className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 min-h-[40px]"
                  />
                  {deliverables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDeliverable(i)}
                      className="text-zinc-600 hover:text-red-400 text-lg leading-none px-1 transition-colors"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Assigned Team */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Assigned Team
            </p>
            {employees.length === 0 ? (
              <p className="text-zinc-600 text-sm">No employees found.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {employees.map((emp) => {
                  const selected = assignedTeam.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleTeamMember(emp.id)}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors min-h-[36px] ${
                        selected
                          ? "bg-white text-black border-white font-medium"
                          : "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-white"
                      }`}
                    >
                      {emp.full_name}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {saving ? "Saving…" : "Create Mandate"}
            </button>
            <Link
              href="/dashboard/mandates"
              className="text-zinc-400 hover:text-white text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center min-h-[44px]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
