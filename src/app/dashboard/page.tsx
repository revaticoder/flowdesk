import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const fullName = user.user_metadata?.full_name as string | undefined;

  // Check if admin
  const { data: emp } = await supabase
    .from("employees")
    .select("id, role")
    .eq("email", user.email!)
    .single();

  const isAdmin = emp?.role === "Admin";

  // Fetch counts for admin dashboard cards
  let clientCount: number | null = null;
  let peopleCount: number | null = null;
  let totalTasksToday: number | null = null;
  let overdueTaskCount: number | null = null;
  let empTasksDueToday: number | null = null;

  const today = new Date().toISOString().slice(0, 10);

  if (isAdmin) {
    const [clientRes, peopleRes, tasksTodayRes, overdueRes] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("tasks").select("id", { count: "exact", head: true }).eq("due_date", today).not("status", "eq", "Completed"),
      supabase.from("tasks").select("id", { count: "exact", head: true }).lt("due_date", today).not("status", "eq", "Completed"),
    ]);
    clientCount = clientRes.count;
    peopleCount = peopleRes.count;
    totalTasksToday = tasksTodayRes.count;
    overdueTaskCount = overdueRes.count;
  } else if (emp?.id) {
    const { count } = await supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", emp.id)
      .eq("due_date", today)
      .not("status", "eq", "Completed");
    empTasksDueToday = count;
  }

  return (
    <div className="text-white">
      {/* Top bar */}
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

      {/* Content */}
      <div className="px-4 py-6 md:px-8 md:py-8">
        <p className="text-zinc-500 text-sm mb-6 truncate">
          Signed in as{" "}
          <span className="text-zinc-300 font-medium">{user.email}</span>
        </p>

        {isAdmin ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <Link
              href="/dashboard/attendance"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-300">Attendance</p>
              <p className="text-xs text-zinc-600 mt-1">Track your team</p>
            </Link>
            <Link
              href="/dashboard/tasks"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-bold text-white">
                    {totalTasksToday ?? "—"}
                  </p>
                  <p className="text-sm font-medium text-zinc-300 mt-1">Tasks</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Due today</p>
                </div>
                {(overdueTaskCount ?? 0) > 0 && (
                  <span className="text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {overdueTaskCount} overdue
                  </span>
                )}
              </div>
            </Link>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 opacity-40 cursor-not-allowed">
              <p className="text-sm font-medium text-zinc-400">KPIs</p>
              <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Link
              href={emp ? `/dashboard/people/${emp.id}` : "/dashboard/people"}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-300">My Profile</p>
              <p className="text-xs text-zinc-600 mt-1">View your details</p>
            </Link>
            <Link
              href="/dashboard/attendance"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-sm font-medium text-zinc-300">Attendance</p>
              <p className="text-xs text-zinc-600 mt-1">Check in / out</p>
            </Link>
            <Link
              href="/dashboard/tasks/my"
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
            >
              <p className="text-2xl font-bold text-white">
                {empTasksDueToday ?? "—"}
              </p>
              <p className="text-sm font-medium text-zinc-300 mt-1">My Tasks</p>
              <p className="text-xs text-zinc-600 mt-0.5">Due today</p>
            </Link>
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
