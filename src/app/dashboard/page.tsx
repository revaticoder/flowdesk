import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const fullName = user.user_metadata?.full_name as string | undefined;

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
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
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Logout
          </button>
        </form>
      </header>

      {/* Content */}
      <div className="px-8 py-8">
        <p className="text-zinc-500 text-sm mb-6">
          Signed in as{" "}
          <span className="text-zinc-300 font-medium">{user.email}</span>
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/people"
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 hover:border-zinc-600 transition-colors"
          >
            <p className="text-sm font-medium text-zinc-300">People</p>
            <p className="text-xs text-zinc-600 mt-1">Manage your team</p>
          </Link>
          {["Clients", "Tasks", "Attendance", "KPIs"].map((module) => (
            <div
              key={module}
              className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-5 opacity-50 cursor-not-allowed"
            >
              <p className="text-sm font-medium text-zinc-400">{module}</p>
              <p className="text-xs text-zinc-600 mt-1">Coming soon</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
