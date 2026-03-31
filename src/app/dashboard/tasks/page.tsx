"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  TASK_STATUSES,
  PRIORITY_COLOR,
  STATUS_COLOR,
  PRIORITY_POINTS,
  initials,
  dueDateClass,
  dueDateLabel,
} from "@/lib/tasks";

type Task = {
  id: string;
  title: string;
  client_id: string | null;
  mandate_id: string | null;
  assigned_to: string | null;
  reporting_to: string | null;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  points: number;
  revision_count: number;
  clients: { company_name: string } | null;
  mandates: { mandate_type: string } | null;
  assignee: { id: string; full_name: string } | null;
  reporter: { id: string; full_name: string } | null;
};

type Employee = { id: string; full_name: string };
type Client = { id: string; company_name: string };

// Priority → top strip colour
const PRIORITY_STRIP: Record<string, string> = {
  Urgent: "bg-red-500",
  High: "bg-orange-400",
  Medium: "bg-yellow-400",
  Low: "bg-green-500",
};

// Status progress step (0–4), matching TASK_STATUSES order
const STATUS_STEP: Record<string, number> = {
  "Not Started": 0,
  "In Progress": 1,
  "In Review": 2,
  "Revision Requested": 3,
  Completed: 4,
};

// Admin status section colours
const SECTION_STYLES: Record<
  string,
  { header: string; dot: string; border: string }
> = {
  "Not Started": {
    header: "text-zinc-400",
    dot: "bg-zinc-500",
    border: "border-zinc-700/40",
  },
  "In Progress": {
    header: "text-blue-400",
    dot: "bg-blue-500",
    border: "border-blue-500/20",
  },
  "In Review": {
    header: "text-violet-400",
    dot: "bg-violet-500",
    border: "border-violet-500/20",
  },
  "Revision Requested": {
    header: "text-orange-400",
    dot: "bg-orange-500",
    border: "border-orange-500/20",
  },
  Completed: {
    header: "text-emerald-400",
    dot: "bg-emerald-500",
    border: "border-emerald-500/20",
  },
};

export default function TasksPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentEmpId, setCurrentEmpId] = useState<string | null>(null);
  const [currentEmpRole, setCurrentEmpRole] = useState<string>("");

  // Filters (admin only)
  const [search, setSearch] = useState("");
  const [filterClient, setFilterClient] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Inline status updating
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

      const admin = emp?.role === "Admin";
      if (emp) {
        setCurrentEmpId(emp.id);
        setCurrentEmpRole(emp.role ?? "");
        if (admin) setIsAdmin(true);
      }

      // Step 1: fetch raw tasks (no joins) — works even if FK relationships aren't configured
      const rawTasksQuery = supabase
        .from("tasks")
        .select("id, title, client_id, mandate_id, assigned_to, reporting_to, task_type, priority, status, due_date, points, revision_count")
        .order("due_date", { ascending: true, nullsFirst: false });

      const [rawTasksRes, empRes, clientsRes] = await Promise.all([
        admin ? rawTasksQuery : rawTasksQuery.eq("assigned_to", emp?.id ?? ""),
        supabase.from("employees").select("id, full_name").order("full_name"),
        supabase.from("clients").select("id, company_name").order("company_name"),
      ]);

      console.log("[TaskBoard] user:", user.email, "| admin:", admin, "| emp:", emp?.id);
      console.log("[TaskBoard] raw tasks error:", rawTasksRes.error?.message);
      console.log("[TaskBoard] raw tasks count:", rawTasksRes.data?.length ?? "null");

      if (rawTasksRes.error || !rawTasksRes.data) {
        // Still failing — this is an RLS block. Log the full error for diagnosis.
        console.error("[TaskBoard] BLOCKED — likely RLS. Full error:", rawTasksRes.error);
        setLoading(false);
        return;
      }

      // Step 2: enrich tasks with client names, employee names from already-fetched lists
      const empMap = Object.fromEntries((empRes.data ?? []).map((e) => [e.id, e.full_name]));
      const clientMap = Object.fromEntries((clientsRes.data ?? []).map((c) => [c.id, c.company_name]));

      const enriched = rawTasksRes.data.map((t) => ({
        ...t,
        clients: t.client_id ? { company_name: clientMap[t.client_id] ?? null } : null,
        mandates: null, // mandate_type loaded separately on task detail page
        assignee: t.assigned_to ? { id: t.assigned_to, full_name: empMap[t.assigned_to] ?? "Unknown" } : null,
        reporter: t.reporting_to ? { id: t.reporting_to, full_name: empMap[t.reporting_to] ?? "Unknown" } : null,
      }));

      setTasks(enriched as unknown as Task[]);
      setEmployees(empRes.data ?? []);
      setClients(clientsRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [router]);

  const handleStatusUpdate = async (
    taskId: string,
    newStatus: string,
    task: Task
  ) => {
    setUpdatingId(taskId);
    const supabase = createClient();
    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "Revision Requested") {
      updates.revision_count = (task.revision_count ?? 0) + 1;
    }

    await supabase.from("tasks").update(updates).eq("id", taskId);

    // Award points on completion
    if (newStatus === "Completed" && task.assigned_to) {
      const basePoints = task.points ?? PRIORITY_POINTS[task.priority] ?? 10;
      const inserts: {
        employee_id: string;
        task_id: string;
        points: number;
        reason: string;
      }[] = [
        {
          employee_id: task.assigned_to,
          task_id: task.id,
          points: basePoints,
          reason: `completed_${task.priority.toLowerCase()}`,
        },
      ];
      if (task.due_date && new Date() <= new Date(task.due_date)) {
        inserts.push({
          employee_id: task.assigned_to,
          task_id: task.id,
          points: 5,
          reason: "early_completion",
        });
      }
      if ((task.revision_count ?? 0) === 0) {
        inserts.push({
          employee_id: task.assigned_to,
          task_id: task.id,
          points: 10,
          reason: "zero_revision",
        });
      }
      await supabase.from("employee_points").insert(inserts);
    }

    // Deduct points for revision
    if (newStatus === "Revision Requested" && task.assigned_to) {
      await supabase.from("employee_points").insert({
        employee_id: task.assigned_to,
        task_id: task.id,
        points: -3,
        reason: "revision_requested",
      });
    }

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: newStatus,
              revision_count:
                newStatus === "Revision Requested"
                  ? (t.revision_count ?? 0) + 1
                  : t.revision_count,
            }
          : t
      )
    );
    setUpdatingId(null);
  };

  const handleDeleteTask = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("employee_points").delete().eq("task_id", deleteTarget.id);
    await supabase.from("tasks").delete().eq("id", deleteTarget.id);
    setTasks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const filtered = useMemo(() => {
    if (!isAdmin) return tasks; // Employee sees all their tasks (already filtered by DB)
    return tasks.filter((t) => {
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterClient && t.client_id !== filterClient) return false;
      if (filterAssignee && t.assigned_to !== filterAssignee) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
  }, [
    tasks,
    search,
    filterClient,
    filterAssignee,
    filterPriority,
    filterStatus,
    isAdmin,
  ]);

  const overdueCnt = tasks.filter(
    (t) =>
      t.status !== "Completed" &&
      t.due_date &&
      new Date(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0))
  ).length;

  if (loading)
    return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;

  // ── Employee view ──────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <EmployeeView
        tasks={filtered}
        currentEmpId={currentEmpId}
        currentEmpRole={currentEmpRole}
        updatingId={updatingId}
        onStatusUpdate={handleStatusUpdate}
        overdueCnt={overdueCnt}
      />
    );
  }

  // ── Admin view ─────────────────────────────────────────────────────────────
  return (
    <div className="text-white flex flex-col min-h-full">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h2 className="text-white font-semibold text-base">Delete task?</h2>
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">&ldquo;{deleteTarget.title}&rdquo;</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-white px-4 py-2 rounded-lg transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
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
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Tasks
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
            Task Board
            {overdueCnt > 0 && (
              <span className="text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                {overdueCnt} overdue
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/tasks/leaderboard"
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 border border-zinc-700 rounded-lg hover:text-white hover:border-zinc-500 transition-colors min-h-[36px] flex items-center"
          >
            🏆 Leaderboard
          </Link>
          <Link
            href="/dashboard/tasks/new"
            className="px-4 py-2 text-sm font-semibold bg-white text-black rounded-lg hover:bg-zinc-200 transition-colors min-h-[36px] flex items-center"
          >
            + Add Task
          </Link>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 md:px-8 border-b border-zinc-800 flex gap-2 flex-wrap items-center">
        <input
          type="text"
          placeholder="Search tasks…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 min-h-[36px] w-44"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 min-h-[36px]"
        >
          <option value="">All Statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 min-h-[36px]"
        >
          <option value="">All Clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.company_name}
            </option>
          ))}
        </select>
        <select
          value={filterAssignee}
          onChange={(e) => setFilterAssignee(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 min-h-[36px]"
        >
          <option value="">All Assignees</option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.full_name}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-zinc-500 min-h-[36px]"
        >
          <option value="">All Priorities</option>
          {["Urgent", "High", "Medium", "Low"].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {(search ||
          filterClient ||
          filterAssignee ||
          filterPriority ||
          filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterClient("");
              setFilterAssignee("");
              setFilterPriority("");
              setFilterStatus("");
            }}
            className="text-xs text-zinc-500 hover:text-white transition-colors min-h-[36px] px-2"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-zinc-600 ml-auto">
          {filtered.length} task{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Admin placard board grouped by status */}
      <div className="flex-1 px-4 py-6 md:px-8 md:py-8 space-y-8">
        {TASK_STATUSES.map((status) => {
          const group = filtered.filter((t) => t.status === status);
          if (group.length === 0) return null;
          const style = SECTION_STYLES[status];
          return (
            <section key={status}>
              <div className="flex items-center gap-2 mb-4">
                <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                <h2
                  className={`text-xs font-bold uppercase tracking-widest ${style.header}`}
                >
                  {status}
                </h2>
                <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full font-medium">
                  {group.length}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {group.map((task) => (
                  <PlacardCard
                    key={task.id}
                    task={task}
                    isAdmin={true}
                    currentEmpId={currentEmpId}
                    currentEmpRole={currentEmpRole}
                    updatingId={updatingId}
                    onStatusUpdate={handleStatusUpdate}
                    onDelete={(id, title) => setDeleteTarget({ id, title })}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-zinc-600 text-sm">No tasks found</p>
            <Link
              href="/dashboard/tasks/new"
              className="text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 px-4 py-2 rounded-lg transition-colors"
            >
              + Create first task
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Employee View ────────────────────────────────────────────────────────────

function EmployeeView({
  tasks,
  currentEmpId,
  currentEmpRole,
  updatingId,
  onStatusUpdate,
  overdueCnt,
}: {
  tasks: Task[];
  currentEmpId: string | null;
  currentEmpRole: string;
  updatingId: string | null;
  onStatusUpdate: (id: string, status: string, task: Task) => void;
  overdueCnt: number;
}) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 86400000);
  const weekEnd = new Date(today.getTime() + 7 * 86400000);

  const active = tasks.filter((t) => t.status !== "Completed");
  const overdue = active.filter(
    (t) => t.due_date && new Date(t.due_date) < today
  );
  const dueToday = active.filter((t) => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= today && d < tomorrow;
  });
  const thisWeek = active.filter((t) => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= tomorrow && d < weekEnd;
  });
  const upcoming = active.filter((t) => {
    if (!t.due_date) return false;
    return new Date(t.due_date) >= weekEnd;
  });
  const noDate = active.filter((t) => !t.due_date);
  const completed = tasks.filter((t) => t.status === "Completed").slice(0, 6);

  const sections = [
    {
      key: "overdue",
      label: "🚨 OVERDUE",
      headerClass: "text-red-400",
      dotClass: "bg-red-500",
      tasks: overdue,
    },
    {
      key: "today",
      label: "📅 DUE TODAY",
      headerClass: "text-orange-400",
      dotClass: "bg-orange-400",
      tasks: dueToday,
    },
    {
      key: "week",
      label: "📋 THIS WEEK",
      headerClass: "text-yellow-400",
      dotClass: "bg-yellow-400",
      tasks: thisWeek,
    },
    {
      key: "upcoming",
      label: "📦 UPCOMING",
      headerClass: "text-zinc-400",
      dotClass: "bg-zinc-500",
      tasks: upcoming,
    },
    {
      key: "nodate",
      label: "📌 NO DUE DATE",
      headerClass: "text-zinc-500",
      dotClass: "bg-zinc-600",
      tasks: noDate,
    },
    {
      key: "completed",
      label: "✅ RECENTLY COMPLETED",
      headerClass: "text-emerald-400",
      dotClass: "bg-emerald-500",
      tasks: completed,
    },
  ].filter((s) => s.tasks.length > 0);

  return (
    <div className="text-white flex flex-col min-h-full">
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Tasks
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5 flex items-center gap-2">
            My Tasks
            {overdueCnt > 0 && (
              <span className="text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
                {overdueCnt} overdue
              </span>
            )}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/tasks/my"
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 border border-zinc-700 rounded-lg hover:text-white hover:border-zinc-500 transition-colors min-h-[36px] flex items-center"
          >
            🏆 My Stats
          </Link>
          <Link
            href="/dashboard/tasks/leaderboard"
            className="px-3 py-1.5 text-xs font-medium text-zinc-400 border border-zinc-700 rounded-lg hover:text-white hover:border-zinc-500 transition-colors min-h-[36px] flex items-center"
          >
            Leaderboard
          </Link>
        </div>
      </header>

      <div className="flex-1 px-4 py-6 md:px-8 md:py-8 space-y-8">
        {sections.map((section) => (
          <section key={section.key}>
            <div className="flex items-center gap-2 mb-4">
              <h2
                className={`text-xs font-bold uppercase tracking-widest ${section.headerClass}`}
              >
                {section.label}
              </h2>
              <span className="text-xs text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded-full font-medium">
                {section.tasks.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {section.tasks.map((task) => (
                <PlacardCard
                  key={task.id}
                  task={task}
                  isAdmin={false}
                  currentEmpId={currentEmpId}
                  currentEmpRole={currentEmpRole}
                  updatingId={updatingId}
                  onStatusUpdate={onStatusUpdate}
                />
              ))}
            </div>
          </section>
        ))}

        {sections.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <p className="text-4xl">🎉</p>
            <p className="text-zinc-400 font-medium">All caught up!</p>
            <p className="text-zinc-600 text-sm">No tasks assigned to you.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Placard Card ─────────────────────────────────────────────────────────────

function PlacardCard({
  task,
  isAdmin,
  currentEmpId,
  currentEmpRole,
  updatingId,
  onStatusUpdate,
  onDelete,
}: {
  task: Task;
  isAdmin: boolean;
  currentEmpId: string | null;
  currentEmpRole: string;
  updatingId: string | null;
  onStatusUpdate: (id: string, status: string, task: Task) => void;
  onDelete?: (id: string, title: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const ddClass = dueDateClass(task.due_date, task.status);
  const ddLabel = dueDateLabel(task.due_date, task.status);
  const isUpdating = updatingId === task.id;

  const isAssignee = task.assigned_to === currentEmpId;
  const isReporter = task.reporting_to === currentEmpId;
  const canApprove = isAdmin || isReporter;

  // Progress: 5 positions matching TASK_STATUSES order
  const step = STATUS_STEP[task.status] ?? 0;
  const isRevision = task.status === "Revision Requested";

  // Build valid next-status transitions for "Update Status" dropdown
  type ActionBtn = { label: string; status: string };
  const actionButtons: ActionBtn[] = [];

  if (task.status !== "Completed") {
    if ((isAssignee || isAdmin) && task.status === "Not Started")
      actionButtons.push({ label: "▶ Start Working", status: "In Progress" });
    if ((isAssignee || isAdmin) && task.status === "In Progress")
      actionButtons.push({ label: "↑ Submit for Review", status: "In Review" });
    if ((isAssignee || isAdmin) && task.status === "Revision Requested")
      actionButtons.push({ label: "🔄 Resume Work", status: "In Progress" });
    if (canApprove && task.status === "In Review") {
      actionButtons.push({ label: "✅ Approve & Complete", status: "Completed" });
      actionButtons.push({ label: "🔄 Request Revision", status: "Revision Requested" });
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col hover:border-zinc-700 transition-colors">
      {/* Priority colour strip */}
      <div className={`h-1.5 w-full ${PRIORITY_STRIP[task.priority] ?? "bg-zinc-600"}`} />

      <div className="p-4 flex flex-col flex-1 gap-3">
        {/* Row 1: Priority badge + revision count + points */}
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[task.priority]}`}>
            {task.priority}
          </span>
          <div className="flex items-center gap-1.5">
            {(task.revision_count ?? 0) > 0 && (
              <span className="text-[10px] text-orange-400 font-semibold">
                🔄 ×{task.revision_count}
              </span>
            )}
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
              {task.points ?? PRIORITY_POINTS[task.priority] ?? 0} pt
            </span>
          </div>
        </div>

        {/* Row 2: Title */}
        <div>
          <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
            {task.title}
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5 truncate">
            {task.clients?.company_name ?? "—"}
            {task.mandates?.mandate_type && (
              <span className="text-zinc-600"> · {task.mandates.mandate_type}</span>
            )}
          </p>
        </div>

        {/* Row 3: Assignee + Reporter (stakeholders) */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300 shrink-0 ring-1 ring-zinc-600">
              {task.assignee ? initials(task.assignee.full_name) : "?"}
            </div>
            {task.assigned_to ? (
              <span className="text-zinc-300 truncate max-w-[90px]">
                {task.assignee?.full_name}
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400">
                Unassigned
              </span>
            )}
          </div>
          {task.reporter && (
            <div className="flex items-center gap-1 min-w-0">
              <span className="text-zinc-700 text-[10px]">reports to</span>
              <div className="w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500 shrink-0 ring-1 ring-zinc-700">
                {initials(task.reporter.full_name)}
              </div>
              <span className="truncate max-w-[70px] text-zinc-500 text-[11px]">
                {task.reporter.full_name}
              </span>
            </div>
          )}
        </div>

        {/* Row 4: Due date */}
        <div className="flex items-center gap-1.5">
          {task.due_date ? (
            <>
              <span className="text-zinc-600 text-xs">📅</span>
              <span className={`text-xs font-medium ${ddClass}`}>{ddLabel}</span>
            </>
          ) : (
            <span className="text-xs text-zinc-700">No due date</span>
          )}
        </div>

        {/* Row 5: Progress bar (1/5 → 5/5) */}
        <div>
          <div className="flex items-center gap-0.5 mb-1">
            {[0, 1, 2, 3, 4].map((i) => {
              const filled = i <= step;
              const isRevisionDot = isRevision && i === step;
              return (
                <div key={i} className="flex items-center flex-1 last:flex-none gap-0.5">
                  <div
                    className={`w-2 h-2 rounded-full transition-all shrink-0 ${
                      task.status === "Completed"
                        ? "bg-emerald-500"
                        : isRevisionDot
                        ? "bg-orange-400"
                        : filled
                        ? "bg-blue-500"
                        : "bg-zinc-700"
                    }`}
                  />
                  {i < 4 && (
                    <div
                      className={`flex-1 h-px ${
                        task.status === "Completed"
                          ? "bg-emerald-500/40"
                          : i < step
                          ? "bg-blue-500/40"
                          : "bg-zinc-700"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-zinc-600">{step + 1}/5 · {task.status}</p>
        </div>

        {/* Row 6: Status badge */}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border self-start ${STATUS_COLOR[task.status]}`}>
          {task.status}
        </span>

        {/* Row 7: [Update Status ▾] [View Details] */}
        <div className="flex items-center gap-2 mt-auto pt-1">
          {actionButtons.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                disabled={isUpdating}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 min-h-[32px] bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 hover:text-white flex items-center gap-1"
              >
                {isUpdating ? "Updating…" : "Update Status ▾"}
              </button>
              {menuOpen && !isUpdating && (
                <div className="absolute bottom-full left-0 mb-1.5 bg-zinc-800 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl z-20 min-w-[180px]">
                  {actionButtons.map((btn) => (
                    <button
                      key={btn.status}
                      onClick={() => {
                        onStatusUpdate(task.id, btn.status, task);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors border-b border-zinc-700/50 last:border-0"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {isAdmin && onDelete && (
            <button
              onClick={() => onDelete(task.id, task.title)}
              className="text-xs font-medium text-red-500 hover:text-red-400 border border-transparent hover:border-red-500/20 hover:bg-red-500/5 px-2 py-1.5 rounded-lg transition-colors min-h-[32px]"
            >
              Delete
            </button>
          )}
          <Link
            href={`/dashboard/tasks/${task.id}`}
            className="text-xs font-medium text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors min-h-[32px] flex items-center ml-auto"
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
