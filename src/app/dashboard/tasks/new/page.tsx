"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  TASK_TYPES,
  PRIORITY_LEVELS,
  PRIORITY_POINTS,
  PRIORITY_COLOR,
} from "@/lib/tasks";

type Client = { id: string; company_name: string };
type Mandate = { id: string; mandate_type: string; client_id: string };
type Employee = { id: string; full_name: string };

// Task templates keyed by mandate_type (partial match)
const TASK_TEMPLATES: Record<string, string[]> = {
  "Social Media Marketing": [
    "Design [X] Reels",
    "Design [X] Static Posts",
    "Write [X] Captions",
    "Create Content Calendar",
    "Design [X] Story Templates",
    "Monthly Performance Report",
  ],
  "Performance Marketing": [
    "Campaign Setup - Meta Ads",
    "Campaign Setup - Google Ads",
    "Ad Creative Design",
    "Weekly Performance Report",
    "Monthly Analytics Report",
  ],
  "SEO, AISEO & Content Marketing": [
    "Keyword Research Report",
    "Write [X] Blog Posts",
    "Technical SEO Audit",
    "Backlink Outreach",
  ],
  "Website Design & Development": [
    "Homepage Design",
    "UI/UX Wireframe",
    "Frontend Development",
    "Backend Integration",
    "Testing & QA",
  ],
  "Landing Page Development": [
    "Homepage Design",
    "UI/UX Wireframe",
    "Frontend Development",
    "Backend Integration",
    "Testing & QA",
  ],
  "E-commerce Development": [
    "Homepage Design",
    "UI/UX Wireframe",
    "Frontend Development",
    "Backend Integration",
    "Testing & QA",
  ],
  "Content Production & Shoot": [
    "Shoot Planning Document",
    "Shot List Creation",
    "Video Editing - [X] Reels",
    "Color Grading",
    "Thumbnail Design",
  ],
  "Creative Design (Digital & Offline Collaterals)": [
    "Design [X] Static Posts",
    "Design [X] Reels",
    "Design [X] Story Templates",
    "Design Offline Collateral",
    "Design Banner/Hoarding",
  ],
  "Influencer Marketing Management": [
    "Influencer Research & Shortlisting",
    "Outreach & Negotiation",
    "Content Brief for Influencer",
    "Influencer Review & Approval",
    "Campaign Performance Report",
  ],
  "PR Management & Coordination": [
    "Press Release Draft",
    "Media Outreach List",
    "PR Pitch Creation",
    "Coverage Report",
  ],
  "Strategy & Consulting": [
    "Brand Strategy Document",
    "Market Research Report",
    "Competitor Analysis",
    "GTM Strategy Deck",
  ],
  "Branding & Identity": [
    "Logo Design",
    "Brand Identity Kit",
    "Brand Guidelines Document",
    "Typography & Color Palette",
  ],
};

function getTemplatesForMandate(mandateType: string): string[] {
  // Try exact match first
  if (TASK_TEMPLATES[mandateType]) return TASK_TEMPLATES[mandateType];
  // Try partial match
  const key = Object.keys(TASK_TEMPLATES).find((k) =>
    mandateType.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(mandateType.toLowerCase())
  );
  return key ? TASK_TEMPLATES[key] : [];
}

const inputClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 min-h-[44px]";
const selectClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 min-h-[44px]";

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
    <div className="space-y-1.5">
      <label className="text-xs text-zinc-400 font-medium">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export default function NewTaskPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500 text-sm">Loading…</div>}>
      <NewTaskForm />
    </Suspense>
  );
}

function NewTaskForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefilledClientId = searchParams.get("client_id") ?? "";
  const prefilledMandateId = searchParams.get("mandate_id") ?? "";

  const [clients, setClients] = useState<Client[]>([]);
  const [allMandates, setAllMandates] = useState<Mandate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [adminEmpId, setAdminEmpId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Template state
  const [showTemplates, setShowTemplates] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    client_id: prefilledClientId,
    mandate_id: prefilledMandateId,
    assigned_to: "",
    reporting_to: "",
    task_type: "",
    priority: "Medium",
    due_date: "",
    estimated_hours: "",
    points: String(PRIORITY_POINTS["Medium"]),
  });

  // Derived: mandate type for the selected mandate
  const selectedMandate = allMandates.find((m) => m.id === form.mandate_id);
  const templates = selectedMandate
    ? getTemplatesForMandate(selectedMandate.mandate_type)
    : [];

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: emp } = await supabase
        .from("employees")
        .select("id, role")
        .eq("email", user.email!)
        .maybeSingle();

      if (emp?.role !== "Admin") {
        router.push("/dashboard/tasks");
        return;
      }
      setIsAdmin(true);
      setAdminEmpId(emp.id);
      setForm((f) => ({ ...f, reporting_to: emp.id }));

      const [clientsRes, mandatesRes, empRes] = await Promise.all([
        supabase
          .from("clients")
          .select("id, company_name")
          .order("company_name"),
        supabase
          .from("mandates")
          .select("id, mandate_type, client_id")
          .eq("status", "Active")
          .order("mandate_type"),
        supabase
          .from("employees")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      setClients(clientsRes.data ?? []);
      setAllMandates(mandatesRes.data ?? []);
      setEmployees(empRes.data ?? []);
    };
    load();
  }, [router]);

  const handlePriorityChange = (priority: string) => {
    setForm((f) => ({
      ...f,
      priority,
      points: String(PRIORITY_POINTS[priority] ?? 10),
    }));
  };

  const filteredMandates = form.client_id
    ? allMandates.filter((m) => m.client_id === form.client_id)
    : allMandates;

  const applyTemplate = (templateTitle: string) => {
    setForm((f) => ({ ...f, title: templateTitle }));
    setShowTemplates(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError("Task title is required.");
      return;
    }
    if (!form.task_type) {
      setError("Task type is required.");
      return;
    }
    if (!form.assigned_to) {
      setError("Please assign this task to an employee.");
      return;
    }

    setSaving(true);
    setError(null);

    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("tasks")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        client_id: form.client_id || null,
        mandate_id: form.mandate_id || null,
        assigned_to: form.assigned_to,
        reporting_to: form.reporting_to || null,
        task_type: form.task_type,
        priority: form.priority,
        status: "Not Started",
        due_date: form.due_date || null,
        estimated_hours: form.estimated_hours
          ? parseFloat(form.estimated_hours)
          : null,
        points: parseInt(form.points) || PRIORITY_POINTS[form.priority] || 10,
        revision_count: 0,
        created_by: adminEmpId,
      })
      .select("id")
      .single();

    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    router.push(`/dashboard/tasks/${data.id}`);
  };

  if (!isAdmin && !saving) return null;

  return (
    <div className="text-white">
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center gap-3">
        <Link
          href="/dashboard/tasks"
          className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center shrink-0"
        >
          ← Back
        </Link>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Tasks
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">Add Task</h1>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl">
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-5">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Core info */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Task Details
            </p>

            {/* Title with template button */}
            <Field label="Title" required>
              <div className="relative">
                <input
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="What needs to be done?"
                  className={inputClass}
                  autoFocus
                />
                {templates.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowTemplates((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-violet-400 bg-violet-400/10 border border-violet-400/20 px-2 py-1 rounded-lg hover:bg-violet-400/20 transition-colors"
                  >
                    ✦ Templates
                  </button>
                )}
              </div>
              {/* Template dropdown */}
              {showTemplates && templates.length > 0 && (
                <div className="bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-xl">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium px-4 py-2 border-b border-zinc-700">
                    {selectedMandate?.mandate_type} — Quick Templates
                  </p>
                  <div className="divide-y divide-zinc-700/50 max-h-56 overflow-y-auto">
                    {templates.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => applyTemplate(t)}
                        className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Field>

            <Field label="Description / Brief">
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Describe the task, attach brief, or add instructions…"
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 resize-none"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Task Type" required>
                <select
                  value={form.task_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, task_type: e.target.value }))
                  }
                  className={selectClass}
                >
                  <option value="">Select type…</option>
                  {TASK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Priority">
                <select
                  value={form.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className={selectClass}
                >
                  {PRIORITY_LEVELS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Priority preview */}
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_COLOR[form.priority]}`}
              >
                {form.priority}
              </span>
              <span className="text-xs text-zinc-500">
                = {PRIORITY_POINTS[form.priority] ?? 0} base points
              </span>
            </div>
          </section>

          {/* Client + Mandate */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Client & Mandate
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Client">
                <select
                  value={form.client_id}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      client_id: e.target.value,
                      mandate_id: "",
                    }))
                  }
                  className={selectClass}
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Mandate">
                <select
                  value={form.mandate_id}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, mandate_id: e.target.value }));
                    setShowTemplates(false);
                  }}
                  className={selectClass}
                  disabled={filteredMandates.length === 0}
                >
                  <option value="">Select mandate…</option>
                  {filteredMandates.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.mandate_type}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Template hint */}
            {selectedMandate && templates.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-violet-400 bg-violet-400/5 border border-violet-400/20 rounded-lg px-3 py-2">
                <span>✦</span>
                <span>
                  <strong>{templates.length} task templates</strong> available for{" "}
                  {selectedMandate.mandate_type}. Click the{" "}
                  <strong>Templates</strong> button next to the title to use one.
                </span>
              </div>
            )}
          </section>

          {/* Assignment */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Assignment
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Assign To" required>
                <select
                  value={form.assigned_to}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, assigned_to: e.target.value }))
                  }
                  className={selectClass}
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Reporting To / Stakeholder">
                <select
                  value={form.reporting_to}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, reporting_to: e.target.value }))
                  }
                  className={selectClass}
                >
                  <option value="">Select…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.full_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </section>

          {/* Dates + Points */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Timeline & Points
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Due Date">
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, due_date: e.target.value }))
                  }
                  className={inputClass}
                  style={{ colorScheme: "dark" }}
                />
              </Field>

              <Field label="Est. Hours">
                <input
                  type="number"
                  value={form.estimated_hours}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      estimated_hours: e.target.value,
                    }))
                  }
                  placeholder="e.g. 4"
                  min="0"
                  step="0.5"
                  className={inputClass}
                />
              </Field>

              <Field label="Points">
                <input
                  type="number"
                  value={form.points}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, points: e.target.value }))
                  }
                  min="1"
                  className={inputClass}
                />
              </Field>
            </div>
          </section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-white text-black font-semibold text-sm px-6 py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {saving ? "Creating…" : "Create Task"}
            </button>
            <Link
              href="/dashboard/tasks"
              className="text-zinc-400 hover:text-white text-sm px-4 py-3 rounded-lg transition-colors min-h-[44px] flex items-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
