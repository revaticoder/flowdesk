"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PRIORITY_POINTS } from "@/lib/tasks";

// ── Types ────────────────────────────────────────────────────────────────────

type Client = { id: string; company_name: string };
type Employee = { id: string; full_name: string; role: string };

type GeneratedTask = {
  _id: string;
  title: string;
  role: string;
  priority: "Urgent" | "High" | "Medium" | "Low";
  due_date: string;
  points: number;
  mandate_type: string;
  sub_mandate_name: string;
  confirmed: boolean;
  assigned_to: string | null;
};

type EditState = {
  title: string;
  role: string;
  priority: string;
  due_date: string;
  points: string;
  mandate_type: string;
  sub_mandate_name: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  "Strategist",
  "Graphic Designer",
  "Senior Graphic Designer",
  "Video Editor",
  "Junior Video Editor",
  "Copywriter",
  "Social Media Manager",
  "SEO Specialist",
  "Performance Marketer",
  "Operations Manager",
  "Digital Marketer",
];

const MANDATE_TYPES = [
  "Social Media Marketing",
  "Performance Marketing",
  "SEO",
  "Content Marketing",
  "Website Development",
  "Branding",
  "Email Marketing",
  "WhatsApp Marketing",
  "Influencer Marketing",
  "PR Management",
];

const PRIORITY_PILL: Record<string, string> = {
  Urgent: "text-red-400 bg-red-400/10 border-red-400/30",
  High: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  Medium: "text-purple-400 bg-purple-400/10 border-purple-400/30",
  Low: "text-green-400 bg-green-400/10 border-green-400/30",
};

const PRIORITY_STRIP: Record<string, string> = {
  Urgent: "bg-red-500",
  High: "bg-amber-400",
  Medium: "bg-purple-500",
  Low: "bg-green-500",
};

function getMonthOptions(): { value: string; label: string }[] {
  const opts = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    opts.push({
      value: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
    });
  }
  return opts;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SOWPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminEmpId, setAdminEmpId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  const [sowText, setSowText] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(getMonthOptions()[0].value);

  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditState | null>(null);

  // Step: 1=Paste, 2=Generating, 3=Review
  const step = generating ? 2 : tasks.length > 0 ? 3 : 1;

  useEffect(() => {
    (async () => {
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
        router.push("/dashboard");
        return;
      }
      setIsAdmin(true);
      setAdminEmpId(emp.id);

      const [{ data: clientsData }, { data: employeesData }] = await Promise.all([
        supabase.from("clients").select("id, company_name").order("company_name"),
        supabase.from("employees").select("id, full_name, role").order("full_name"),
      ]);

      setClients(clientsData ?? []);
      setEmployees(employeesData ?? []);
      setPageLoading(false);
    })();
  }, [router]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!sowText.trim()) {
      setGenError("Please paste your Scope of Work text first.");
      return;
    }
    setGenError(null);
    setGenerating(true);
    setTasks([]);
    setSavedCount(null);

    try {
      const res = await fetch("/api/sow-breakdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sowText, client: clientName, month: selectedMonth }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError(data.error ?? "Generation failed. Please try again.");
        return;
      }
      const generated = (
        data.tasks as Omit<GeneratedTask, "_id" | "confirmed" | "assigned_to">[]
      ).map((t, i) => ({
        ...t,
        _id: `gtask-${Date.now()}-${i}`,
        confirmed: false,
        assigned_to: null,
        sub_mandate_name: t.sub_mandate_name ?? "",
        points:
          Number(t.points) ||
          PRIORITY_POINTS[t.priority as keyof typeof PRIORITY_POINTS] ||
          10,
      }));
      setTasks(generated);
    } catch {
      setGenError("Network error — please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const removeTask = (id: string) =>
    setTasks((prev) => prev.filter((t) => t._id !== id));

  const assignTask = (id: string, empId: string | null) =>
    setTasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, assigned_to: empId } : t))
    );

  const confirmTask = (id: string) =>
    setTasks((prev) =>
      prev.map((t) => (t._id === id ? { ...t, confirmed: true } : t))
    );

  const startEdit = (task: GeneratedTask) => {
    setEditingId(task._id);
    setEditForm({
      title: task.title,
      role: task.role,
      priority: task.priority,
      due_date: task.due_date,
      points: String(task.points),
      mandate_type: task.mandate_type,
      sub_mandate_name: task.sub_mandate_name,
    });
  };

  const saveEdit = (id: string) => {
    if (!editForm) return;
    setTasks((prev) =>
      prev.map((t) =>
        t._id === id
          ? {
              ...t,
              title: editForm.title,
              role: editForm.role,
              priority: editForm.priority as GeneratedTask["priority"],
              due_date: editForm.due_date,
              points:
                parseInt(editForm.points) ||
                PRIORITY_POINTS[
                  editForm.priority as keyof typeof PRIORITY_POINTS
                ] ||
                10,
              mandate_type: editForm.mandate_type,
              sub_mandate_name: editForm.sub_mandate_name,
            }
          : t
      )
    );
    setEditingId(null);
    setEditForm(null);
  };

  const handleConfirmAll = async () => {
    if (!selectedClient) {
      setGenError("Please select a client before confirming tasks.");
      return;
    }
    setSaving(true);
    setGenError(null);

    const supabase = createClient();

    // Get all active mandates for this client to resolve mandate_id
    const { data: clientMandates } = await supabase
      .from("mandates")
      .select("id, mandate_type")
      .eq("client_id", selectedClient)
      .eq("status", "Active");

    const mandateMap: Record<string, string> = {};
    for (const m of clientMandates ?? []) {
      mandateMap[m.mandate_type.toLowerCase()] = m.id;
    }

    // Resolve or create sub_mandates, keyed by "mandate_id|sub_mandate_name"
    const subMandateCache: Record<string, string> = {};

    for (const t of tasks) {
      if (!t.sub_mandate_name) continue;
      const mandateId = Object.entries(mandateMap).find(([key]) =>
        t.mandate_type.toLowerCase().includes(key) || key.includes(t.mandate_type.toLowerCase())
      )?.[1] ?? null;
      if (!mandateId) continue;

      const cacheKey = `${mandateId}|${t.sub_mandate_name}`;
      if (subMandateCache[cacheKey]) continue;

      // Check if it already exists
      const { data: existing } = await supabase
        .from("sub_mandates")
        .select("id")
        .eq("mandate_id", mandateId)
        .eq("name", t.sub_mandate_name)
        .maybeSingle();

      if (existing) {
        subMandateCache[cacheKey] = existing.id;
      } else {
        const { data: created } = await supabase
          .from("sub_mandates")
          .insert({ mandate_id: mandateId, name: t.sub_mandate_name, deliverable_count: 1 })
          .select("id")
          .single();
        if (created) subMandateCache[cacheKey] = created.id;
      }
    }

    const inserts = tasks.map((t) => {
      const mandateId = Object.entries(mandateMap).find(([key]) =>
        t.mandate_type.toLowerCase().includes(key) || key.includes(t.mandate_type.toLowerCase())
      )?.[1] ?? null;
      const cacheKey = mandateId && t.sub_mandate_name ? `${mandateId}|${t.sub_mandate_name}` : null;
      return {
        title: t.title,
        task_type: t.role,
        priority: t.priority,
        status: "Not Started",
        due_date: t.due_date || null,
        points: t.points,
        client_id: selectedClient,
        mandate_id: mandateId,
        sub_mandate_id: cacheKey ? (subMandateCache[cacheKey] ?? null) : null,
        assigned_to: t.assigned_to,
        reporting_to: adminEmpId,
        created_by: adminEmpId,
        revision_count: 0,
      };
    });

    const { error: err } = await supabase.from("tasks").insert(inserts);

    if (err) {
      setGenError(err.message);
      setSaving(false);
      return;
    }

    setSavedCount(tasks.length);
    setTasks([]);
    setSowText("");
    setSaving(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const uniqueMandates = [...new Set(tasks.map((t) => t.mandate_type))];
  const clientName =
    clients.find((c) => c.id === selectedClient)?.company_name ?? "No client selected";
  const confirmedCount = tasks.filter((t) => t.confirmed).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  if (pageLoading)
    return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;
  if (!isAdmin) return null;

  return (
    <div className="text-white flex flex-col min-h-full">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Module 6
        </p>
        <h1 className="text-lg font-bold text-white mt-0.5">
          SOW AI Task Breakdown
        </h1>
      </header>

      {/* Step indicator */}
      <div className="px-4 py-3 md:px-8 border-b border-zinc-800">
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { n: 1, label: "Paste SOW" },
              { n: 2, label: "AI Breakdown" },
              { n: 3, label: "Review & Confirm" },
            ] as const
          ).map(({ n, label }, i, arr) => (
            <div key={n} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 ${step >= n ? "" : "opacity-40"}`}>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${
                    step > n
                      ? "bg-emerald-500 text-white"
                      : step === n
                      ? "bg-white text-black"
                      : "bg-zinc-700 text-zinc-500"
                  }`}
                >
                  {step > n ? "✓" : n}
                </div>
                <span
                  className={`text-xs font-medium ${
                    step === n ? "text-white" : "text-zinc-500"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <span className="text-zinc-700 text-xs">→</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Banners */}
      <div className="px-4 pt-4 md:px-8 space-y-3">
        {savedCount !== null && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-5 py-4 flex items-center gap-3">
            <span className="text-emerald-400 text-lg shrink-0">✅</span>
            <div className="flex-1 min-w-0">
              <p className="text-emerald-400 font-semibold text-sm">
                {savedCount} tasks created successfully!
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">
                They&apos;re now live on the{" "}
                <Link
                  href="/dashboard/tasks"
                  className="text-zinc-400 underline hover:text-white"
                >
                  Task Board
                </Link>
                .
              </p>
            </div>
            <button
              onClick={() => setSavedCount(null)}
              className="text-zinc-600 hover:text-white text-xl leading-none shrink-0"
            >
              ×
            </button>
          </div>
        )}

        {genError && (
          <div className="bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{genError}</p>
          </div>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex-1 px-4 py-6 md:px-8 md:py-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pb-28">
        {/* ── Left: Input panel ── */}
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Scope of Work
            </p>

            <div className="space-y-1.5">
              <label className="text-xs text-zinc-400 font-medium">
                Paste SOW / Invoice / Brief
              </label>
              <textarea
                value={sowText}
                onChange={(e) => setSowText(e.target.value)}
                placeholder={
                  "Paste your Scope of Work, invoice details, or project brief here…\n\nExample:\nClient needs 8 reels and 12 static posts per month for Instagram. Also requires weekly performance reports, one Meta Ads campaign setup, and keyword research for SEO blog content."
                }
                rows={14}
                className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">
                  Client
                </label>
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500 min-h-[42px]"
                >
                  <option value="">Select client…</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-medium">
                  Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500 min-h-[42px]"
                >
                  {getMonthOptions().map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={generating || !sowText.trim()}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors min-h-[48px] flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <span className="animate-spin inline-block">◌</span>
                  Analyzing with Claude AI…
                </>
              ) : (
                <>
                  <span>✦</span>
                  Generate tasks with AI
                </>
              )}
            </button>
          </div>

          {/* Stats card when tasks exist */}
          {tasks.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-white">{tasks.length}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Tasks</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {uniqueMandates.length}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Mandate types
                </p>
              </div>
              <div>
                <p className="text-sm font-bold text-white truncate leading-tight mt-1">
                  {clientName}
                </p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Client</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Generated task cards ── */}
        <div className="space-y-3 min-h-[200px]">
          {!generating && tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3 border border-dashed border-zinc-800 rounded-xl">
              <span className="text-5xl opacity-20">✦</span>
              <p className="text-zinc-600 text-sm text-center max-w-[220px]">
                AI-generated task cards will appear here after you click Generate
              </p>
            </div>
          )}

          {generating && (
            <div className="flex flex-col items-center justify-center py-24 gap-4 border border-zinc-800 rounded-xl bg-zinc-900/50">
              <div className="relative">
                <div className="text-violet-400 text-4xl animate-pulse">✦</div>
              </div>
              <div className="text-center space-y-1">
                <p className="text-zinc-200 text-sm font-medium">
                  Claude is reading your SOW…
                </p>
                <p className="text-zinc-600 text-xs">
                  Breaking it down into actionable tasks
                </p>
              </div>
            </div>
          )}

          {tasks.map((task) =>
            editingId === task._id ? (
              <EditCard
                key={task._id}
                editForm={editForm!}
                setEditForm={setEditForm}
                onSave={() => saveEdit(task._id)}
                onCancel={() => {
                  setEditingId(null);
                  setEditForm(null);
                }}
              />
            ) : (
              <TaskCard
                key={task._id}
                task={task}
                employees={employees}
                onEdit={() => startEdit(task)}
                onConfirm={() => confirmTask(task._id)}
                onRemove={() => removeTask(task._id)}
                onAssign={assignTask}
              />
            )
          )}
        </div>
      </div>

      {/* ── Summary bar ── */}
      {tasks.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 md:left-56 border-t border-zinc-800 bg-[#0d0d0d]/95 backdrop-blur-sm px-4 py-3 md:px-8 z-30">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
              <span className="text-xs text-zinc-500">
                <span className="text-white font-semibold">{tasks.length}</span>{" "}
                task{tasks.length !== 1 ? "s" : ""}
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500">
                <span className="text-white font-semibold">
                  {uniqueMandates.length}
                </span>{" "}
                mandate type{uniqueMandates.length !== 1 ? "s" : ""}
              </span>
              <span className="text-zinc-700">·</span>
              <span className="text-xs text-zinc-500 truncate">
                Client:{" "}
                <span className="text-white font-semibold">{clientName}</span>
              </span>
              {confirmedCount > 0 && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="text-xs text-emerald-400 font-medium">
                    {confirmedCount} confirmed
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleConfirmAll}
              disabled={saving || !selectedClient}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors min-h-[44px] shrink-0 flex items-center gap-2 whitespace-nowrap"
            >
              {saving ? (
                "Creating tasks…"
              ) : (
                <>
                  <span>✓</span>
                  Confirm all &amp; create {tasks.length} tasks
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({
  task,
  employees,
  onEdit,
  onConfirm,
  onRemove,
  onAssign,
}: {
  task: GeneratedTask;
  employees: Employee[];
  onEdit: () => void;
  onConfirm: () => void;
  onRemove: () => void;
  onAssign: (id: string, empId: string | null) => void;
}) {
  return (
    <div
      className={`bg-zinc-900 border rounded-xl overflow-hidden flex flex-col transition-colors ${
        task.confirmed
          ? "border-emerald-500/30"
          : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      {/* Priority strip */}
      <div
        className={`h-1 w-full ${PRIORITY_STRIP[task.priority] ?? "bg-zinc-600"}`}
      />

      <div className="p-4 space-y-3">
        {/* Title */}
        <div className="flex items-start gap-2">
          {task.confirmed && (
            <span className="text-emerald-400 text-sm shrink-0 mt-0.5">✓</span>
          )}
          <h3 className="text-sm font-semibold text-white leading-snug flex-1">
            {task.title}
          </h3>
        </div>

        {/* Pills row */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              PRIORITY_PILL[task.priority] ?? ""
            }`}
          >
            {task.priority}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
            {task.role}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-400">
            📅 {task.due_date}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-500">
            {task.points} pt
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">
            {task.mandate_type}
          </span>
          {task.sub_mandate_name && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">
              {task.sub_mandate_name}
            </span>
          )}
        </div>

        {/* Assign To */}
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 font-medium">Assign To</label>
          <select
            value={task.assigned_to ?? ""}
            onChange={(e) => onAssign(task._id, e.target.value || null)}
            className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-zinc-500 min-h-[32px]"
          >
            <option value="">Unassigned</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.role})
              </option>
            ))}
          </select>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {!task.confirmed && (
            <button
              onClick={onConfirm}
              className="text-[11px] font-medium text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1.5 rounded-lg hover:bg-emerald-400/20 transition-colors min-h-[30px]"
            >
              ✓ Confirm
            </button>
          )}
          <button
            onClick={onEdit}
            className="text-[11px] font-medium text-zinc-400 bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 rounded-lg hover:text-white hover:bg-zinc-700 transition-colors min-h-[30px]"
          >
            ✎ Edit
          </button>
          <button
            onClick={onRemove}
            className="text-[11px] font-medium text-zinc-600 border border-transparent hover:text-red-400 hover:border-red-400/20 hover:bg-red-400/5 px-2.5 py-1.5 rounded-lg transition-colors min-h-[30px] ml-auto"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Card ────────────────────────────────────────────────────────────────

function EditCard({
  editForm,
  setEditForm,
  onSave,
  onCancel,
}: {
  editForm: EditState;
  setEditForm: (f: EditState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const cls =
    "w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-zinc-500 min-h-[36px]";

  return (
    <div className="bg-zinc-900 border border-violet-500/40 rounded-xl p-4 space-y-3">
      <p className="text-[10px] text-violet-400 uppercase tracking-widest font-semibold">
        Editing task
      </p>

      <input
        value={editForm.title}
        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
        placeholder="Task title"
        className={cls}
      />

      <div className="grid grid-cols-2 gap-2">
        <select
          value={editForm.priority}
          onChange={(e) =>
            setEditForm({
              ...editForm,
              priority: e.target.value,
              points: String(
                PRIORITY_POINTS[
                  e.target.value as keyof typeof PRIORITY_POINTS
                ] ?? editForm.points
              ),
            })
          }
          className={cls}
        >
          {["Urgent", "High", "Medium", "Low"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <select
          value={editForm.role}
          onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
          className={cls}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={editForm.due_date}
          onChange={(e) =>
            setEditForm({ ...editForm, due_date: e.target.value })
          }
          className={cls}
          style={{ colorScheme: "dark" }}
        />
        <input
          type="number"
          value={editForm.points}
          onChange={(e) =>
            setEditForm({ ...editForm, points: e.target.value })
          }
          placeholder="Points"
          min="1"
          className={cls}
        />
      </div>

      <select
        value={editForm.mandate_type}
        onChange={(e) =>
          setEditForm({ ...editForm, mandate_type: e.target.value })
        }
        className={cls}
      >
        {MANDATE_TYPES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>

      <input
        value={editForm.sub_mandate_name}
        onChange={(e) => setEditForm({ ...editForm, sub_mandate_name: e.target.value })}
        placeholder="Sub-mandate name (e.g. 12 Instagram Reels/month)"
        className={cls}
      />

      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="text-xs font-semibold bg-white text-black px-4 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors min-h-[32px]"
        >
          Save changes
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-500 hover:text-white px-3 py-1.5 rounded-lg transition-colors min-h-[32px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
