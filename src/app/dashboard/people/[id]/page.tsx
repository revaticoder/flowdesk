"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

type Employee = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  department: string;
  seniority: string;
  skills: string | null;
  joining_date: string | null;
  reporting_manager: string | null;
  is_active: boolean;
  created_at: string;
};

type ManagerOption = { id: string; full_name: string };

export default function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Employee>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();
      const [empRes, mgrRes] = await Promise.all([
        supabase.from("employees").select("*").eq("id", id).single(),
        supabase
          .from("employees")
          .select("id, full_name")
          .eq("is_active", true)
          .order("full_name"),
      ]);

      if (empRes.data) {
        setEmployee(empRes.data);
        setForm(empRes.data);
      }
      if (mgrRes.data) setManagers(mgrRes.data);
      setLoading(false);
    };
    fetchData();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        full_name: form.full_name,
        email: form.email,
        role: form.role,
        department: form.department,
        seniority: form.seniority,
        skills: form.skills || null,
        joining_date: form.joining_date || null,
        reporting_manager: form.reporting_manager || null,
        is_active: form.is_active,
      })
      .eq("id", id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setEmployee({ ...employee!, ...form } as Employee);
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="p-8 text-zinc-500 text-sm">Loading...</div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8">
        <p className="text-zinc-400 text-sm">Employee not found.</p>
        <Link
          href="/dashboard/people"
          className="text-zinc-500 hover:text-white text-sm mt-2 inline-block"
        >
          ← Back to directory
        </Link>
      </div>
    );
  }

  const initials = employee.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/people"
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            ← Back
          </Link>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              People
            </p>
            <h1 className="text-lg font-bold text-white mt-0.5">
              {employee.full_name}
            </h1>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => {
              setForm(employee);
              setEditing(true);
            }}
            className="bg-zinc-800 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Edit
          </button>
        )}
      </header>

      <div className="px-8 py-8 max-w-2xl">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-zinc-700 flex items-center justify-center text-white font-bold text-lg">
            {initials}
          </div>
          <div>
            <p className="text-white font-semibold text-lg">{employee.full_name}</p>
            <p className="text-zinc-400 text-sm">{employee.role}</p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  employee.is_active
                    ? "text-emerald-400 bg-emerald-400/10"
                    : "text-red-400 bg-red-400/10"
                }`}
              >
                {employee.is_active ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
        </div>

        {editing ? (
          <div className="space-y-5">
            <EditField label="Full Name">
              <input
                name="full_name"
                value={form.full_name ?? ""}
                onChange={handleChange}
                className={inputClass}
              />
            </EditField>
            <EditField label="Email">
              <input
                name="email"
                type="email"
                value={form.email ?? ""}
                onChange={handleChange}
                className={inputClass}
              />
            </EditField>
            <div className="grid grid-cols-2 gap-4">
              <EditField label="Role">
                <select
                  name="role"
                  value={form.role ?? ""}
                  onChange={handleChange}
                  className={selectClass}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </EditField>
              <EditField label="Department">
                <select
                  name="department"
                  value={form.department ?? ""}
                  onChange={handleChange}
                  className={selectClass}
                >
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </EditField>
            </div>
            <EditField label="Seniority">
              <select
                name="seniority"
                value={form.seniority ?? ""}
                onChange={handleChange}
                className={selectClass}
              >
                {SENIORITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </EditField>
            <EditField label="Skills">
              <input
                name="skills"
                value={form.skills ?? ""}
                onChange={handleChange}
                placeholder="e.g. Figma, Photoshop"
                className={inputClass}
              />
            </EditField>
            <EditField label="Joining Date">
              <input
                name="joining_date"
                type="date"
                value={form.joining_date ?? ""}
                onChange={handleChange}
                className={inputClass}
              />
            </EditField>
            <EditField label="Reporting Manager">
              <select
                name="reporting_manager"
                value={form.reporting_manager ?? ""}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="">None</option>
                {managers
                  .filter((m) => m.id !== id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name}
                    </option>
                  ))}
              </select>
            </EditField>
            <EditField label="Status">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  name="is_active"
                  type="checkbox"
                  checked={form.is_active ?? true}
                  onChange={handleChange}
                  className="w-4 h-4 accent-emerald-500"
                />
                <span className="text-sm text-zinc-300">Active</span>
              </label>
            </EditField>

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-black text-sm font-semibold px-6 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
                className="bg-zinc-800 text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-zinc-800 border border-zinc-800 rounded-xl overflow-hidden">
            <DetailRow label="Email" value={employee.email} />
            <DetailRow label="Role" value={employee.role} />
            <DetailRow label="Department" value={employee.department} />
            <DetailRow label="Seniority" value={employee.seniority} />
            <DetailRow
              label="Skills"
              value={employee.skills ?? "—"}
            />
            <DetailRow
              label="Joining Date"
              value={
                employee.joining_date
                  ? new Date(employee.joining_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <DetailRow
              label="Reporting Manager"
              value={
                employee.reporting_manager
                  ? (managers.find((m) => m.id === employee.reporting_manager)
                      ?.full_name ?? "—")
                  : "—"
              }
            />
            <DetailRow
              label="Added On"
              value={new Date(employee.created_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start px-5 py-3.5 bg-zinc-900">
      <p className="text-zinc-500 text-sm w-40 shrink-0">{label}</p>
      <p className="text-white text-sm">{value}</p>
    </div>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm text-zinc-300 font-medium mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500";

const selectClass =
  "w-full bg-zinc-900 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500";
