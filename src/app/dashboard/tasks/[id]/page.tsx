"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  TASK_STATUSES,
  PRIORITY_COLOR,
  PRIORITY_LEFT_BORDER,
  STATUS_COLOR,
  PRIORITY_POINTS,
  initials,
  fmtDate,
  dueDateClass,
  dueDateLabel,
} from "@/lib/tasks";

type Task = {
  id: string;
  title: string;
  description: string | null;
  client_id: string | null;
  mandate_id: string | null;
  assigned_to: string | null;
  reporting_to: string | null;
  task_type: string;
  priority: string;
  status: string;
  due_date: string | null;
  estimated_hours: number | null;
  points: number;
  revision_count: number;
  created_at: string;
  completed_at: string | null;
  clients: { id: string; company_name: string } | null;
  mandates: { id: string; mandate_type: string } | null;
  assignee: { id: string; full_name: string; role: string } | null;
  reporter: { id: string; full_name: string; role: string } | null;
  creator: { id: string; full_name: string } | null;
};

type Comment = {
  id: string;
  content: string;
  created_at: string;
  employee_id: string;
  commenter: { full_name: string } | null;
};

type Employee = { id: string; full_name: string };

const STATUS_STEP_IDX: Record<string, number> = {
  "Not Started": 0,
  "In Progress": 1,
  "In Review": 2,
  "Revision Requested": 1.5,
  Completed: 3,
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pointsFlash, setPointsFlash] = useState<number | null>(null);

  const [currentEmpId, setCurrentEmpId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Reassign state
  const [showReassign, setShowReassign] = useState(false);
  const [newAssignee, setNewAssignee] = useState("");

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

      if (emp) {
        setCurrentEmpId(emp.id);
        if (emp.role === "Admin") setIsAdmin(true);
      }

      const [taskRes, commentsRes, empRes] = await Promise.all([
        supabase
          .from("tasks")
          .select(
            `*, clients(id, company_name), mandates(id, mandate_type), assignee:assigned_to(id, full_name, role), reporter:reporting_to(id, full_name, role), creator:created_by(id, full_name)`
          )
          .eq("id", id)
          .single(),
        supabase
          .from("task_comments")
          .select("*, commenter:employee_id(full_name)")
          .eq("task_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("employees")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      if (taskRes.data) setTask(taskRes.data as Task);
      setComments((commentsRes.data as Comment[]) ?? []);
      setEmployees(empRes.data ?? []);
      setLoading(false);
    };
    load();
  }, [id, router]);

  const isAssignee = task?.assigned_to === currentEmpId;
  const isReporter = task?.reporting_to === currentEmpId;
  const canAct = isAssignee || isAdmin || isReporter;

  const updateStatus = async (newStatus: string) => {
    if (!task) return;
    setActing(true);
    setError(null);
    const supabase = createClient();

    const updates: Record<string, unknown> = { status: newStatus };
    if (newStatus === "Completed") {
      updates.completed_at = new Date().toISOString();
    }

    const { error: err } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id);

    if (err) {
      setError(err.message);
      setActing(false);
      return;
    }

    // Award points on completion
    if (newStatus === "Completed") {
      const basePoints = task.points ?? PRIORITY_POINTS[task.priority] ?? 10;
      let bonusPoints = 0;
      let bonusReason = "";

      // Early completion bonus
      if (
        task.due_date &&
        new Date() <= new Date(task.due_date)
      ) {
        bonusPoints += 5;
        bonusReason = "before_due_date";
      }

      // Zero revision bonus
      if (task.revision_count === 0) {
        bonusPoints += 10;
        bonusReason = bonusReason
          ? "before_due_date_zero_revision"
          : "zero_revision";
      }

      const pointInserts: {
        employee_id: string;
        task_id: string;
        points: number;
        reason: string;
      }[] = [
        {
          employee_id: task.assigned_to!,
          task_id: task.id,
          points: basePoints,
          reason: `task_completed_${task.priority.toLowerCase()}`,
        },
      ];

      if (bonusPoints > 0 && task.assigned_to) {
        pointInserts.push({
          employee_id: task.assigned_to,
          task_id: task.id,
          points: bonusPoints,
          reason: bonusReason,
        });
      }

      await supabase.from("employee_points").insert(pointInserts);

      // Check badges
      await checkAndAwardBadges(supabase, task.assigned_to!, task);

      const totalAwarded = basePoints + bonusPoints;
      setPointsFlash(totalAwarded);
      setTimeout(() => setPointsFlash(null), 3000);
    }

    setTask((prev) =>
      prev
        ? { ...prev, status: newStatus, completed_at: newStatus === "Completed" ? new Date().toISOString() : prev.completed_at }
        : prev
    );
    setActing(false);
  };

  const requestRevision = async () => {
    if (!task) return;
    setActing(true);
    const supabase = createClient();
    const newRevCount = (task.revision_count ?? 0) + 1;

    await Promise.all([
      supabase
        .from("tasks")
        .update({ status: "Revision Requested", revision_count: newRevCount })
        .eq("id", id),
      // Deduct points for revision
      task.assigned_to
        ? supabase.from("employee_points").insert({
            employee_id: task.assigned_to,
            task_id: task.id,
            points: -3,
            reason: "revision_requested",
          })
        : Promise.resolve(),
    ]);

    setTask((prev) =>
      prev
        ? { ...prev, status: "Revision Requested", revision_count: newRevCount }
        : prev
    );
    setPointsFlash(-3);
    setTimeout(() => setPointsFlash(null), 3000);
    setActing(false);
  };

  const approveAndComplete = async () => {
    await updateStatus("Completed");
  };

  const reassign = async () => {
    if (!newAssignee || !task) return;
    setActing(true);
    const supabase = createClient();
    await supabase
      .from("tasks")
      .update({ assigned_to: newAssignee })
      .eq("id", id);
    const newEmp = employees.find((e) => e.id === newAssignee);
    setTask((prev) =>
      prev
        ? {
            ...prev,
            assigned_to: newAssignee,
            assignee: newEmp
              ? { id: newEmp.id, full_name: newEmp.full_name, role: "" }
              : prev.assignee,
          }
        : prev
    );
    setShowReassign(false);
    setNewAssignee("");
    setActing(false);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentEmpId) return;
    setSubmittingComment(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("task_comments")
      .insert({
        task_id: id,
        employee_id: currentEmpId,
        content: commentText.trim(),
      })
      .select("*, commenter:employee_id(full_name)")
      .single();

    if (data) {
      setComments((prev) => [...prev, data as Comment]);
      setCommentText("");
    }
    setSubmittingComment(false);
  };

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;
  if (!task) {
    return (
      <div className="p-8">
        <p className="text-zinc-400 text-sm">Task not found.</p>
        <Link
          href="/dashboard/tasks"
          className="text-zinc-500 hover:text-white text-sm mt-2 inline-block"
        >
          ← Back to Tasks
        </Link>
      </div>
    );
  }

  const statusIdx = STATUS_STEP_IDX[task.status] ?? 0;
  const ddClass = dueDateClass(task.due_date, task.status);
  const ddLabel = dueDateLabel(task.due_date, task.status);

  return (
    <div className="text-white">
      {/* Points flash animation */}
      {pointsFlash !== null && (
        <div
          className={`fixed top-8 right-8 z-50 px-6 py-3 rounded-2xl font-bold text-lg shadow-2xl transition-all animate-bounce ${
            pointsFlash > 0
              ? "bg-emerald-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {pointsFlash > 0 ? `+${pointsFlash}` : pointsFlash} pts{" "}
          {pointsFlash > 0 ? "🎉" : ""}
        </div>
      )}

      {/* Header */}
      <header
        className={`border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-start justify-between gap-3 border-l-4 ${PRIORITY_LEFT_BORDER[task.priority] ?? ""}`}
      >
        <div className="flex items-start gap-3 min-w-0">
          <Link
            href="/dashboard/tasks"
            className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center shrink-0"
          >
            ← Back
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[task.priority]}`}
              >
                {task.priority}
              </span>
              <span className="text-xs text-zinc-600">{task.task_type}</span>
            </div>
            <h1 className="text-lg font-bold text-white mt-1 leading-snug">
              {task.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLOR[task.status]}`}
          >
            {task.status}
          </span>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl space-y-6">
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Progress bar */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-4">
            Progress
          </p>
          <div className="flex items-center gap-0 relative">
            {(["Not Started", "In Progress", "In Review", "Completed"] as const).map(
              (s, i) => {
                const isDone = statusIdx > i || task.status === s;
                const isCurrent = task.status === s;
                return (
                  <div key={s} className="flex items-center flex-1 last:flex-none">
                    <div className="flex flex-col items-center gap-1 z-10">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                          isCurrent
                            ? "bg-white text-black border-white"
                            : isDone
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-zinc-800 border-zinc-700 text-zinc-600"
                        }`}
                      >
                        {isDone && !isCurrent ? "✓" : i + 1}
                      </div>
                      <span
                        className={`text-[9px] font-medium text-center leading-tight w-16 ${
                          isCurrent
                            ? "text-white"
                            : isDone
                            ? "text-emerald-400"
                            : "text-zinc-600"
                        }`}
                      >
                        {s}
                      </span>
                    </div>
                    {i < 3 && (
                      <div
                        className={`flex-1 h-0.5 transition-all ${
                          statusIdx > i ? "bg-emerald-500" : "bg-zinc-800"
                        }`}
                      />
                    )}
                  </div>
                );
              }
            )}
          </div>
          {task.status === "Revision Requested" && (
            <div className="mt-3 text-xs text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-lg px-3 py-2">
              🔄 Revision #{task.revision_count} requested — assignee needs to resubmit
            </div>
          )}

          {/* Points info */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-zinc-500">
              Task value:{" "}
              <span className="text-white font-semibold">{task.points} pts</span>
            </span>
            {task.revision_count > 0 && (
              <span className="text-xs text-orange-400">
                🔄 {task.revision_count} revision{task.revision_count !== 1 ? "s" : ""} (
                -{task.revision_count * 3} pts)
              </span>
            )}
            {task.status === "Completed" && (
              <span className="text-xs text-emerald-400 font-semibold">
                ✅ Completed — points awarded!
              </span>
            )}
            {task.due_date && task.status !== "Completed" && (
              <span className={`text-xs font-medium ${ddClass}`}>
                {ddLabel}
              </span>
            )}
          </div>
        </div>

        {/* Two-column: Stakeholders + Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stakeholder Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
              Stakeholders
            </p>
            <div className="divide-y divide-zinc-800/60">
              <StakeholderRow
                label="Assigned To"
                emp={task.assignee}
              />
              <StakeholderRow
                label="Reporting To"
                emp={task.reporter}
              />
              {task.clients && (
                <div className="flex items-start px-5 py-3">
                  <p className="text-zinc-500 text-sm w-28 shrink-0">Client</p>
                  <Link
                    href={`/dashboard/clients/${task.client_id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    {task.clients.company_name}
                  </Link>
                </div>
              )}
              {task.mandates && (
                <div className="flex items-start px-5 py-3">
                  <p className="text-zinc-500 text-sm w-28 shrink-0">Mandate</p>
                  <Link
                    href={`/dashboard/mandates/${task.mandate_id}`}
                    className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
                  >
                    {task.mandates.mandate_type}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
              Actions
            </p>
            <div className="p-4 space-y-2">
              {/* Employee actions */}
              {isAssignee && task.status === "Not Started" && (
                <button
                  onClick={() => updateStatus("In Progress")}
                  disabled={acting}
                  className="w-full bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {acting ? "…" : "▶ Mark In Progress"}
                </button>
              )}
              {isAssignee && task.status === "In Progress" && (
                <button
                  onClick={() => updateStatus("In Review")}
                  disabled={acting}
                  className="w-full bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {acting ? "…" : "↑ Submit for Review"}
                </button>
              )}
              {isAssignee && task.status === "Revision Requested" && (
                <button
                  onClick={() => updateStatus("In Progress")}
                  disabled={acting}
                  className="w-full bg-orange-500 hover:bg-orange-400 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {acting ? "…" : "🔄 Start Revision"}
                </button>
              )}

              {/* Admin/Reporter actions */}
              {(isAdmin || isReporter) && task.status === "In Review" && (
                <>
                  <button
                    onClick={approveAndComplete}
                    disabled={acting}
                    className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
                  >
                    {acting ? "…" : "✅ Approve & Complete"}
                  </button>
                  <button
                    onClick={requestRevision}
                    disabled={acting}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-orange-400 font-semibold text-sm px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
                  >
                    {acting ? "…" : "🔄 Request Revision"}
                  </button>
                </>
              )}

              {/* Reassign */}
              {(isAdmin || isReporter) && task.status !== "Completed" && (
                <>
                  <button
                    onClick={() => setShowReassign((v) => !v)}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-sm px-4 py-2.5 rounded-lg transition-colors min-h-[44px]"
                  >
                    ↔ Reassign
                  </button>
                  {showReassign && (
                    <div className="flex gap-2">
                      <select
                        value={newAssignee}
                        onChange={(e) => setNewAssignee(e.target.value)}
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 min-h-[40px]"
                      >
                        <option value="">Select employee…</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.full_name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={reassign}
                        disabled={!newAssignee || acting}
                        className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[40px]"
                      >
                        Save
                      </button>
                    </div>
                  )}
                </>
              )}

              {task.status === "Completed" && (
                <div className="text-center py-2">
                  <p className="text-emerald-400 text-sm font-medium">
                    ✅ Task Completed
                  </p>
                  {task.completed_at && (
                    <p className="text-zinc-600 text-xs mt-0.5">
                      {fmtDate(task.completed_at)}
                    </p>
                  )}
                </div>
              )}

              {!canAct && task.status !== "Completed" && (
                <p className="text-xs text-zinc-600 text-center py-2">
                  You are a viewer on this task
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Task Details */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
            Details
          </p>
          <div className="divide-y divide-zinc-800/60">
            <DetailRow label="Task Type">{task.task_type}</DetailRow>
            <DetailRow label="Priority">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[task.priority]}`}
              >
                {task.priority}
              </span>
            </DetailRow>
            <DetailRow label="Due Date">
              <span className={ddClass}>{fmtDate(task.due_date)}</span>
            </DetailRow>
            {task.estimated_hours != null && (
              <DetailRow label="Est. Hours">
                {task.estimated_hours}h
              </DetailRow>
            )}
            <DetailRow label="Points">
              <span className="font-semibold text-white">{task.points}</span>
              {task.revision_count > 0 && (
                <span className="text-orange-400 text-xs ml-2">
                  (-{task.revision_count * 3} from revisions)
                </span>
              )}
            </DetailRow>
            {task.creator && (
              <DetailRow label="Created By">
                {task.creator.full_name}
              </DetailRow>
            )}
            <DetailRow label="Created">
              {fmtDate(task.created_at)}
            </DetailRow>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-2">
              Description
            </p>
            <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
              {task.description}
            </p>
          </div>
        )}

        {/* Comments */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
            Comments ({comments.length})
          </p>

          {comments.length > 0 && (
            <div className="divide-y divide-zinc-800/50">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-3 px-5 py-4">
                  <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0">
                    {c.commenter ? initials(c.commenter.full_name) : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white">
                        {c.commenter?.full_name ?? "Unknown"}
                      </span>
                      <span className="text-xs text-zinc-600">
                        {new Date(c.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          <div className="px-5 py-4 border-t border-zinc-800">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300 shrink-0 mt-0.5">
                {currentEmpId
                  ? initials(
                      employees.find((e) => e.id === currentEmpId)
                        ?.full_name ?? "?"
                    )
                  : "?"}
              </div>
              <div className="flex-1 space-y-2">
                <textarea
                  ref={commentRef}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      submitComment();
                    }
                  }}
                  placeholder="Add a comment… (@mention a colleague)"
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-zinc-500 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600">
                    Ctrl+Enter to send
                  </span>
                  <button
                    onClick={submitComment}
                    disabled={!commentText.trim() || submittingComment}
                    className="bg-white text-black text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-40 min-h-[32px]"
                  >
                    {submittingComment ? "…" : "Comment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function checkAndAwardBadges(
  supabase: ReturnType<typeof createClient>,
  employeeId: string,
  task: Task
) {
  // Zero revision badge
  if (task.revision_count === 0) {
    const existing = await supabase
      .from("employee_badges")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("badge_type", "zero_revision")
      .maybeSingle();

    if (!existing.data) {
      await supabase
        .from("employee_badges")
        .insert({ employee_id: employeeId, badge_type: "zero_revision" });
    }
  }

  // On Fire: 5 tasks completed in a row (last 5 completed tasks, all by same employee)
  const { data: recentCompleted } = await supabase
    .from("tasks")
    .select("id")
    .eq("assigned_to", employeeId)
    .eq("status", "Completed")
    .order("completed_at", { ascending: false })
    .limit(5);

  if (recentCompleted && recentCompleted.length >= 5) {
    const existing = await supabase
      .from("employee_badges")
      .select("id")
      .eq("employee_id", employeeId)
      .eq("badge_type", "on_fire")
      .maybeSingle();

    if (!existing.data) {
      await supabase
        .from("employee_badges")
        .insert({ employee_id: employeeId, badge_type: "on_fire" });
    }
  }
}

function StakeholderRow({
  label,
  emp,
}: {
  label: string;
  emp: { id: string; full_name: string; role: string } | null;
}) {
  return (
    <div className="flex items-center px-5 py-3">
      <p className="text-zinc-500 text-sm w-28 shrink-0">{label}</p>
      {emp ? (
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[9px] font-bold text-zinc-300">
            {initials(emp.full_name)}
          </div>
          <div>
            <Link
              href={`/dashboard/people/${emp.id}`}
              className="text-sm text-white hover:text-zinc-300 transition-colors"
            >
              {emp.full_name}
            </Link>
            {emp.role && (
              <p className="text-[10px] text-zinc-600">{emp.role}</p>
            )}
          </div>
        </div>
      ) : (
        <span className="text-zinc-600 text-sm">—</span>
      )}
    </div>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start px-5 py-3">
      <p className="text-zinc-500 text-sm w-28 shrink-0">{label}</p>
      <div className="text-zinc-300 text-sm">{children}</div>
    </div>
  );
}
