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

  if (isAdmin) {
    const [clientRes, peopleRes] = await Promise.all([
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("employees").select("id", { count: "exact", head: true }).eq("is_active", true),
    ]);
    clientCount = clientRes.count;
    peopleCount = peopleRes.count;
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
            {["Tasks", "KPIs"].map((module) => (
              <div
                key={module}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 opacity-40 cursor-not-allowed"
              >
                <p className="text-sm font-medium text-zinc-400">{module}</p>
                <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
              </div>
            ))}
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
            {["Tasks", "KPIs"].map((module) => (
              <div
                key={module}
                className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 opacity-40 cursor-not-allowed"
              >
                <p className="text-sm font-medium text-zinc-400">{module}</p>
                <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
