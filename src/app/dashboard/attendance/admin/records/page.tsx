"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────────────────────────────────

type Employee = {
  id: string;
  full_name: string;
  role: string;
  joining_date: string | null;
};

type AttendanceRecord = {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  is_late: boolean;
  employees: { full_name: string } | null;
};

type AttendanceRaw = {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
};

type LeaveRaw = {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
};

type OfficeSettings = {
  office_start_time: string;
  office_end_time: string;
  grace_period_minutes: number;
};

type EmployeeSummary = {
  employee: Employee;
  cycleStart: string;
  cycleEnd: string;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  totalMinutes: number;
  overtimeMinutes: number;
  absentDates: string[];
  leaveDates: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nowIST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

function todayIST(): string {
  const d = nowIST();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(ts: string): string {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

function hoursWorked(checkIn: string, checkOut: string | null): string {
  if (!checkOut) return "—";
  const mins = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return `${h}h ${m}m`;
}

function toISTTime(ts: string): string {
  const d = new Date(ts);
  const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${String(ist.getHours()).padStart(2, "0")}:${String(ist.getMinutes()).padStart(2, "0")}`;
}

function fmtHHMM(totalMinutes: number): string {
  const h = Math.floor(Math.abs(totalMinutes) / 60);
  const m = Math.round(Math.abs(totalMinutes) % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtDateShort(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function isSunday(dateStr: string): boolean {
  return new Date(dateStr + "T00:00:00").getDay() === 0;
}

function getCycle(
  joiningDate: string | null,
  refYear: number,
  refMonth: number
): { start: string; end: string } {
  if (!joiningDate) {
    const start = `${refYear}-${String(refMonth).padStart(2, "0")}-01`;
    const lastDay = new Date(refYear, refMonth, 0).getDate();
    return {
      start,
      end: `${refYear}-${String(refMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  const joiningDay = new Date(joiningDate + "T00:00:00").getDate();
  const daysInRef = new Date(refYear, refMonth, 0).getDate();
  const startDay = Math.min(joiningDay, daysInRef);
  const cycleStart = `${refYear}-${String(refMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`;

  const endDay = joiningDay - 1;
  let cycleEnd: string;
  if (endDay === 0) {
    cycleEnd = `${refYear}-${String(refMonth).padStart(2, "0")}-${String(daysInRef).padStart(2, "0")}`;
  } else {
    const nextYear = refMonth === 12 ? refYear + 1 : refYear;
    const nextMon = refMonth === 12 ? 1 : refMonth + 1;
    const daysInNext = new Date(nextYear, nextMon, 0).getDate();
    const actualEndDay = Math.min(endDay, daysInNext);
    cycleEnd = `${nextYear}-${String(nextMon).padStart(2, "0")}-${String(actualEndDay).padStart(2, "0")}`;
  }

  return { start: cycleStart, end: cycleEnd };
}

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cur <= last) {
    dates.push(cur.toISOString().split("T")[0]);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

function getApprovedLeaveDates(
  leaves: LeaveRaw[],
  employeeId: string,
  cycleStart: string,
  cycleEnd: string
): string[] {
  const result: string[] = [];
  for (const lv of leaves) {
    if (lv.employee_id !== employeeId) continue;
    for (const d of getDatesInRange(lv.start_date, lv.end_date)) {
      if (d >= cycleStart && d <= cycleEnd && !isSunday(d) && !result.includes(d)) {
        result.push(d);
      }
    }
  }
  return result.sort();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminAttendanceRecordsPage() {
  const [activeView, setActiveView] = useState<"summary" | "records">("summary");
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [summaryAtt, setSummaryAtt] = useState<AttendanceRaw[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRaw[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);

  const [acting, setActing] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const istNow = nowIST();
  const today = todayIST();

  const [cycleYear, setCycleYear] = useState(istNow.getFullYear());
  const [cycleMonth, setCycleMonth] = useState(istNow.getMonth() + 1);
  const [selectedMonth, setSelectedMonth] = useState(
    `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, "0")}`
  );

  // Auth + static data
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

      const [empRes, settingsRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, role, joining_date")
          .order("full_name"),
        supabase
          .from("office_settings")
          .select("office_start_time, office_end_time, grace_period_minutes")
          .single(),
      ]);

      setEmployees(empRes.data ?? []);
      setOfficeSettings(settingsRes.data ?? null);
      setAuthorized(true);
      setLoading(false);
    };
    init();
  }, []);

  // Fetch summary data when cycle changes
  useEffect(() => {
    if (!authorized) return;
    const fetchSummary = async () => {
      const supabase = createClient();
      // Wide range covers all possible employee cycles for this reference month
      const prevM = cycleMonth === 1 ? 12 : cycleMonth - 1;
      const prevY = cycleMonth === 1 ? cycleYear - 1 : cycleYear;
      const nextM = cycleMonth === 12 ? 1 : cycleMonth + 1;
      const nextY = cycleMonth === 12 ? cycleYear + 1 : cycleYear;
      const wideStart = `${prevY}-${String(prevM).padStart(2, "0")}-01`;
      const wideEnd = `${nextY}-${String(nextM).padStart(2, "0")}-${String(new Date(nextY, nextM, 0).getDate()).padStart(2, "0")}`;

      const [attRes, lvRes] = await Promise.all([
        supabase
          .from("attendance")
          .select("id, employee_id, date, check_in, check_out")
          .gte("date", wideStart)
          .lte("date", wideEnd),
        supabase
          .from("leaves")
          .select("id, employee_id, start_date, end_date, status")
          .eq("status", "approved"),
      ]);

      setSummaryAtt(attRes.data ?? []);
      setApprovedLeaves(lvRes.data ?? []);
    };
    fetchSummary();
  }, [cycleYear, cycleMonth, authorized]);

  // Fetch records for records view
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

  // Compute per-employee summaries
  const summaries: EmployeeSummary[] = useMemo(() => {
    return employees.map((emp) => {
      const { start, end } = getCycle(emp.joining_date, cycleYear, cycleMonth);
      const allDates = getDatesInRange(start, end);
      const workingDays = allDates.filter((d) => !isSunday(d)).length;
      const pastWorkingDates = allDates.filter((d) => !isSunday(d) && d <= today);

      const leaveDates = getApprovedLeaveDates(approvedLeaves, emp.id, start, end);
      const empAtt = summaryAtt.filter(
        (r) => r.employee_id === emp.id && r.date >= start && r.date <= end
      );
      const presentSet = new Set(empAtt.map((r) => r.date));
      const presentDays = [...presentSet].filter((d) => d <= today).length;
      const leaveDays = leaveDates.filter((d) => d <= today).length;
      const absentDates = pastWorkingDates.filter(
        (d) => !presentSet.has(d) && !leaveDates.includes(d)
      );

      let totalMinutes = 0;
      let overtimeMinutes = 0;
      for (const rec of empAtt) {
        if (!rec.check_out) continue;
        const mins =
          (new Date(rec.check_out).getTime() - new Date(rec.check_in).getTime()) / 60000;
        totalMinutes += mins;
        if (mins > 480) overtimeMinutes += mins - 480;
      }

      return {
        employee: emp,
        cycleStart: start,
        cycleEnd: end,
        workingDays,
        presentDays,
        leaveDays,
        absentDays: absentDates.length,
        totalMinutes,
        overtimeMinutes,
        absentDates,
        leaveDates,
      };
    });
  }, [employees, summaryAtt, approvedLeaves, cycleYear, cycleMonth, today]);

  // CSV export
  const exportCSV = () => {
    const headers = [
      "Employee Name",
      "Role",
      "Cycle Start",
      "Cycle End",
      "Working Days",
      "Present Days",
      "Absent Days",
      "Leave Days",
      "Total Hours Worked",
      "Overtime Hours",
      "Absent Dates",
    ];
    const rows = summaries.map((s) => [
      s.employee.full_name,
      s.employee.role,
      s.cycleStart,
      s.cycleEnd,
      s.workingDays,
      s.presentDays,
      s.absentDays,
      s.leaveDays,
      fmtHHMM(s.totalMinutes),
      fmtHHMM(s.overtimeMinutes),
      s.absentDates.map(fmtDateShort).join("; "),
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const first = summaries[0];
    const fileStart =
      first?.cycleStart ?? `${cycleYear}-${String(cycleMonth).padStart(2, "0")}-01`;
    const fileEnd =
      first?.cycleEnd ?? `${cycleYear}-${String(cycleMonth).padStart(2, "0")}-30`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_cycle_${fileStart}_to_${fileEnd}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Cycle navigation
  const prevCycle = () => {
    if (cycleMonth === 1) {
      setCycleYear((y) => y - 1);
      setCycleMonth(12);
    } else {
      setCycleMonth((m) => m - 1);
    }
  };
  const nextCycle = () => {
    const isCurrent =
      cycleYear === istNow.getFullYear() && cycleMonth === istNow.getMonth() + 1;
    if (isCurrent) return;
    if (cycleMonth === 12) {
      setCycleYear((y) => y + 1);
      setCycleMonth(1);
    } else {
      setCycleMonth((m) => m + 1);
    }
  };
  const isCurrent =
    cycleYear === istNow.getFullYear() && cycleMonth === istNow.getMonth() + 1;
  const cycleLabel = new Date(cycleYear, cycleMonth - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // Records view handlers (unchanged)
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
    if (!error && data) setRecords((prev) => prev.map((r) => (r.id === rec.id ? data : r)));
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
    if (data) setRecords((prev) => prev.map((r) => (r.id === rec.id ? data : r)));
    setEditId(null);
    setActing(null);
  };

  const isIncomplete = (rec: AttendanceRecord) => !rec.check_out && rec.date < today;

  // ─── Render ───────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1 shrink-0">
          <button
            onClick={() => setActiveView("summary")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              activeView === "summary"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveView("records")}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              activeView === "records"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Records
          </button>
        </div>
      </header>

      {/* ── SUMMARY VIEW ─────────────────────────────────────────────────── */}
      {activeView === "summary" && (
        <div className="px-4 py-6 md:px-8 md:py-8 space-y-6">
          {/* Cycle navigator + Export */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={prevCycle}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                ← Previous
              </button>
              <span className="text-sm font-semibold text-white min-w-[130px] text-center">
                {cycleLabel}
              </span>
              <button
                onClick={nextCycle}
                disabled={isCurrent}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
            <button
              onClick={exportCSV}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-2 rounded-lg border border-emerald-500/20 transition-colors whitespace-nowrap"
            >
              Export CSV
            </button>
          </div>

          {summaries.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-10 text-center">
              <p className="text-zinc-400 text-sm">No employees found.</p>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Employee
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Cycle
                      </th>
                      <th className="text-center px-4 py-3 text-zinc-500 font-medium">
                        Working Days
                      </th>
                      <th className="text-center px-4 py-3 text-zinc-500 font-medium">
                        Present
                      </th>
                      <th className="text-center px-4 py-3 text-zinc-500 font-medium">
                        Leave
                      </th>
                      <th className="text-center px-4 py-3 text-zinc-500 font-medium">
                        Absent
                      </th>
                      <th className="text-center px-4 py-3 text-zinc-500 font-medium">
                        Hours Worked
                      </th>
                      <th className="text-center px-4 py-3 text-zinc-500 font-medium">
                        Overtime
                      </th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">
                        Absent Dates
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {summaries.flatMap((s) => {
                      const isExpanded = expandedEmployee === s.employee.id;
                      const hasDetail =
                        s.absentDates.length > 0 || s.leaveDates.length > 0;
                      const rows = [
                        <tr
                          key={s.employee.id}
                          className="bg-zinc-900/40 hover:bg-zinc-800/40 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <p className="text-white font-semibold whitespace-nowrap">
                              {s.employee.full_name}
                            </p>
                            <p className="text-zinc-500 text-xs">{s.employee.role}</p>
                          </td>
                          <td className="px-4 py-3 text-zinc-400 text-xs whitespace-nowrap">
                            {fmtDateShort(s.cycleStart)} → {fmtDateShort(s.cycleEnd)}
                          </td>
                          <td className="px-4 py-3 text-center text-zinc-300">
                            {s.workingDays}
                          </td>
                          <td className="px-4 py-3 text-center text-emerald-400 font-semibold">
                            {s.presentDays}
                          </td>
                          <td className="px-4 py-3 text-center text-blue-400">
                            {s.leaveDays}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={
                                s.absentDays > 0
                                  ? "text-red-400 font-semibold"
                                  : "text-zinc-500"
                              }
                            >
                              {s.absentDays}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-xs text-zinc-300">
                            {fmtHHMM(s.totalMinutes)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={
                                s.overtimeMinutes > 0
                                  ? "text-amber-400 font-mono text-xs"
                                  : "text-zinc-600 text-xs"
                              }
                            >
                              {s.overtimeMinutes > 0 ? fmtHHMM(s.overtimeMinutes) : "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {hasDetail ? (
                              <button
                                onClick={() =>
                                  setExpandedEmployee(
                                    isExpanded ? null : s.employee.id
                                  )
                                }
                                className="text-xs text-zinc-400 hover:text-white underline underline-offset-2 transition-colors whitespace-nowrap"
                              >
                                {isExpanded
                                  ? "Hide"
                                  : `Show ${s.absentDates.length} absent`}
                              </button>
                            ) : (
                              <span className="text-zinc-600 text-xs">—</span>
                            )}
                          </td>
                        </tr>,
                      ];

                      if (isExpanded && hasDetail) {
                        rows.push(
                          <tr key={`${s.employee.id}-detail`} className="bg-zinc-950">
                            <td colSpan={9} className="px-4 py-3">
                              <div className="flex flex-wrap gap-2">
                                {s.absentDates.map((d) => (
                                  <span
                                    key={d}
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-full text-red-400 bg-red-400/10 border border-red-400/20 whitespace-nowrap"
                                  >
                                    {fmtDateShort(d)} — Absent
                                  </span>
                                ))}
                                {s.leaveDates.map((d) => (
                                  <span
                                    key={d}
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-full text-blue-400 bg-blue-400/10 border border-blue-400/20 whitespace-nowrap"
                                  >
                                    {fmtDateShort(d)} — On Leave
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return rows;
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RECORDS VIEW ─────────────────────────────────────────────────── */}
      {activeView === "records" && (
        <div className="px-4 py-6 md:px-8 md:py-8 space-y-8">
          <div className="flex justify-end">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500 shrink-0"
            />
          </div>

          {/* Incomplete records */}
          {incomplete.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-amber-500/80 uppercase tracking-widest mb-3">
                Missing Check-Out — {incomplete.length} record
                {incomplete.length !== 1 ? "s" : ""}
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

          {/* All records */}
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
                        const recIncomplete = isIncomplete(rec);
                        const isEditing = editId === rec.id;

                        if (isEditing) {
                          return (
                            <tr key={rec.id} className="bg-zinc-800/40">
                              <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                                {rec.employees?.full_name ?? "Unknown"}
                              </td>
                              <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                                {new Date(rec.date + "T00:00:00").toLocaleDateString(
                                  "en-IN",
                                  { weekday: "short", day: "numeric", month: "short" }
                                )}
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
                                  onChange={(e) => setEditCheckOut(e.target.value)}
                                  className="bg-zinc-700 border border-zinc-600 text-white rounded px-2 py-1 text-xs w-28 focus:outline-none focus:border-zinc-500"
                                />
                              </td>
                              <td className="px-4 py-3 text-zinc-600 text-xs">—</td>
                              <td className="px-4 py-3 text-zinc-600 text-xs">recalc</td>
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
                                  <p className="text-red-400 text-xs mt-1">{editError}</p>
                                )}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr
                            key={rec.id}
                            className={
                              recIncomplete
                                ? "bg-amber-500/5 border-l-2 border-l-amber-500/40"
                                : "bg-zinc-900/40"
                            }
                          >
                            <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                              {rec.employees?.full_name ?? "Unknown"}
                            </td>
                            <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                              {new Date(rec.date + "T00:00:00").toLocaleDateString(
                                "en-IN",
                                { weekday: "short", day: "numeric", month: "short" }
                              )}
                            </td>
                            <td className="px-4 py-3 text-white whitespace-nowrap">
                              {fmt(rec.check_in)}
                            </td>
                            <td
                              className={`px-4 py-3 whitespace-nowrap ${
                                recIncomplete ? "text-amber-400" : "text-zinc-400"
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
                                {recIncomplete && (
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
      )}
    </div>
  );
}
