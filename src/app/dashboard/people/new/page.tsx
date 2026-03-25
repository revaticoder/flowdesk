"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const ROLES = [
  "Strategist",
  "HR",
  "Admin",
  "Creative Director",
  "Senior Graphic Designer",
  "Graphic Designer",
  "Graphic Designer Intern",
  "Video Editor",
  "Junior Video Editor",
  "Video Editor Intern",
  "Social Media Manager",
  "Social Media Intern",
  "SEO Specialist",
  "Copywriter",
  "Copywriter Intern",
  "Operations Manager",
  "Digital Marketer",
  "Performance Marketer",
];

const DEPARTMENTS = [
  "Strategy",
  "Creative",
  "Video",
  "Social Media",
  "SEO",
  "Content",
  "Operations",
  "Marketing",
];

const SENIORITIES = ["Intern", "Junior", "Mid", "Senior", "Lead", "Head"];

type ManagerOption = { id: string; full_name: string };

export default function AddEmployeePage() {
  const router = useRouter();
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    role: "",
    department: "",
    seniority: "",
    skills: "",
    joining_date: "",
    reporting_manager: "",
  });

  useEffect(() => {
    const fetchManagers = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("employees")
        .select("id, full_name")
        .order("full_name");
      if (data) setManagers(data);
    };
    fetchManagers();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const supabase = createClient();
    const { error: insertError } = await supabase.from("employees").insert([
      {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        role: form.role,
        department: form.department,
        seniority: form.seniority,
        skills: form.skills.trim()
          ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
          : null,
        joining_date: form.joining_date || null,
        reporting_manager: form.reporting_manager || null,
        is_active: true,
      },
    ]);

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push("/dashboard/people");
  };

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center gap-3">
        <Link
          href="/dashboard/people"
          className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center"
        >
          ← Back
        </Link>
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            People
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">Add Employee</h1>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <Field label="Full Name" required>
            <input
              name="full_name"
              type="text"
              value={form.full_name}
              onChange={handleChange}
              required
              placeholder="e.g. Priya Sharma"
              className={inputClass}
            />
          </Field>

          {/* Email */}
          <Field label="Email" required>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="e.g. priya@agency.com"
              className={inputClass}
            />
          </Field>

          {/* Role + Department — stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Role" required>
              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                required
                className={selectClass}
              >
                <option value="">Select role</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Department" required>
              <select
                name="department"
                value={form.department}
                onChange={handleChange}
                required
                className={selectClass}
              >
                <option value="">Select department</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* Seniority */}
          <Field label="Seniority" required>
            <select
              name="seniority"
              value={form.seniority}
              onChange={handleChange}
              required
              className={selectClass}
            >
              <option value="">Select seniority</option>
              {SENIORITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>

          {/* Skills */}
          <Field label="Skills">
            <input
              name="skills"
              type="text"
              value={form.skills}
              onChange={handleChange}
              placeholder="e.g. Figma, Photoshop, After Effects"
              className={inputClass}
            />
          </Field>

          {/* Joining Date */}
          <Field label="Joining Date">
            <input
              name="joining_date"
              type="date"
              value={form.joining_date}
              onChange={handleChange}
              className={inputClass}
              style={{ colorScheme: "dark" }}
            />
          </Field>

          {/* Reporting Manager */}
          <Field label="Reporting Manager">
            <select
              name="reporting_manager"
              value={form.reporting_manager}
              onChange={handleChange}
              className={selectClass}
            >
              <option value="">None</option>
              {managers.map((m) => (
                <option key={m.id} value={m.full_name}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </Field>

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto bg-white text-black text-sm font-semibold px-6 py-3 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              {saving ? "Saving..." : "Save Employee"}
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
  "w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 min-h-[44px]";

const selectClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 min-h-[44px]";
