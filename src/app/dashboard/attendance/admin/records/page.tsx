"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type AttendanceRecord = {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  is_late: boolean;
  employees: { full_name: string } | null;
};

type OfficeSettings = {
  office_start_time: string;
  office_end_time: string;
  grace_period_minutes: number;
};

function nowIST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function todayIST() {
  const d = nowIST();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
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

function toISTTime(ts: string): string {
  const d = new Date(ts);
  const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${String(ist.getHours()).padStart(2, "0")}:${String(ist.getMinutes()).padStart(2, "0")}`;
}

export default function AdminAttendanceRecordsPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const istNow = nowIST();
  const today = todayIST();

  const [selectedMonth, setSelectedMonth] = useState(
    `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, "0")}`
  );

  // Auth check on mount
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

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

      const { data: settings } = await supabase
        .from("office_settings")
        .select("office_start_time, office_end_time, grace_period_minutes")
        .single();
      setOfficeSettings(settings ?? null);

      setAuthorized(true);
      setLoading(false);
    };
    init();
  }, []);

  // Fetch records when month changes (after auth)
  useEffect(() => {
    if (!authorized) return;

    const fetchRecords = async () => {
      const supabase = createClient();
      const [year, mon] = selectedMonth.split("-").map(Number);
      const monthStart = `${year}-${String(mon).padStart(2, "0")}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const monthEnd = `${year}-${String(mon).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data } = await supabase
        .from("attendance")
        .select("*, employees(full_name)")
        .gte("date", monthStart)
        .lte("date", monthEnd)
        .order("date", { ascending: false });

      setRecords(data ?? []);
    };

    fetchRecords();
  }, [selectedMonth, authorized]);

  const handleMarkComplete = async (rec: AttendanceRecord) => {
    setActing(rec.id);
    const supabase = createClient();
    const endTime = (officeSettings?.office_end_time ?? "19:00:00").slice(0, 5);
    const checkOutISO = new Date(`${rec.date}T${endTime}:00+05:30`).toISOString();

    const { data, error } = await supabase
      .from("attendance")
      .update({ check_out: checkOutISO })
      .eq("id", rec.id)
      .select("*, employees(full_name)")
      .single();

    if (!error && data) {
      setRecords((prev) => prev.map((r) => (r.id === rec.id ? data : r)));
    }
    setActing(null);
  };

  const startEdit = (rec: AttendanceRecord) => {
    setEditId(rec.id);
    setEditCheckIn(toISTTime(rec.check_in));
    setEditCheckOut(rec.check_out ? toISTTime(rec.check_out) : "");
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditId(null);
    setEditError(null);
  };

  const saveEdit = async (rec: AttendanceRecord) => {
    if (!editCheckIn) {
      setEditError("Check-in time is required.");
      return;
    }
    setActing(rec.id);
    setEditError(null);
    const supabase = createClient();

    const checkInISO = new Date(`${rec.date}T${editCheckIn}:00+05:30`).toISOString();
    const checkOutISO = editCheckOut
      ? new Date(`${rec.date}T${editCheckOut}:00+05:30`).toISOString()
      : null;

    // Recalculate is_late based on edited check-in time
    const [ch, cm] = editCheckIn.split(":").map(Number);
    const [sh, sm] = (officeSettings?.office_start_time ?? "10:00:00")
      .split(":")
      .map(Number);
    const grace = officeSettings?.grace_period_minutes ?? 15;
    const isLate = ch * 60 + cm > sh * 60 + sm + grace;

    const { data, error } = await supabase
      .from("attendance")
      .update({ check_in: checkInISO, check_out: checkOutISO, is_late: isLate })
      .eq("id", rec.id)
      .select("*, employees(full_name)")
      .single();

    if (error) {
      setEditError(error.message);
      setActing(null);
      return;
    }
    if (data) {
      setRecords((prev) => prev.map((r) => (r.id === rec.id ? data : r)));
    }
    setEditId(null);
    setActing(null);
  };

  const isIncomplete = (rec: AttendanceRecord) =>
    !rec.check_out && rec.date < today;

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;

  if (unauthorized) {
    return (
      <div className="text-white">
        <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Attendance · Admin
          </p>
          <h1 className="text-base md:text-lg font-bold text-white mt-0.5">
            Attendance Records
          </h1>
        </header>
        <div className="px-4 py-6 md:px-8 md:py-8">
          <div className="bg-zinc-900 border border-red-500/20 rounded-xl px-6 py-6">
            <p className="text-red-400 text-sm font-medium">Access Denied</p>
            <p className="text-zinc-500 text-sm mt-1">
              This page is only accessible to Admin users.
            </p>
            <Link
              href="/dashboard/attendance/admin"
              className="inline-block mt-4 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ← Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const incomplete = records.filter(isIncomplete);

  return (
    <div className="text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/attendance/admin"
            className="text-zinc-400 hover:text-white text-sm transition-colors shrink-0"
          >
            ← Leave Requests
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Attendance · Admin
            </p>
            <h1 className="text-base md:text-lg font-bold text-white mt-0.5">
              Attendance Records
            </h1>
          </div>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 shrink-0"
        />
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 space-y-8">
        {/* Incomplete records */}
        {incomplete.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-amber-500/80 uppercase tracking-widest mb-3">
              Missing Check-Out — {incomplete.length} record{incomplete.length !== 1 ? "s" : ""}
            </h2>
            <div className="space-y-2">
              {incomplete.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-amber-500/5 border border-amber-500/30 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 justify-between"
                >
                  <div className="flex flex-wrap items-center gap-4 text-sm min-w-0">
                    <span className="text-amber-300 font-semibold whitespace-nowrap">
                      {rec.employees?.full_name ?? "Unknown"}
                    </span>
                    <span className="text-zinc-400 whitespace-nowrap">
                      {new Date(rec.date + "T00:00:00").toLocaleDateString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="text-zinc-300 whitespace-nowrap">
                      In: {fmt(rec.check_in)}
                    </span>
                    <span className="text-amber-500/70 text-xs font-medium whitespace-nowrap">
                      No check-out
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleMarkComplete(rec)}
                      disabled={acting === rec.id}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {acting === rec.id ? "…" : "Mark as Complete"}
                    </button>
                    <button
                      onClick={() => startEdit(rec)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All records table */}
        <div>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">
            All Records —{" "}
            {new Date(selectedMonth + "-01").toLocaleDateString("en-IN", {
              month: "long",
              year: "numeric",
            })}
          </h2>

          {records.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
              <p className="text-zinc-400 text-sm">
                No attendance records for this month.
              </p>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[700px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Employee
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Date
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Check In
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Check Out
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Hours
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {records.map((rec) => {
                      const incomplete = isIncomplete(rec);
                      const isEditing = editId === rec.id;

                      if (isEditing) {
                        return (
                          <tr key={rec.id} className="bg-zinc-800/40">
                            <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                              {rec.employees?.full_name ?? "Unknown"}
                            </td>
                            <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                              {new Date(
                                rec.date + "T00:00:00"
                              ).toLocaleDateString("en-IN", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="time"
                                value={editCheckIn}
                                onChange={(e) => setEditCheckIn(e.target.value)}
                                className="bg-zinc-700 border border-zinc-600 text-white rounded px-2 py-1 text-xs w-28 focus:outline-none focus:border-zinc-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="time"
                                value={editCheckOut}
                                onChange={(e) =>
                                  setEditCheckOut(e.target.value)
                                }
                                className="bg-zinc-700 border border-zinc-600 text-white rounded px-2 py-1 text-xs w-28 focus:outline-none focus:border-zinc-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-xs">
                              —
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-xs">
                              recalc
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => saveEdit(rec)}
                                  disabled={acting === rec.id}
                                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50"
                                >
                                  {acting === rec.id ? "…" : "Save"}
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-zinc-400 hover:text-white text-xs px-2 py-1.5 transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                              {editError && (
                                <p className="text-red-400 text-xs mt-1">
                                  {editError}
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={rec.id}
                          className={
                            incomplete
                              ? "bg-amber-500/5 border-l-2 border-l-amber-500/40"
                              : "bg-zinc-900/40"
                          }
                        >
                          <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                            {rec.employees?.full_name ?? "Unknown"}
                          </td>
                          <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                            {new Date(
                              rec.date + "T00:00:00"
                            ).toLocaleDateString("en-IN", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                            })}
                          </td>
                          <td className="px-4 py-3 text-white whitespace-nowrap">
                            {fmt(rec.check_in)}
                          </td>
                          <td
                            className={`px-4 py-3 whitespace-nowrap ${
                              incomplete ? "text-amber-400" : "text-zinc-400"
                            }`}
                          >
                            {rec.check_out ? fmt(rec.check_out) : "Missing"}
                          </td>
                          <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                            {hoursWorked(rec.check_in, rec.check_out)}
                          </td>
                          <td className="px-4 py-3">
                            {rec.is_late ? (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10 whitespace-nowrap">
                                Late
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/10 whitespace-nowrap">
                                On Time
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {incomplete && (
                                <button
                                  onClick={() => handleMarkComplete(rec)}
                                  disabled={acting === rec.id}
                                  className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                  {acting === rec.id ? "…" : "Mark Complete"}
                                </button>
                              )}
                              <button
                                onClick={() => startEdit(rec)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                              >
                                Edit
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
