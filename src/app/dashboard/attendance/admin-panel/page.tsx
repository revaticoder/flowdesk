"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Employee = { id: string; full_name: string; role: string };

type AttendanceRecord = {
  id: string;
  employee_id: string;
  date: string;
  check_in: string;
  check_out: string | null;
  is_late: boolean;
};

type LeaveRecord = {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  rejected_reason?: string | null;
  created_at: string;
  employees?: { full_name: string } | null;
};

type OfficeSettings = {
  office_start_time: string;
  office_end_time: string;
  grace_period_minutes: number;
};

type CellStatus = "present" | "late" | "absent" | "leave" | "weekend" | "future";

// ─── Utilities ─────────────────────────────────────────────────────────────────

function nowIST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}
function todayIST() {
  const d = nowIST();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmt(ts: string) {
  return new Date(ts).toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata",
  });
}
function hoursWorked(ci: string, co: string | null): string {
  if (!co) return "—";
  const mins = (new Date(co).getTime() - new Date(ci).getTime()) / 60000;
  return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
}
function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}
function leaveDays(s: string, e: string): number {
  return (
    Math.floor((new Date(e + "T00:00:00").getTime() - new Date(s + "T00:00:00").getTime()) / 86400000) + 1
  );
}
function toISTTime(ts: string): string {
  const ist = new Date(new Date(ts).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return `${String(ist.getHours()).padStart(2, "0")}:${String(ist.getMinutes()).padStart(2, "0")}`;
}
function isWeekend(y: number, m: number, d: number): boolean {
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AdminPanelPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [officeSettings, setOfficeSettings] = useState<OfficeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  // Daily view
  const [selectedDate, setSelectedDate] = useState(todayIST());
  const [dailyAttendance, setDailyAttendance] = useState<AttendanceRecord[]>([]);
  const [dailyLeaves, setDailyLeaves] = useState<Pick<LeaveRecord, "employee_id" | "start_date" | "end_date">[]>([]);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyRefresh, setDailyRefresh] = useState(0);

  // Monthly matrix
  const istNow = nowIST();
  const [selectedMonth, setSelectedMonth] = useState(
    `${istNow.getFullYear()}-${String(istNow.getMonth() + 1).padStart(2, "0")}`
  );
  const [monthlyAttendance, setMonthlyAttendance] = useState<AttendanceRecord[]>([]);
  const [monthlyLeaves, setMonthlyLeaves] = useState<Pick<LeaveRecord, "employee_id" | "start_date" | "end_date">[]>([]);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // Leaves
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRecord[]>([]);
  const [processedLeaves, setProcessedLeaves] = useState<LeaveRecord[]>([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leavesTick, setLeavesTick] = useState(0);

  // Edit modal
  const [editModal, setEditModal] = useState<{
    empId: string; empName: string; date: string; record: AttendanceRecord | null;
  } | null>(null);
  const [editCI, setEditCI] = useState("");
  const [editCO, setEditCO] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [acting, setActing] = useState<string | null>(null);

  // Cell detail modal
  const [cellDetail, setCellDetail] = useState<{
    empName: string; date: string; rec: AttendanceRecord | null; status: CellStatus;
  } | null>(null);

  // ── Auth ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees").select("role").eq("email", user.email).single();
      if (!emp || emp.role !== "Admin") { setUnauthorized(true); setLoading(false); return; }

      const [{ data: emps }, { data: settings }] = await Promise.all([
        supabase.from("employees").select("id, full_name, role").eq("is_active", true).order("full_name"),
        supabase.from("office_settings").select("*").single(),
      ]);
      setEmployees(emps ?? []);
      setOfficeSettings(settings ?? null);
      setAuthorized(true);
      setLoading(false);
    })();
  }, []);

  // ── Daily data ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      setDailyLoading(true);
      const supabase = createClient();
      const [{ data: att }, { data: lv }] = await Promise.all([
        supabase.from("attendance").select("*").eq("date", selectedDate),
        supabase.from("leaves")
          .select("employee_id, start_date, end_date")
          .lte("start_date", selectedDate)
          .gte("end_date", selectedDate)
          .eq("status", "approved"),
      ]);
      setDailyAttendance(att ?? []);
      setDailyLeaves(lv ?? []);
      setDailyLoading(false);
    })();
  }, [authorized, selectedDate, dailyRefresh]);

  // ── Monthly matrix ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      setMatrixLoading(true);
      const supabase = createClient();
      const [y, m] = selectedMonth.split("-").map(Number);
      const ms = `${y}-${String(m).padStart(2, "0")}-01`;
      const me = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      const [{ data: att }, { data: lv }] = await Promise.all([
        supabase.from("attendance").select("*").gte("date", ms).lte("date", me),
        supabase.from("leaves")
          .select("employee_id, start_date, end_date")
          .lte("start_date", me)
          .gte("end_date", ms)
          .eq("status", "approved"),
      ]);
      setMonthlyAttendance(att ?? []);
      setMonthlyLeaves(lv ?? []);
      setMatrixLoading(false);
    })();
  }, [authorized, selectedMonth]);

  // ── Leaves ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      setLeavesLoading(true);
      const supabase = createClient();
      const [{ data: pending }, { data: processed }] = await Promise.all([
        supabase.from("leaves").select("*, employees(full_name)").eq("status", "pending").order("created_at"),
        supabase.from("leaves").select("*, employees(full_name)").neq("status", "pending")
          .order("created_at", { ascending: false }).limit(100),
      ]);
      setPendingLeaves(pending ?? []);
      setProcessedLeaves(processed ?? []);
      setLeavesLoading(false);
    })();
  }, [authorized, leavesTick]);

  // ── Computed: daily rows ─────────────────────────────────────────────────────

  const dailyRows = employees.map((emp) => {
    const attendance = dailyAttendance.find((a) => a.employee_id === emp.id) ?? null;
    const onLeave = dailyLeaves.some((l) => l.employee_id === emp.id);
    const status: "present" | "absent" | "on_leave" = attendance ? "present" : onLeave ? "on_leave" : "absent";
    return { employee: emp, attendance, status };
  });

  // ── Computed: monthly matrix ─────────────────────────────────────────────────

  const [matYear, matMon] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(matYear, matMon, 0).getDate();
  const today = todayIST();

  const attMap = new Map<string, AttendanceRecord>();
  monthlyAttendance.forEach((rec) => {
    attMap.set(`${rec.employee_id}-${parseInt(rec.date.split("-")[2])}`, rec);
  });

  const leaveSet = new Set<string>();
  monthlyLeaves.forEach((leave) => {
    const start = new Date(leave.start_date + "T00:00:00");
    const end = new Date(leave.end_date + "T00:00:00");
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(matYear, matMon - 1, d) >= start && new Date(matYear, matMon - 1, d) <= end) {
        leaveSet.add(`${leave.employee_id}-${d}`);
      }
    }
  });

  const getCellStatus = (empId: string, day: number): CellStatus => {
    const dateStr = `${matYear}-${String(matMon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (dateStr > today) return "future";
    if (isWeekend(matYear, matMon, day)) return "weekend";
    if (leaveSet.has(`${empId}-${day}`)) return "leave";
    const rec = attMap.get(`${empId}-${day}`);
    if (!rec) return "absent";
    return rec.is_late ? "late" : "present";
  };

  const CELL_STYLE: Record<CellStatus, string> = {
    present: "text-emerald-400 bg-emerald-400/10 hover:bg-emerald-400/20 cursor-pointer",
    late: "text-amber-400 bg-amber-400/10 hover:bg-amber-400/20 cursor-pointer ring-1 ring-amber-500/20",
    absent: "text-red-400 bg-red-400/10 hover:bg-red-400/20 cursor-pointer",
    leave: "text-blue-400 bg-blue-400/10 hover:bg-blue-400/20 cursor-pointer",
    weekend: "text-zinc-700 cursor-default",
    future: "text-zinc-800 cursor-default",
  };
  const CELL_LABEL: Record<CellStatus, string> = {
    present: "P", late: "P", absent: "A", leave: "L", weekend: "–", future: "·",
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const openEdit = (empId: string, empName: string, record: AttendanceRecord | null, date: string) => {
    setEditModal({ empId, empName, date, record });
    setEditCI(record ? toISTTime(record.check_in) : "");
    setEditCO(record?.check_out ? toISTTime(record.check_out) : "");
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editModal) return;
    if (!editCI) { setEditError("Check-in time is required."); return; }
    setEditSaving(true);
    setEditError(null);
    const supabase = createClient();
    const ciISO = new Date(`${editModal.date}T${editCI}:00+05:30`).toISOString();
    const coISO = editCO ? new Date(`${editModal.date}T${editCO}:00+05:30`).toISOString() : null;
    const [ch, cm] = editCI.split(":").map(Number);
    const [sh, sm] = (officeSettings?.office_start_time ?? "10:00:00").split(":").map(Number);
    const grace = officeSettings?.grace_period_minutes ?? 15;
    const isLate = ch * 60 + cm > sh * 60 + sm + grace;

    let rec: AttendanceRecord | null = null;
    if (editModal.record) {
      const { data, error } = await supabase
        .from("attendance")
        .update({ check_in: ciISO, check_out: coISO, is_late: isLate })
        .eq("id", editModal.record.id).select().single();
      if (error) { setEditError(error.message); setEditSaving(false); return; }
      rec = data;
    } else {
      const { data, error } = await supabase
        .from("attendance")
        .insert({ employee_id: editModal.empId, date: editModal.date, check_in: ciISO, check_out: coISO, is_late: isLate })
        .select().single();
      if (error) { setEditError(error.message); setEditSaving(false); return; }
      rec = data;
    }
    if (rec) {
      setDailyAttendance((prev) =>
        prev.some((r) => r.id === rec!.id)
          ? prev.map((r) => (r.id === rec!.id ? rec! : r))
          : [...prev, rec!]
      );
    }
    setEditModal(null);
    setEditSaving(false);
  };

  const handleApprove = async (id: string) => {
    setActing(id);
    const supabase = createClient();
    await supabase.from("leaves").update({ status: "approved" }).eq("id", id);
    setLeavesTick((t) => t + 1);
    setActing(null);
  };

  const openReject = (id: string, name: string) => {
    setRejectModal({ id, name });
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectModal) return;
    setActing(rejectModal.id);
    const supabase = createClient();
    await supabase.from("leaves")
      .update({ status: "rejected", rejected_reason: rejectReason || null })
      .eq("id", rejectModal.id);
    setRejectModal(null);
    setRejectReason("");
    setLeavesTick((t) => t + 1);
    setActing(null);
  };

  const exportCSV = () => {
    const headers = ["Employee", "Role", "Check In", "Check Out", "Hours Worked", "Late", "Status"];
    const rows = dailyRows.map(({ employee: e, attendance: a, status: s }) => [
      e.full_name, e.role,
      a ? fmt(a.check_in) : "Not checked in",
      a?.check_out ? fmt(a.check_out) : a ? "Still working" : "",
      a ? hoursWorked(a.check_in, a.check_out) : "",
      a?.is_late ? "Yes" : "No",
      s === "on_leave" ? "On Leave" : s === "present" ? "Present" : "Absent",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ── Early returns ─────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;

  if (unauthorized) {
    return (
      <div className="text-white">
        <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Attendance</p>
          <h1 className="text-base md:text-lg font-bold mt-0.5">Admin Panel</h1>
        </header>
        <div className="px-4 py-6 md:px-8">
          <div className="bg-zinc-900 border border-red-500/20 rounded-xl p-6">
            <p className="text-red-400 text-sm font-medium">Access Denied</p>
            <p className="text-zinc-500 text-sm mt-1">Only Admins can access this page.</p>
            <Link href="/dashboard/attendance" className="mt-4 inline-block text-sm text-zinc-400 hover:text-white">
              ← Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const presentCount = dailyRows.filter((r) => r.status === "present").length;
  const absentCount = dailyRows.filter((r) => r.status === "absent").length;
  const leaveCount = dailyRows.filter((r) => r.status === "on_leave").length;
  const lateCount = dailyRows.filter((r) => r.attendance?.is_late).length;

  // ── Render ─────────────────────────────────────────────────────────────────────

  return (
    <div className="text-white">
      {/* Page Header */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Attendance · Admin
        </p>
        <h1 className="text-base md:text-lg font-bold text-white mt-0.5">Admin Panel</h1>
      </header>

      <div className="px-4 py-6 md:px-8 space-y-12 pb-20">

        {/* ══════════════════════════════════════════════════════
            SECTION 1: DAILY ATTENDANCE
        ══════════════════════════════════════════════════════ */}
        <section>
          {/* Section controls */}
          <div className="flex flex-wrap items-center gap-3 mb-5">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex-1 min-w-[160px]">
              {selectedDate === todayIST() ? "Today's Attendance" : `Attendance — ${fmtDate(selectedDate)}`}
            </h2>
            <input
              type="date"
              value={selectedDate}
              max={todayIST()}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
            <button
              onClick={() => setDailyRefresh((n) => n + 1)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              ↺ Refresh
            </button>
            <button
              onClick={exportCSV}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              ↓ Export CSV
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Present", value: presentCount, color: "text-emerald-400 bg-emerald-400/10 border-emerald-500/20" },
              { label: "Absent", value: absentCount, color: "text-red-400 bg-red-400/10 border-red-500/20" },
              { label: "On Leave", value: leaveCount, color: "text-blue-400 bg-blue-400/10 border-blue-500/20" },
              { label: "Late", value: lateCount, color: "text-amber-400 bg-amber-400/10 border-amber-500/20" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`border rounded-xl px-4 py-3 ${color}`}>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Daily table */}
          {dailyLoading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : employees.length === 0 ? (
            <p className="text-zinc-500 text-sm">No employees found.</p>
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Employee</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Check In</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Check Out</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Hours</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Status</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {dailyRows.map(({ employee: emp, attendance: att, status }) => (
                      <tr key={emp.id} className="bg-zinc-900/40 hover:bg-zinc-900/70 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-white font-medium">{emp.full_name}</p>
                          <p className="text-zinc-600 text-xs mt-0.5">{emp.role}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {att ? (
                            <span className="text-white">{fmt(att.check_in)}</span>
                          ) : (
                            <span className="text-zinc-600 text-xs">Not checked in</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {att?.check_out ? (
                            <span className="text-white">{fmt(att.check_out)}</span>
                          ) : att ? (
                            <span className="text-blue-400 text-xs">Still working</span>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                          {att ? hoursWorked(att.check_in, att.check_out) : "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {status === "present" && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/10">
                                Present
                              </span>
                            )}
                            {status === "absent" && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-red-400 bg-red-400/10">
                                Absent
                              </span>
                            )}
                            {status === "on_leave" && (
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-blue-400 bg-blue-400/10">
                                On Leave
                              </span>
                            )}
                            {att?.is_late && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-red-500">
                                LATE
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEdit(emp.id, emp.full_name, att, selectedDate)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 2: MONTHLY MATRIX
        ══════════════════════════════════════════════════════ */}
        <section>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex-1 min-w-[160px]">
              Monthly Overview
            </h2>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 mb-4 text-[11px]">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-emerald-400 bg-emerald-400/10">P</span>
              Present (on time)
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-amber-400 bg-amber-400/10 ring-1 ring-amber-500/20">P</span>
              Present (late)
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-red-400 bg-red-400/10">A</span>
              Absent
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-blue-400 bg-blue-400/10">L</span>
              On Leave
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-zinc-700">–</span>
              Weekend
            </span>
          </div>

          {matrixLoading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="sticky left-0 bg-zinc-900 z-10 text-left px-4 py-2.5 text-zinc-500 font-medium min-w-[140px] border-r border-zinc-800 whitespace-nowrap">
                        Employee
                      </th>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const dateStr = `${matYear}-${String(matMon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const isToday = dateStr === today;
                        const weekend = isWeekend(matYear, matMon, day);
                        return (
                          <th
                            key={day}
                            className={`px-1 py-2.5 font-medium text-center w-9 ${
                              isToday
                                ? "text-white"
                                : weekend
                                ? "text-zinc-700"
                                : "text-zinc-500"
                            }`}
                          >
                            <div>{day}</div>
                            <div className={`text-[9px] font-normal mt-0.5 ${weekend ? "text-zinc-800" : "text-zinc-700"}`}>
                              {["S","M","T","W","T","F","S"][new Date(matYear, matMon - 1, day).getDay()]}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {employees.map((emp) => (
                      <tr key={emp.id} className="group">
                        <td className="sticky left-0 bg-zinc-900 group-hover:bg-zinc-800/60 z-10 px-4 py-2 text-zinc-300 font-medium border-r border-zinc-800 whitespace-nowrap transition-colors">
                          {emp.full_name}
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                          const cs = getCellStatus(emp.id, day);
                          const dateStr = `${matYear}-${String(matMon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                          const rec = attMap.get(`${emp.id}-${day}`) ?? null;
                          const clickable = cs !== "weekend" && cs !== "future";
                          return (
                            <td key={day} className="px-0.5 py-1.5 text-center bg-transparent group-hover:bg-zinc-800/20 transition-colors">
                              <button
                                disabled={!clickable}
                                onClick={() => {
                                  if (!clickable) return;
                                  setCellDetail({ empName: emp.full_name, date: dateStr, rec, status: cs });
                                }}
                                className={`w-7 h-7 rounded text-[10px] font-bold transition-colors ${CELL_STYLE[cs]}`}
                              >
                                {CELL_LABEL[cs]}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 3: PENDING LEAVE REQUESTS
        ══════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">
            Pending Leave Requests
            {pendingLeaves.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {pendingLeaves.length}
              </span>
            )}
          </h2>

          {leavesLoading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : pendingLeaves.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-8 text-center">
              <p className="text-zinc-400 text-sm">No pending leave requests.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingLeaves.map((leave) => (
                <div key={leave.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4">
                  <div className="flex flex-wrap items-start gap-4 justify-between">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold text-sm">
                          {leave.employees?.full_name ?? "Unknown"}
                        </p>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-amber-400 bg-amber-400/10">
                          {leave.leave_type}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {leaveDays(leave.start_date, leave.end_date)} day{leaveDays(leave.start_date, leave.end_date) !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <p className="text-zinc-300 text-sm">
                        {fmtDate(leave.start_date)}
                        {leave.start_date !== leave.end_date && ` → ${fmtDate(leave.end_date)}`}
                      </p>
                      <p className="text-zinc-500 text-xs">{leave.reason}</p>
                      <p className="text-zinc-700 text-xs">Applied {fmtDate(leave.created_at)}</p>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => handleApprove(leave.id)}
                        disabled={acting === leave.id}
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-4 py-2 rounded-lg border border-emerald-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {acting === leave.id ? "…" : "Approve"}
                      </button>
                      <button
                        onClick={() => openReject(leave.id, leave.employees?.full_name ?? "this employee")}
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
        </section>

        {/* ══════════════════════════════════════════════════════
            SECTION 4: PROCESSED LEAVES
        ══════════════════════════════════════════════════════ */}
        <section>
          <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">
            Processed Leaves
          </h2>

          {leavesLoading ? (
            <p className="text-zinc-500 text-sm">Loading…</p>
          ) : processedLeaves.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-6 py-8 text-center">
              <p className="text-zinc-400 text-sm">No processed leaves yet.</p>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Employee</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Type</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Dates</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Days</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Decision</th>
                      <th className="text-left px-4 py-3 text-zinc-500 font-medium">Applied</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {processedLeaves.map((leave) => (
                      <tr key={leave.id} className="bg-zinc-900/40">
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                          {leave.employees?.full_name ?? "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{leave.leave_type}</td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap text-xs">
                          {fmtDate(leave.start_date)}
                          {leave.start_date !== leave.end_date && ` → ${fmtDate(leave.end_date)}`}
                        </td>
                        <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                          {leaveDays(leave.start_date, leave.end_date)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {leave.status === "approved" ? (
                            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/10">
                              Approved
                            </span>
                          ) : (
                            <div>
                              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full text-red-400 bg-red-400/10">
                                Rejected
                              </span>
                              {leave.rejected_reason && (
                                <p className="text-zinc-600 text-xs mt-1 max-w-[200px]">
                                  {leave.rejected_reason}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-600 text-xs whitespace-nowrap">
                          {fmtDate(leave.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ══ EDIT ATTENDANCE MODAL ══ */}
      {editModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-5 space-y-4">
            <div>
              <h3 className="text-white font-semibold text-sm">
                {editModal.record ? "Edit Attendance" : "Add Attendance"}
              </h3>
              <p className="text-zinc-500 text-xs mt-0.5">
                {editModal.empName} · {fmtDate(editModal.date)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-1.5">
                  Check-In Time (IST)
                </label>
                <input
                  type="time"
                  value={editCI}
                  onChange={(e) => setEditCI(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-zinc-500"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-1.5">
                  Check-Out Time (IST) — optional
                </label>
                <input
                  type="time"
                  value={editCO}
                  onChange={(e) => setEditCO(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-zinc-500"
                />
              </div>
            </div>

            {editCI && (
              <p className="text-zinc-600 text-xs">
                Late cutoff:{" "}
                {(() => {
                  const [sh, sm] = (officeSettings?.office_start_time ?? "10:00:00").split(":").map(Number);
                  const grace = officeSettings?.grace_period_minutes ?? 15;
                  const cutoffMins = sh * 60 + sm + grace;
                  const ch = Math.floor(cutoffMins / 60);
                  const cm = cutoffMins % 60;
                  const [uh, um] = editCI.split(":").map(Number);
                  const isLate = uh * 60 + um > cutoffMins;
                  return (
                    <span>
                      {String(ch).padStart(2, "0")}:{String(cm).padStart(2, "0")} —{" "}
                      <span className={isLate ? "text-red-400 font-medium" : "text-emerald-400 font-medium"}>
                        {isLate ? "will be marked Late" : "On Time"}
                      </span>
                    </span>
                  );
                })()}
              </p>
            )}

            {editError && <p className="text-red-400 text-sm">{editError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 bg-white text-black font-semibold text-sm py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {editSaving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditModal(null)}
                className="flex-1 bg-zinc-800 text-zinc-300 font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ REJECT REASON MODAL ══ */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-sm p-5 space-y-4">
            <div>
              <h3 className="text-white font-semibold text-sm">Reject Leave Request</h3>
              <p className="text-zinc-500 text-xs mt-0.5">
                Rejecting leave for {rejectModal.name}
              </p>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-1.5">
                Rejection Reason (optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for the employee…"
                rows={3}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:border-zinc-500 resize-none placeholder:text-zinc-600"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={confirmReject}
                disabled={acting === rejectModal.id}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm py-2.5 rounded-lg border border-red-500/20 transition-colors disabled:opacity-50"
              >
                {acting === rejectModal.id ? "…" : "Confirm Reject"}
              </button>
              <button
                onClick={() => setRejectModal(null)}
                className="flex-1 bg-zinc-800 text-zinc-300 font-medium text-sm py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CELL DETAIL MODAL ══ */}
      {cellDetail && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setCellDetail(null)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-xs p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-white font-semibold text-sm">{cellDetail.empName}</h3>
              <p className="text-zinc-500 text-xs mt-0.5">{fmtDate(cellDetail.date)}</p>
            </div>

            <div className="space-y-2">
              {cellDetail.status === "leave" && (
                <p className="text-blue-400 text-sm font-medium">On Leave</p>
              )}
              {cellDetail.status === "absent" && (
                <p className="text-red-400 text-sm font-medium">Absent — no check-in recorded</p>
              )}
              {(cellDetail.status === "present" || cellDetail.status === "late") && cellDetail.rec && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Check In</span>
                    <span className="text-white">{fmt(cellDetail.rec.check_in)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Check Out</span>
                    <span className={cellDetail.rec.check_out ? "text-white" : "text-blue-400"}>
                      {cellDetail.rec.check_out ? fmt(cellDetail.rec.check_out) : "Still working"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Hours</span>
                    <span className="text-zinc-300">{hoursWorked(cellDetail.rec.check_in, cellDetail.rec.check_out)}</span>
                  </div>
                  {cellDetail.rec.is_late && (
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500">Punctuality</span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white bg-red-500">LATE</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              onClick={() => setCellDetail(null)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 rounded-lg transition-colors mt-2"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
