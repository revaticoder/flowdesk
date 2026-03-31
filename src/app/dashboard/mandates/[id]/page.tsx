"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

const STATUS_COLOR: Record<string, string> = {
  Active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Paused: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Completed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Cancelled: "text-zinc-500 bg-zinc-800 border-zinc-700",
};

type Deliverable = { label: string; target: string };

type Mandate = {
  id: string;
  client_id: string;
  mandate_type: string;
  platform: string | null;
  description: string | null;
  start_date: string | null;
  renewal_date: string | null;
  monthly_value: number | null;
  deliverable_targets: Deliverable[] | null;
  assigned_team: string[] | null;
  fulfillment_percentage: number;
  status: string;
  created_by: string | null;
  created_at: string;
  clients: { company_name: string } | null;
};

type Employee = { id: string; full_name: string };

type MandateTask = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  assignee: { full_name: string } | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function renewalCountdown(dateStr: string | null): { label: string; urgent: boolean } | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return { label: `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""} ago`, urgent: true };
  if (days === 0) return { label: "Renews today", urgent: true };
  if (days <= 30) return { label: `Renews in ${days} day${days !== 1 ? "s" : ""}`, urgent: true };
  return { label: `Renews in ${days} days`, urgent: false };
}

function CircleProgress({ pct }: { pct: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#34d399" : pct >= 40 ? "#60a5fa" : "#f59e0b";
  return (
    <svg width="140" height="140" viewBox="0 0 140 140">
      <circle cx="70" cy="70" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
      <circle
        cx="70"
        cy="70"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="66" textAnchor="middle" fontSize="28" fill="#ffffff" fontWeight="700">
        {pct}
      </text>
      <text x="70" y="86" textAnchor="middle" fontSize="12" fill="#71717a">
        fulfillment
      </text>
    </svg>
  );
}

export default function MandateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mandateTasks, setMandateTasks] = useState<MandateTask[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sliderPct, setSliderPct] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    mandate_type: "",
    platform: "",
    description: "",
    start_date: "",
    renewal_date: "",
    monthly_value: "",
    status: "Active",
  });
  const [editTeam, setEditTeam] = useState<string[]>([]);
  const [editDeliverables, setEditDeliverables] = useState<Deliverable[]>([]);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: emp } = await supabase
          .from("employees")
          .select("role")
          .eq("email", user.email)
          .maybeSingle();
        if (emp?.role === "Admin") setIsAdmin(true);
      }

      const [mandateRes, empRes, tasksRes] = await Promise.all([
        supabase
          .from("mandates")
          .select("*, clients(company_name)")
          .eq("id", id)
          .single(),
        supabase.from("employees").select("id, full_name").order("full_name"),
        supabase
          .from("tasks")
          .select("id, title, priority, status, due_date, assignee:assigned_to(full_name)")
          .eq("mandate_id", id)
          .order("due_date", { ascending: true, nullsFirst: false }),
      ]);

      if (mandateRes.data) {
        const m = mandateRes.data as Mandate;
        setMandate(m);
        setSliderPct(m.fulfillment_percentage ?? 0);
        setEditForm({
          mandate_type: m.mandate_type,
          platform: m.platform ?? "",
          description: m.description ?? "",
          start_date: m.start_date ?? "",
          renewal_date: m.renewal_date ?? "",
          monthly_value: m.monthly_value?.toString() ?? "",
          status: m.status,
        });
        setEditTeam(m.assigned_team ?? []);
        setEditDeliverables(
          m.deliverable_targets?.length
            ? m.deliverable_targets
            : [{ label: "", target: "" }]
        );
      }
      setEmployees(empRes.data ?? []);
      setMandateTasks((tasksRes.data as unknown as MandateTask[]) ?? []);
      setLoading(false);
    };
    load();
  }, [id]);

  const updateFulfillment = async (newPct: number) => {
    const supabase = createClient();
    await supabase
      .from("mandates")
      .update({ fulfillment_percentage: newPct })
      .eq("id", id);
    setMandate((prev) => prev ? { ...prev, fulfillment_percentage: newPct } : prev);
  };

  const toggleEditTeam = (empId: string) => {
    setEditTeam((prev) =>
      prev.includes(empId) ? prev.filter((x) => x !== empId) : [...prev, empId]
    );
  };

  const addEditDeliverable = () =>
    setEditDeliverables((prev) => [...prev, { label: "", target: "" }]);

  const removeEditDeliverable = (i: number) =>
    setEditDeliverables((prev) => prev.filter((_, idx) => idx !== i));

  const updateEditDeliverable = (i: number, field: keyof Deliverable, value: string) =>
    setEditDeliverables((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, [field]: value } : d))
    );

  const handleSaveEdit = async () => {
    if (!editForm.mandate_type) {
      setError("Mandate Type is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const supabase = createClient();
    const cleanDeliverables = editDeliverables.filter(
      (d) => d.label.trim() || d.target.trim()
    );
    const { error: err } = await supabase
      .from("mandates")
      .update({
        mandate_type: editForm.mandate_type,
        platform: editForm.platform.trim() || null,
        description: editForm.description.trim() || null,
        start_date: editForm.start_date || null,
        renewal_date: editForm.renewal_date || null,
        monthly_value: editForm.monthly_value ? parseFloat(editForm.monthly_value) : null,
        status: editForm.status,
        assigned_team: editTeam.length ? editTeam : null,
        deliverable_targets: cleanDeliverables.length ? cleanDeliverables : null,
      })
      .eq("id", id);

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    // Refresh mandate
    const { data } = await supabase
      .from("mandates")
      .select("*, clients(company_name)")
      .eq("id", id)
      .single();
    if (data) setMandate(data as Mandate);
    setEditing(false);
    setSaving(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    const supabase = createClient();
    // Delete linked tasks first
    await supabase.from("tasks").delete().eq("mandate_id", id);
    // Delete mandate
    await supabase.from("mandates").delete().eq("id", id);
    router.push("/dashboard/mandates");
  };

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;
  if (!mandate) {
    return (
      <div className="p-8">
        <p className="text-zinc-400 text-sm">Mandate not found.</p>
        <Link href="/dashboard/mandates" className="text-zinc-500 hover:text-white text-sm mt-2 inline-block">
          ← Back
        </Link>
      </div>
    );
  }

  const countdown = renewalCountdown(mandate.renewal_date);
  const teamNames = (mandate.assigned_team ?? [])
    .map((empId) => employees.find((e) => e.id === empId)?.full_name)
    .filter(Boolean) as string[];

  return (
    <div className="text-white">
      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h2 className="text-white font-semibold text-base">Delete mandate?</h2>
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">{mandate.mandate_type}</span>? This will also
              delete all tasks linked to this mandate. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-white px-4 py-2 rounded-lg transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded-lg transition-colors min-h-[40px] disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/mandates"
            className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center shrink-0"
          >
            ← Back
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              {mandate.clients?.company_name ?? "Mandate"}
            </p>
            <h1 className="text-lg font-bold text-white mt-0.5 truncate">{mandate.mandate_type}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
              STATUS_COLOR[mandate.status] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"
            }`}
          >
            {mandate.status}
          </span>
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-zinc-400 hover:text-white text-sm border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors min-h-[36px]"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl space-y-6">
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Fulfillment + Quick Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Circular progress */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 flex flex-col items-center gap-4">
            <CircleProgress pct={mandate.fulfillment_percentage} />
            <div className="w-full space-y-2">
              <input
                type="range"
                min={0}
                max={100}
                value={sliderPct}
                onChange={(e) => setSliderPct(parseInt(e.target.value))}
                onMouseUp={() => updateFulfillment(sliderPct)}
                onTouchEnd={() => updateFulfillment(sliderPct)}
                className="w-full accent-emerald-400 cursor-pointer"
              />
              <div className="flex justify-between text-xs text-zinc-600">
                <span>0%</span>
                <span className="text-zinc-400">{sliderPct}%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          {/* Key info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
              Details
            </p>
            <div className="divide-y divide-zinc-800/60">
              <Row label="Client">
                <Link
                  href={`/dashboard/clients/${mandate.client_id}`}
                  className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                >
                  {mandate.clients?.company_name ?? "—"}
                </Link>
              </Row>
              {mandate.platform && <Row label="Platform">{mandate.platform}</Row>}
              {mandate.monthly_value != null && (
                <Row label="Monthly Value">
                  ₹{mandate.monthly_value.toLocaleString("en-IN")}
                </Row>
              )}
              {mandate.start_date && (
                <Row label="Start Date">{fmtDate(mandate.start_date)}</Row>
              )}
              {mandate.renewal_date && (
                <Row label="Renewal">
                  <span className={countdown?.urgent ? "text-red-400" : "text-zinc-300"}>
                    {fmtDate(mandate.renewal_date)}
                    {countdown && (
                      <span className="ml-2 text-xs opacity-75">({countdown.label})</span>
                    )}
                  </span>
                </Row>
              )}
              {mandate.created_by && (
                <Row label="Created By">
                  {employees.find((e) => e.id === mandate.created_by)?.full_name ?? mandate.created_by}
                </Row>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {mandate.description && !editing && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-2">
              Description
            </p>
            <p className="text-zinc-300 text-sm leading-relaxed">{mandate.description}</p>
          </div>
        )}

        {/* Deliverables */}
        {(mandate.deliverable_targets ?? []).length > 0 && !editing && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
              Deliverable Targets
            </p>
            <div className="divide-y divide-zinc-800/60">
              {mandate.deliverable_targets!.map((d, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <span className="text-zinc-300 text-sm">{d.label}</span>
                  <span className="text-zinc-500 text-sm font-medium">{d.target}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team */}
        {teamNames.length > 0 && !editing && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
              Assigned Team
            </p>
            <div className="flex flex-wrap gap-2">
              {teamNames.map((name) => (
                <span
                  key={name}
                  className="text-sm bg-zinc-800 text-zinc-300 border border-zinc-700 px-3 py-1.5 rounded-lg"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Tasks Section */}
        {!editing && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                  Tasks
                </p>
                {mandateTasks.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-32 bg-zinc-800 rounded-full h-1.5">
                      <div
                        className="bg-emerald-400 h-1.5 rounded-full"
                        style={{
                          width: `${Math.round(
                            (mandateTasks.filter((t) => t.status === "Completed").length /
                              mandateTasks.length) *
                              100
                          )}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500">
                      {mandateTasks.filter((t) => t.status === "Completed").length}/{mandateTasks.length} done
                    </span>
                  </div>
                )}
              </div>
              {isAdmin && (
                <Link
                  href={`/dashboard/tasks/new?mandate_id=${id}&client_id=${mandate.client_id}`}
                  className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Add Task
                </Link>
              )}
            </div>
            {mandateTasks.length === 0 ? (
              <div className="px-5 py-6 text-center">
                <p className="text-zinc-600 text-sm">No tasks for this mandate yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800/60">
                {mandateTasks.map((t) => (
                  <Link
                    key={t.id}
                    href={`/dashboard/tasks/${t.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        t.priority === "Urgent"
                          ? "bg-red-500"
                          : t.priority === "High"
                          ? "bg-orange-400"
                          : t.priority === "Medium"
                          ? "bg-yellow-400"
                          : "bg-green-400"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${t.status === "Completed" ? "text-zinc-500 line-through" : "text-white"}`}>
                        {t.title}
                      </p>
                      <p className="text-xs text-zinc-600 truncate">
                        {t.assignee?.full_name ?? "Unassigned"}
                        {t.due_date && <> · {new Date(t.due_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</>}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border shrink-0 ${
                        t.status === "Completed"
                          ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                          : t.status === "In Review"
                          ? "text-violet-400 bg-violet-400/10 border-violet-400/20"
                          : t.status === "In Progress"
                          ? "text-blue-400 bg-blue-400/10 border-blue-400/20"
                          : t.status === "Revision Requested"
                          ? "text-orange-400 bg-orange-400/10 border-orange-400/20"
                          : "text-zinc-400 bg-zinc-400/10 border-zinc-400/20"
                      }`}
                    >
                      {t.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Form */}
        {editing && (
          <div className="space-y-5">
            {/* Core edit */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                Edit Details
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Mandate Type *</label>
                  <select
                    value={editForm.mandate_type}
                    onChange={(e) => setEditForm((f) => ({ ...f, mandate_type: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                  >
                    {MANDATE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Platform</label>
                  <input
                    value={editForm.platform}
                    onChange={(e) => setEditForm((f) => ({ ...f, platform: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-zinc-400">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 resize-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Start Date</label>
                  <input
                    type="date"
                    value={editForm.start_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                    style={{ colorScheme: "dark" }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Renewal Date</label>
                  <input
                    type="date"
                    value={editForm.renewal_date}
                    onChange={(e) => setEditForm((f) => ({ ...f, renewal_date: e.target.value }))}
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
                    value={editForm.monthly_value}
                    onChange={(e) => setEditForm((f) => ({ ...f, monthly_value: e.target.value }))}
                    min="0"
                    className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-zinc-400">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                  >
                    {["Active", "Paused", "Completed", "Cancelled"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Deliverables edit */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                  Deliverable Targets
                </p>
                <button
                  type="button"
                  onClick={addEditDeliverable}
                  className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
                >
                  + Add
                </button>
              </div>
              <div className="space-y-2">
                {editDeliverables.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={d.label}
                      onChange={(e) => updateEditDeliverable(i, "label", e.target.value)}
                      placeholder="Deliverable"
                      className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 min-h-[40px]"
                    />
                    <input
                      value={d.target}
                      onChange={(e) => updateEditDeliverable(i, "target", e.target.value)}
                      placeholder="Target"
                      className="flex-1 bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 min-h-[40px]"
                    />
                    {editDeliverables.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeEditDeliverable(i)}
                        className="text-zinc-600 hover:text-red-400 text-lg leading-none px-1 transition-colors"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Team edit */}
            <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                Assigned Team
              </p>
              <div className="flex flex-wrap gap-2">
                {employees.map((emp) => {
                  const selected = editTeam.includes(emp.id);
                  return (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => toggleEditTeam(emp.id)}
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
            </section>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="bg-white text-black font-semibold text-sm px-6 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={() => { setEditing(false); setError(null); }}
                className="text-zinc-400 hover:text-white text-sm px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="text-red-500 hover:text-red-400 text-sm px-4 py-2.5 rounded-lg transition-colors min-h-[44px] ml-auto"
              >
                Delete Mandate
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start px-5 py-3">
      <p className="text-zinc-500 text-sm w-28 shrink-0">{label}</p>
      <div className="text-white text-sm">{children}</div>
    </div>
  );
}
