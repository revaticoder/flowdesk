"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type LeaveRecord = {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

const TOTAL_LEAVES = 24;

const statusStyle: Record<string, string> = {
  pending: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  approved: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  rejected: "text-red-400 bg-red-400/10 border-red-400/20",
};

/** Count calendar days from start to end inclusive, excluding Sundays. */
function countDaysExcludingSundays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function MyLeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [noEmployee, setNoEmployee] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id")
        .eq("email", user.email)
        .single();

      if (!emp) {
        setNoEmployee(true);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("leaves")
        .select("*")
        .eq("employee_id", emp.id)
        .order("created_at", { ascending: false });

      setLeaves(data ?? []);
      setLoading(false);
    };
    init();
  }, []);

  const usedDays = leaves
    .filter((l) => l.status === "approved")
    .reduce(
      (sum, l) => sum + countDaysExcludingSundays(l.start_date, l.end_date),
      0
    );
  const remaining = Math.max(0, TOTAL_LEAVES - usedDays);

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/attendance"
            className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center shrink-0"
          >
            ← Back
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Attendance
            </p>
            <h1 className="text-lg font-bold text-white mt-0.5">My Leaves</h1>
          </div>
        </div>
        <Link
          href="/dashboard/attendance/leave"
          className="shrink-0 bg-zinc-800 text-white text-sm font-medium px-3 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors min-h-[44px] flex items-center"
        >
          + Apply
        </Link>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl space-y-6">
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : noEmployee ? (
          <p className="text-zinc-400 text-sm">
            No employee record found for your account.
          </p>
        ) : (
          <>
            {/* Leave Balance Card — stacks on mobile */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6">
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-4">
                Leave Balance · {new Date().getFullYear()}
              </p>
              <div className="grid grid-cols-3 gap-0 divide-x divide-zinc-800 sm:grid-cols-3">
                <div className="pr-4 md:pr-6">
                  <p className="text-2xl md:text-3xl font-bold text-white">
                    {TOTAL_LEAVES}
                  </p>
                  <p className="text-zinc-400 text-xs md:text-sm mt-1">
                    Total Paid
                  </p>
                  <p className="text-zinc-600 text-xs mt-0.5 hidden sm:block">
                    2 per month
                  </p>
                </div>
                <div className="px-4 md:px-6">
                  <p className="text-2xl md:text-3xl font-bold text-red-400">
                    {usedDays}
                  </p>
                  <p className="text-zinc-400 text-xs md:text-sm mt-1">Used</p>
                  <p className="text-zinc-600 text-xs mt-0.5 hidden sm:block">
                    Approved leaves
                  </p>
                </div>
                <div className="pl-4 md:pl-6">
                  <p
                    className={`text-2xl md:text-3xl font-bold ${
                      remaining <= 3 ? "text-amber-400" : "text-emerald-400"
                    }`}
                  >
                    {remaining}
                  </p>
                  <p className="text-zinc-400 text-xs md:text-sm mt-1">
                    Remaining
                  </p>
                  <p className="text-zinc-600 text-xs mt-0.5 hidden sm:block">
                    Sundays excluded
                  </p>
                </div>
              </div>
            </div>

            {/* Leave History */}
            {leaves.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
                <p className="text-zinc-400 text-sm">
                  No leave applications yet.
                </p>
                <Link
                  href="/dashboard/attendance/leave"
                  className="inline-block mt-3 text-sm text-white underline underline-offset-2"
                >
                  Apply for one now
                </Link>
              </div>
            ) : (
              <div className="border border-zinc-800 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900">
                        <th className="text-left px-4 py-3 text-zinc-500 font-medium whitespace-nowrap">
                          Leave Type
                        </th>
                        <th className="text-left px-4 py-3 text-zinc-500 font-medium whitespace-nowrap">
                          Dates
                        </th>
                        <th className="text-left px-4 py-3 text-zinc-500 font-medium whitespace-nowrap">
                          Days
                        </th>
                        <th className="text-left px-4 py-3 text-zinc-500 font-medium whitespace-nowrap">
                          Status
                        </th>
                        <th className="text-left px-4 py-3 text-zinc-500 font-medium whitespace-nowrap">
                          Applied On
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {leaves.map((leave) => {
                        const days = countDaysExcludingSundays(
                          leave.start_date,
                          leave.end_date
                        );
                        return (
                          <tr key={leave.id} className="bg-zinc-900/40">
                            <td className="px-4 py-3.5 text-white font-medium whitespace-nowrap">
                              {leave.leave_type}
                            </td>
                            <td className="px-4 py-3.5 text-zinc-300 whitespace-nowrap">
                              {fmtDate(leave.start_date)}
                              {leave.start_date !== leave.end_date && (
                                <span className="text-zinc-500">
                                  {" "}→ {fmtDate(leave.end_date)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-zinc-400 whitespace-nowrap">
                              {days} {days === 1 ? "day" : "days"}
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span
                                className={`text-[11px] font-medium px-2.5 py-1 rounded-full border capitalize ${statusStyle[leave.status]}`}
                              >
                                {leave.status}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-zinc-500 text-xs whitespace-nowrap">
                              {fmtDate(leave.created_at)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
