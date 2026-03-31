"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  PRIORITY_COLOR,
  PRIORITY_LEFT_BORDER,
  STATUS_COLOR,
  PRIORITY_POINTS,
  BADGE_INFO,
  initials,
  fmtDate,
  dueDateClass,
  getLevelInfo,
} from "@/lib/tasks";

type Task = {
  id: string;
  title: string;
  priority: string;
  status: string;
  due_date: string | null;
  points: number;
  revision_count: number;
  task_type: string;
  clients: { company_name: string } | null;
  mandates: { mandate_type: string } | null;
};

type Badge = {
  id: string;
  badge_type: string;
  awarded_at: string;
};

type PointsRow = {
  points: number;
  created_at: string;
};

type Employee = {
  id: string;
  full_name: string;
  role: string;
};

type LeaderboardEntry = {
  employee_id: string;
  total: number;
  full_name: string;
};

export default function MyTasksPage() {
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [monthPoints, setMonthPoints] = useState(0);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: emp } = await supabase
        .from("employees")
        .select("id, full_name, role")
        .eq("email", user.email!)
        .maybeSingle();

      if (!emp) return;
      setEmployee(emp);

      const [tasksRes, badgesRes, pointsRes, allPointsRes, empCountRes] =
        await Promise.all([
          supabase
            .from("tasks")
            .select(
              "id, title, priority, status, due_date, points, revision_count, task_type, clients(company_name), mandates(mandate_type)"
            )
            .eq("assigned_to", emp.id)
            .order("due_date", { ascending: true, nullsFirst: false }),
          supabase
            .from("employee_badges")
            .select("id, badge_type, awarded_at")
            .eq("employee_id", emp.id),
          supabase
            .from("employee_points")
            .select("points, created_at")
            .eq("employee_id", emp.id),
          supabase
            .from("employee_points")
            .select("employee_id, points"),
          supabase
            .from("employees")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true),
        ]);

      const allTasks = (tasksRes.data as unknown as Task[]) ?? [];
      setTasks(allTasks);
      setBadges(badgesRes.data ?? []);

      const pts = (pointsRes.data as PointsRow[]) ?? [];
      const total = pts.reduce((s, r) => s + r.points, 0);
      setTotalPoints(Math.max(0, total));

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthPts = pts
        .filter((r) => new Date(r.created_at) >= monthStart)
        .reduce((s, r) => s + r.points, 0);
      setMonthPoints(Math.max(0, monthPts));

      // Calculate leaderboard rank
      const allPts = (allPointsRes.data ?? []) as {
        employee_id: string;
        points: number;
      }[];
      const totalsMap: Record<string, number> = {};
      for (const row of allPts) {
        totalsMap[row.employee_id] = (totalsMap[row.employee_id] ?? 0) + row.points;
      }
      const sorted = Object.entries(totalsMap).sort(([, a], [, b]) => b - a);
      const rank = sorted.findIndex(([id]) => id === emp.id) + 1;
      setMyRank(rank > 0 ? rank : sorted.length + 1);
      setTotalEmployees(empCountRes.count ?? 0);

      // Streak: count consecutive days with at least 1 completed task
      const completedDates = allTasks
        .filter((t) => t.status === "Completed" && t.due_date)
        .map((t) => t.due_date!.slice(0, 10))
        .sort()
        .reverse();
      const uniqueDates = [...new Set(completedDates)];
      let s = 0;
      const today = new Date();
      for (let i = 0; i < uniqueDates.length; i++) {
        const d = new Date(uniqueDates[i]);
        const expected = new Date(today);
        expected.setDate(expected.getDate() - i);
        if (d.toDateString() === expected.toDateString()) s++;
        else break;
      }
      setStreak(s);

      setLoading(false);
    };
    load();
  }, [router]);

  const quickUpdateStatus = async (taskId: string, newStatus: string) => {
    setUpdatingId(taskId);
    const supabase = createClient();
    const updates: Record<string, unknown> = { status: newStatus };
    await supabase.from("tasks").update(updates).eq("id", taskId);
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );
    setUpdatingId(null);
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const overdue = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== "Completed" &&
          t.due_date &&
          new Date(t.due_date) < today
      ),
    [tasks, today]
  );

  const dueToday = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "Completed" || !t.due_date) return false;
        const d = new Date(t.due_date);
        return d >= today && d < new Date(today.getTime() + 86400000);
      }),
    [tasks, today]
  );

  const thisWeek = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "Completed" || !t.due_date) return false;
        const d = new Date(t.due_date);
        return d >= new Date(today.getTime() + 86400000) && d < weekEnd;
      }),
    [tasks, today, weekEnd]
  );

  const upcoming = useMemo(
    () =>
      tasks.filter((t) => {
        if (t.status === "Completed" || !t.due_date) return false;
        const d = new Date(t.due_date);
        return d >= weekEnd;
      }),
    [tasks, weekEnd]
  );

  const noDate = useMemo(
    () => tasks.filter((t) => t.status !== "Completed" && !t.due_date),
    [tasks]
  );

  const recentlyCompleted = useMemo(
    () => tasks.filter((t) => t.status === "Completed").slice(0, 5),
    [tasks]
  );

  const totalAssigned = tasks.length;
  const completedCount = tasks.filter((t) => t.status === "Completed").length;
  const thisMonthAssigned = tasks.length;
  const completionPct =
    thisMonthAssigned > 0
      ? Math.round((completedCount / thisMonthAssigned) * 100)
      : 0;

  const levelInfo = getLevelInfo(totalPoints);

  if (loading)
    return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Tasks
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">My Tasks</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/tasks"
            className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors min-h-[36px] flex items-center"
          >
            All Tasks
          </Link>
          <Link
            href="/dashboard/tasks/leaderboard"
            className="text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors min-h-[36px] flex items-center"
          >
            🏆 Board
          </Link>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: task sections */}
        <div className="lg:col-span-2 space-y-5">
          {/* Monthly progress */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                This Month
              </p>
              <span className="text-xs text-zinc-400 font-medium">
                {completedCount} / {totalAssigned} completed
              </span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-emerald-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">{completionPct}% completion rate</p>
          </div>

          {/* Overdue */}
          {overdue.length > 0 && (
            <TaskSection
              icon="🚨"
              title="OVERDUE"
              titleClass="text-red-400"
              tasks={overdue}
              updatingId={updatingId}
              onStatusUpdate={quickUpdateStatus}
            />
          )}

          {/* Due today */}
          {dueToday.length > 0 && (
            <TaskSection
              icon="📅"
              title="DUE TODAY"
              titleClass="text-orange-400"
              tasks={dueToday}
              updatingId={updatingId}
              onStatusUpdate={quickUpdateStatus}
            />
          )}

          {/* This week */}
          {thisWeek.length > 0 && (
            <TaskSection
              icon="📋"
              title="THIS WEEK"
              titleClass="text-yellow-400"
              tasks={thisWeek}
              updatingId={updatingId}
              onStatusUpdate={quickUpdateStatus}
            />
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <TaskSection
              icon="📦"
              title="UPCOMING"
              titleClass="text-zinc-400"
              tasks={upcoming}
              updatingId={updatingId}
              onStatusUpdate={quickUpdateStatus}
            />
          )}

          {/* No date */}
          {noDate.length > 0 && (
            <TaskSection
              icon="📌"
              title="NO DUE DATE"
              titleClass="text-zinc-500"
              tasks={noDate}
              updatingId={updatingId}
              onStatusUpdate={quickUpdateStatus}
            />
          )}

          {/* Recently completed */}
          {recentlyCompleted.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  ✅ RECENTLY COMPLETED
                </p>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {recentlyCompleted.map((task) => (
                  <Link
                    key={task.id}
                    href={`/dashboard/tasks/${task.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/30 transition-colors"
                  >
                    <span className="text-emerald-400 text-xs">✓</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-400 truncate line-through decoration-zinc-600">
                        {task.title}
                      </p>
                      <p className="text-xs text-zinc-600 truncate">
                        {task.clients?.company_name ?? "—"}
                      </p>
                    </div>
                    <span className="text-xs text-emerald-400/60 font-medium shrink-0">
                      +{task.points ?? PRIORITY_POINTS[task.priority] ?? 0}pt
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {overdue.length === 0 &&
            dueToday.length === 0 &&
            thisWeek.length === 0 &&
            upcoming.length === 0 &&
            noDate.length === 0 &&
            recentlyCompleted.length === 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
                <p className="text-4xl mb-3">🎉</p>
                <p className="text-zinc-400 font-medium">All caught up!</p>
                <p className="text-zinc-600 text-sm mt-1">
                  No tasks assigned to you.
                </p>
              </div>
            )}
        </div>

        {/* Right: Gamification card */}
        <div className="space-y-4">
          {/* Level card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                  Your Level
                </p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {levelInfo.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{totalPoints}</p>
                <p className="text-xs text-zinc-500">total pts</p>
              </div>
            </div>

            {/* Level progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>{levelInfo.min} pts</span>
                <span className="text-zinc-400 font-medium">
                  {monthPoints} this month
                </span>
                <span>{levelInfo.max} pts</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-700"
                  style={{
                    width: `${levelInfo.pct}%`,
                    background:
                      "linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)",
                  }}
                />
              </div>
              <p className="text-xs text-zinc-600">
                {levelInfo.pct}% to {levelInfo.nextName}
              </p>
            </div>
          </div>

          {/* Rank card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
              Leaderboard Rank
            </p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold text-white">
                {myRank != null ? `#${myRank}` : "—"}
              </span>
              <span className="text-zinc-500 text-sm mb-1">
                of {totalEmployees}
              </span>
            </div>
            <Link
              href="/dashboard/tasks/leaderboard"
              className="mt-3 flex items-center text-xs text-zinc-500 hover:text-white transition-colors"
            >
              View full leaderboard →
            </Link>
          </div>

          {/* Streak card */}
          {streak > 0 && (
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-5">
              <p className="text-xs text-orange-400 uppercase tracking-widest font-medium mb-1">
                Current Streak
              </p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-white">{streak}</span>
                <span className="text-orange-400 text-sm mb-0.5">
                  day{streak !== 1 ? "s" : ""} 🔥
                </span>
              </div>
            </div>
          )}

          {/* Badges */}
          {badges.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
                Badges Earned
              </p>
              <div className="space-y-2">
                {badges.map((b) => {
                  const info = BADGE_INFO[b.badge_type];
                  if (!info) return null;
                  return (
                    <div
                      key={b.id}
                      className="flex items-center gap-2.5 p-2 bg-zinc-800/50 rounded-lg"
                    >
                      <span className="text-xl">{info.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-white">
                          {info.label}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {info.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {badges.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
                Badges
              </p>
              <p className="text-sm text-zinc-600">
                Complete tasks to earn badges!
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.values(BADGE_INFO).map((b) => (
                  <span
                    key={b.label}
                    className="text-xl opacity-20 filter grayscale"
                    title={b.description}
                  >
                    {b.icon}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Points breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
              Points Guide
            </p>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Low priority task</span>
                <span className="text-green-400">+5 pts</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Medium priority task</span>
                <span className="text-yellow-400">+10 pts</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>High priority task</span>
                <span className="text-orange-400">+15 pts</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Urgent priority task</span>
                <span className="text-red-400">+20 pts</span>
              </div>
              <div className="border-t border-zinc-800 my-1.5" />
              <div className="flex justify-between text-zinc-400">
                <span>Before due date</span>
                <span className="text-blue-400">+5 bonus</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Zero revisions</span>
                <span className="text-violet-400">+10 bonus</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>Revision requested</span>
                <span className="text-red-500">-3 pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskSection({
  icon,
  title,
  titleClass,
  tasks,
  updatingId,
  onStatusUpdate,
}: {
  icon: string;
  title: string;
  titleClass: string;
  tasks: Task[];
  updatingId: string | null;
  onStatusUpdate: (id: string, status: string) => void;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <p className={`text-xs font-semibold ${titleClass} uppercase tracking-wider`}>
          {icon} {title}
        </p>
        <span className="text-xs text-zinc-600">{tasks.length}</span>
      </div>
      <div className="divide-y divide-zinc-800/50">
        {tasks.map((task) => {
          const ddClass = dueDateClass(task.due_date, task.status);
          const nextStatus =
            task.status === "Not Started"
              ? "In Progress"
              : task.status === "In Progress"
              ? "In Review"
              : task.status === "Revision Requested"
              ? "In Progress"
              : null;

          return (
            <div
              key={task.id}
              className={`flex items-start gap-3 px-4 py-3 border-l-2 ${PRIORITY_LEFT_BORDER[task.priority] ?? "border-l-zinc-700"}`}
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/dashboard/tasks/${task.id}`}
                  className="block text-sm font-medium text-white hover:text-zinc-300 transition-colors truncate"
                >
                  {task.title}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-xs text-zinc-600 truncate max-w-[120px]">
                    {task.clients?.company_name ?? "—"}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${PRIORITY_COLOR[task.priority]}`}
                  >
                    {task.priority}
                  </span>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${STATUS_COLOR[task.status]}`}
                  >
                    {task.status}
                  </span>
                  {task.due_date && (
                    <span className={`text-[10px] font-medium ${ddClass}`}>
                      {fmtDate(task.due_date)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-zinc-600 font-medium">
                  {task.points ?? PRIORITY_POINTS[task.priority] ?? 0}pt
                </span>
                {nextStatus && (
                  <button
                    onClick={() => onStatusUpdate(task.id, nextStatus)}
                    disabled={updatingId === task.id}
                    className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 min-h-[32px] whitespace-nowrap"
                  >
                    {updatingId === task.id
                      ? "…"
                      : nextStatus === "In Progress"
                      ? "Start"
                      : "Submit"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
