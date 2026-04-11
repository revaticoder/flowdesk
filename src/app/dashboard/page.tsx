import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import Link from "next/link";

// ─── Server-side date helpers ──────────────────────────────────────────────────

function todayIST(): string {
  // Returns "YYYY-MM-DD" in IST
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function getMonthBoundsIST(): { start: string; end: string; label: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(m)}-01T00:00:00+05:30`,
    end: `${y}-${pad(m)}-${pad(lastDay)}T23:59:59+05:30`,
    label: now.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
  };
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fullName = user.user_metadata?.full_name as string | undefined;

  // maybeSingle — no error if employee record doesn't exist
  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("email", user.email!)
    .maybeSingle();

  const isAdmin = emp?.role === "Admin";
  const today = todayIST();
  const { start: monthStart, label: monthLabel } = getMonthBoundsIST();

  // ── Admin counters ────────────────────────────────────────────────────────────
  let clientCount: number | null = null;
  let peopleCount: number | null = null;
  let totalTaskCount: number | null = null;
  let overdueTaskCount: number | null = null;
  let tasksDueTodayCount: number | null = null;
  let completedTodayCount: number | null = null; // optional — needs updated_at column
  let adminTaskError = false;

  // ── Employee monthly progress ─────────────────────────────────────────────────
  let empTotalThisMonth: number | null = null;
  let empCompletedThisMonth: number | null = null;
  let empTaskError = false;

  if (isAdmin) {
    const [clientRes, peopleRes, totalRes, overdueRes, dueTodayRes, completedRes] =
      await Promise.all([
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("employees")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true),
        // Total tasks — count ALL rows
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true }),
        // Overdue — past due_date, not completed
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .lt("due_date", today)
          .not("status", "eq", "Completed"),
        // Due today — not completed
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("due_date", today)
          .not("status", "eq", "Completed"),
        // Completed today — needs updated_at; silently skipped if column missing
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("status", "Completed")
          .gte("updated_at", `${today}T00:00:00+05:30`)
          .lte("updated_at", `${today}T23:59:59+05:30`),
      ]);

    if (totalRes.error) {
      adminTaskError = true;
    } else {
      clientCount = clientRes.count;
      peopleCount = peopleRes.count;
      totalTaskCount = totalRes.count;
      overdueTaskCount = overdueRes.count;
      tasksDueTodayCount = dueTodayRes.count;
      // Only set if updated_at column exists (no error)
      if (!completedRes.error) {
        completedTodayCount = completedRes.count;
      }
    }
  } else if (emp?.id) {
    const [totalRes, completedRes] = await Promise.all([
      // Tasks assigned this month
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", emp.id)
        .gte("created_at", monthStart),
      // Completed tasks assigned this month
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", emp.id)
        .eq("status", "Completed")
        .gte("created_at", monthStart),
    ]);

    if (totalRes.error || completedRes.error) {
      empTaskError = true;
    } else {
      empTotalThisMonth = totalRes.count ?? 0;
      empCompletedThisMonth = completedRes.count ?? 0;
    }
  }

  const progressPct =
    empTotalThisMonth && empTotalThisMonth > 0
      ? Math.round(((empCompletedThisMonth ?? 0) / empTotalThisMonth) * 100)
      : 0;

  return (
    <div className="text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Dashboard
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">
            Welcome back{fullName ? `, ${fullName.split(" ")[0]}` : ""}
          </h1>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-400 hover:text-white transition-colors min-h-[44px] px-2"
          >
            Logout
          </button>
        </form>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8">
        <p className="text-zinc-500 text-sm mb-6 truncate">
          Signed in as{" "}
          <span className="text-zinc-300 font-medium">{user.email}</span>
        </p>

        {/* ── No employee record banner ────────────────────────────────────── */}
        {!emp && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 mb-6 max-w-lg">
            <p className="text-amber-300 text-sm font-semibold">
              Account not linked to an employee profile
            </p>
            <p className="text-zinc-400 text-xs mt-1 leading-relaxed">
              Your login email isn&apos;t associated with any employee record.
              Ask your Admin to add you to the People directory using this exact
              email address.
            </p>
          </div>
        )}

        {/* ── Admin grid ───────────────────────────────────────────────────── */}
        {isAdmin && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* People */}
            <Link
              href="/dashboard/people"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-2xl font-bold text-white">
                {peopleCount ?? "—"}
              </p>
              <p className="text-sm font-medium text-zinc-300 mt-1">People</p>
              <p className="text-xs text-zinc-600 mt-0.5">Active employees</p>
            </Link>

            {/* Clients */}
            <Link
              href="/dashboard/clients"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-2xl font-bold text-white">
                {clientCount ?? "—"}
              </p>
              <p className="text-sm font-medium text-zinc-300 mt-1">Clients</p>
              <p className="text-xs text-zinc-600 mt-0.5">In pipeline</p>
            </Link>

            {/* Attendance */}
            <Link
              href="/dashboard/attendance"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-300">Attendance</p>
              <p className="text-xs text-zinc-600 mt-1">Track your team</p>
            </Link>

            {/* Tasks — live counts, no hardcoding */}
            <Link
              href="/dashboard/tasks"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              {adminTaskError ? (
                <div>
                  <p className="text-sm font-medium text-zinc-300">Tasks</p>
                  <p className="text-xs text-red-400 mt-1">Unable to load</p>
                  <a
                    href="/dashboard"
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline mt-0.5 inline-block"
                  >
                    Retry
                  </a>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-2xl font-bold text-white">
                      {totalTaskCount ?? "—"}
                    </p>
                    <p className="text-sm font-medium text-zinc-300 mt-1">
                      Tasks
                    </p>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {tasksDueTodayCount ?? 0} due today
                      {completedTodayCount !== null
                        ? ` · ${completedTodayCount} completed today`
                        : ""}
                    </p>
                  </div>
                  {(overdueTaskCount ?? 0) > 0 && (
                    <span className="shrink-0 text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                      {overdueTaskCount} overdue
                    </span>
                  )}
                </div>
              )}
            </Link>

            {/* KPIs */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 opacity-40 cursor-not-allowed">
              <p className="text-sm font-medium text-zinc-400">KPIs</p>
              <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
            </div>
          </div>
        )}

        {/* ── Employee grid ─────────────────────────────────────────────────── */}
        {!isAdmin && emp && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* My Profile */}
            <Link
              href={`/dashboard/people/${emp.id}`}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-300">My Profile</p>
              <p className="text-xs text-zinc-600 mt-1">View your details</p>
            </Link>

            {/* Attendance */}
            <Link
              href="/dashboard/attendance"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-300">Attendance</p>
              <p className="text-xs text-zinc-600 mt-1">Check in / out</p>
            </Link>

            {/* My Tasks — monthly progress bar */}
            <Link
              href="/dashboard/tasks"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-300">My Tasks</p>

              {empTaskError ? (
                <>
                  <p className="text-xs text-red-400 mt-1">Unable to load</p>
                  <a
                    href="/dashboard"
                    className="text-xs text-zinc-500 hover:text-zinc-300 underline mt-0.5 inline-block"
                  >
                    Retry
                  </a>
                </>
              ) : empTotalThisMonth === 0 ? (
                <p className="text-xs text-zinc-600 mt-1">
                  No tasks assigned yet
                </p>
              ) : (
                <>
                  <p className="text-xs text-zinc-400 mt-2">
                    {empCompletedThisMonth ?? 0} of {empTotalThisMonth ?? 0}{" "}
                    completed this month
                  </p>
                  {/* Progress bar */}
                  <div className="mt-2.5 w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-600 mt-1.5">
                    {progressPct}% · {monthLabel}
                  </p>
                </>
              )}
            </Link>

            {/* KPIs */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 opacity-40 cursor-not-allowed">
              <p className="text-sm font-medium text-zinc-400">KPIs</p>
              <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
