"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const LEAVE_TYPES = ["Casual", "Sick", "Work From Home", "Half Day"];

export default function LeaveApplicationPage() {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeName, setEmployeeName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
  });

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("email", user.email)
        .single();

      if (emp) {
        setEmployeeId(emp.id);
        setEmployeeName(emp.full_name);
      }
    };
    init();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    setError(null);
    setSaving(true);

    const supabase = createClient();

    // Insert leave record
    const { error: insertError } = await supabase.from("leaves").insert({
      employee_id: employeeId,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason.trim(),
      status: "pending",
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    // Send email notification (best-effort, don't block on failure)
    try {
      await fetch("/api/send-leave-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeName,
          leaveType: form.leave_type,
          startDate: form.start_date,
          endDate: form.end_date,
          reason: form.reason.trim(),
        }),
      });
    } catch {
      // Email failure is non-blocking
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => router.push("/dashboard/attendance/my-leaves"), 1800);
  };

  if (success) {
    return (
      <div className="text-white flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-4xl mb-4">✓</div>
          <p className="text-white font-semibold text-lg">Leave Submitted</p>
          <p className="text-zinc-500 text-sm mt-1">Redirecting…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-8 py-4 flex items-center gap-4">
        <Link
          href="/dashboard/attendance"
          className="text-zinc-400 hover:text-white text-sm transition-colors"
        >
          ← Back
        </Link>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Attendance
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">
            Apply for Leave
          </h1>
        </div>
      </header>

      <div className="px-8 py-8 max-w-xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Leave Type */}
          <Field label="Leave Type" required>
            <select
              name="leave_type"
              value={form.leave_type}
              onChange={handleChange}
              required
              className={selectClass}
            >
              <option value="">Select type</option>
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Start Date" required>
              <input
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
                required
                className={inputClass}
                style={{ colorScheme: "dark" }}
              />
            </Field>
            <Field label="End Date" required>
              <input
                name="end_date"
                type="date"
                value={form.end_date}
                onChange={handleChange}
                required
                min={form.start_date}
                className={inputClass}
                style={{ colorScheme: "dark" }}
              />
            </Field>
          </div>

          {/* Reason */}
          <Field label="Reason" required>
            <textarea
              name="reason"
              value={form.reason}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Briefly describe the reason for leave…"
              className="w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500 resize-none"
            />
          </Field>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || !employeeId}
              className="bg-white text-black text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              {saving ? "Submitting…" : "Submit Leave Request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-300 font-medium mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500";

const selectClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500";
