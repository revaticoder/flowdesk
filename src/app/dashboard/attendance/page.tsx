"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Employee = { id: string; full_name: string; email: string };

type AttendanceRecord = {
  id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  is_late: boolean;
};

const LATE_HOUR = 10; // 10:00 AM

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function hoursWorked(checkIn: string, checkOut: string | null) {
  if (!checkOut) return "—";
  const mins =
    (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

export default function AttendancePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = todayISO();
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Month bounds for history
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthEnd = new Date(nextMonth.getTime() - 1).toISOString().split("T")[0];

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();

      // Get logged-in user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Match employee by email
      const { data: emp } = await supabase
        .from("employees")
        .select("id, full_name, email")
        .eq("email", user.email)
        .single();

      if (!emp) {
        setLoading(false);
        return;
      }
      setEmployee(emp);

      // Fetch today's record
      const { data: todayData } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", emp.id)
        .eq("date", today)
        .maybeSingle();

      setTodayRecord(todayData ?? null);

      // Fetch this month's history
      const { data: hist } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", emp.id)
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false });

      setHistory(hist ?? []);
      setLoading(false);
    };

    init();
  }, [today, monthStart, monthEnd]);

  const handleCheckIn = async () => {
    if (!employee) return;
    setActing(true);
    setError(null);
    const supabase = createClient();
    const checkInTime = new Date().toISOString();
    const isLate = new Date().getHours() >= LATE_HOUR;

    const { data, error: err } = await supabase
      .from("attendance")
      .insert({
        employee_id: employee.id,
        date: today,
        check_in: checkInTime,
        is_late: isLate,
      })
      .select()
      .single();

    if (err) {
      setError(err.message);
    } else {
      setTodayRecord(data);
      setHistory((prev) => [data, ...prev.filter((r) => r.date !== today)]);
    }
    setActing(false);
  };

  const handleCheckOut = async () => {
    if (!employee || !todayRecord) return;
    setActing(true);
    setError(null);
    const supabase = createClient();
    const checkOutTime = new Date().toISOString();

    const { data, error: err } = await supabase
      .from("attendance")
      .update({ check_out: checkOutTime })
      .eq("id", todayRecord.id)
      .select()
      .single();

    if (err) {
      setError(err.message);
    } else {
      setTodayRecord(data);
      setHistory((prev) => prev.map((r) => (r.id === data.id ? data : r)));
    }
    setActing(false);
  };

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Attendance
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">{dateLabel}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/attendance/my-leaves"
            className="text-sm text-zinc-400 hover:text-white transition-colors"
          >
            My Leaves
          </Link>
          <Link
            href="/dashboard/attendance/leave"
            className="bg-zinc-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Apply Leave
          </Link>
        </div>
      </header>

      <div className="px-8 py-8 max-w-3xl space-y-8">
        {loading ? (
          <p className="text-zinc-500 text-sm">Loading...</p>
        ) : !employee ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <p className="text-zinc-400 text-sm">
              No employee record found for your account. Ask an admin to add
              your email to the People directory.
            </p>
          </div>
        ) : (
          <>
            {/* Check-in card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <p className="text-zinc-400 text-sm mb-1">
                {employee.full_name}
              </p>

              {!todayRecord ? (
                <div>
                  <p className="text-white text-base font-medium mb-4">
                    You haven&apos;t checked in today.
                  </p>
                  <button
                    onClick={handleCheckIn}
                    disabled={acting}
                    className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {acting ? "Checking in..." : "Check In"}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">
                        Checked In
                      </p>
                      <p className="text-white font-semibold text-lg">
                        {fmt(todayRecord.check_in)}
                      </p>
                    </div>
                    {todayRecord.check_out && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">
                          Checked Out
                        </p>
                        <p className="text-white font-semibold text-lg">
                          {fmt(todayRecord.check_out)}
                        </p>
                      </div>
                    )}
                    {todayRecord.check_out && (
                      <div>
                        <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">
                          Hours Worked
                        </p>
                        <p className="text-white font-semibold text-lg">
                          {hoursWorked(
                            todayRecord.check_in,
                            todayRecord.check_out
                          )}
                        </p>
                      </div>
                    )}
                    {todayRecord.is_late && (
                      <span className="self-end mb-1 text-[11px] font-medium px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10">
                        Late
                      </span>
                    )}
                  </div>

                  {!todayRecord.check_out && (
                    <button
                      onClick={handleCheckOut}
                      disabled={acting}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm px-6 py-2.5 rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
                    >
                      {acting ? "Checking out..." : "Check Out"}
                    </button>
                  )}
                </div>
              )}

              {error && (
                <p className="mt-3 text-red-400 text-sm">{error}</p>
              )}
            </div>

            {/* Month history */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-widest">
                {now.toLocaleDateString("en-IN", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>

              {history.length === 0 ? (
                <p className="text-zinc-500 text-sm">No records this month.</p>
              ) : (
                <div className="border border-zinc-800 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900">
                        <th className="text-left px-5 py-3 text-zinc-500 font-medium">
                          Date
                        </th>
                        <th className="text-left px-5 py-3 text-zinc-500 font-medium">
                          Check In
                        </th>
                        <th className="text-left px-5 py-3 text-zinc-500 font-medium">
                          Check Out
                        </th>
                        <th className="text-left px-5 py-3 text-zinc-500 font-medium">
                          Hours
                        </th>
                        <th className="text-left px-5 py-3 text-zinc-500 font-medium">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {history.map((rec) => (
                        <tr key={rec.id} className="bg-zinc-900/40">
                          <td className="px-5 py-3 text-zinc-300">
                            {new Date(rec.date).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td className="px-5 py-3 text-white">
                            {fmt(rec.check_in)}
                          </td>
                          <td className="px-5 py-3 text-zinc-400">
                            {rec.check_out ? fmt(rec.check_out) : "—"}
                          </td>
                          <td className="px-5 py-3 text-zinc-400">
                            {hoursWorked(rec.check_in, rec.check_out)}
                          </td>
                          <td className="px-5 py-3">
                            {rec.is_late ? (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10">
                                Late
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/10">
                                On Time
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
