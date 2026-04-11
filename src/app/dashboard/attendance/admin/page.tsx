"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LeaveRecord = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  employees: { full_name: string } | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const statusStyle: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10",
  approved: "text-emerald-400 bg-emerald-400/10",
  rejected: "text-red-400 bg-red-400/10",
};

export default function AdminLeaveApprovalPage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [acting, setActing] = useState<string | null>(null); // id being updated

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Check if this user is an Admin
      const { data: emp } = await supabase
        .from("employees")
        .select("role")
        .eq("email", user.email)
        .single();

      if (!emp || emp.role !== "Admin") {
        setUnauthorized(true);
        setLoading(false);
        return;
      }

      // Fetch all pending leaves with employee name via join
      const { data } = await supabase
        .from("leaves")
        .select("*, employees(full_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      setLeaves(data ?? []);
      setLoading(false);
    };
    init();
  }, []);

  const handleAction = async (
    id: string,
    action: "approved" | "rejected"
  ) => {
    setActing(id);
    const supabase = createClient();
    const { error } = await supabase
      .from("leaves")
      .update({ status: action })
      .eq("id", id);

    if (!error) {
      setLeaves((prev) => prev.filter((l) => l.id !== id));
    }
    setActing(null);
  };

  if (loading) {
    return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;
  }

  if (unauthorized) {
    return (
      <div className="text-white">
        <header className="border-b border-zinc-800 px-8 py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Attendance
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">Admin Panel</h1>
        </header>
        <div className="px-8 py-8">
          <div className="bg-zinc-900 border border-red-500/20 rounded-xl px-6 py-6">
            <p className="text-red-400 text-sm font-medium">Access Denied</p>
            <p className="text-zinc-500 text-sm mt-1">
              This page is only accessible to users with the Admin role.
            </p>
            <Link
              href="/dashboard/attendance"
              className="inline-block mt-4 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ← Back to Attendance
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/attendance"
            className="text-zinc-400 hover:text-white text-sm transition-colors shrink-0"
          >
            ← Back
          </Link>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Attendance · Admin
            </p>
            <h1 className="text-base md:text-lg font-bold text-white mt-0.5">
              Pending Leave Requests
            </h1>
          </div>
        </div>
        <Link
          href="/dashboard/attendance/admin/records"
          className="text-sm text-zinc-400 hover:text-white transition-colors shrink-0"
        >
          Attendance Records →
        </Link>
      </header>

      <div className="px-8 py-8 max-w-3xl">
        {leaves.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
            <p className="text-zinc-400 text-sm">
              No pending leave requests. All caught up.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaves.map((leave) => (
              <div
                key={leave.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold text-sm">
                        {leave.employees?.full_name ?? "Unknown"}
                      </p>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${statusStyle[leave.status]}`}
                      >
                        {leave.status}
                      </span>
                    </div>
                    <p className="text-zinc-300 text-sm">{leave.leave_type}</p>
                    <p className="text-zinc-400 text-xs mt-0.5">
                      {fmtDate(leave.start_date)} → {fmtDate(leave.end_date)}
                    </p>
                    <p className="text-zinc-500 text-xs mt-1.5">
                      {leave.reason}
                    </p>
                    <p className="text-zinc-600 text-xs mt-1">
                      Applied {fmtDate(leave.created_at)}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(leave.id, "approved")}
                      disabled={acting === leave.id}
                      className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-2 rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {acting === leave.id ? "…" : "Approve"}
                    </button>
                    <button
                      onClick={() => handleAction(leave.id, "rejected")}
                      disabled={acting === leave.id}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold px-4 py-2 rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {acting === leave.id ? "…" : "Reject"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
