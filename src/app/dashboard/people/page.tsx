"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
};

const seniorityColor: Record<string, string> = {
  Intern: "text-yellow-500 bg-yellow-500/10",
  Junior: "text-blue-400 bg-blue-400/10",
  Mid: "text-purple-400 bg-purple-400/10",
  Senior: "text-emerald-400 bg-emerald-400/10",
  Lead: "text-orange-400 bg-orange-400/10",
  Head: "text-red-400 bg-red-400/10",
};

export default function PeoplePage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: me } = await supabase
        .from("employees")
        .select("id, role")
        .eq("email", user.email)
        .single();

      if (!me || me.role !== "Admin") {
        if (me) {
          router.replace(`/dashboard/people/${me.id}`);
        } else {
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("full_name");
      if (!error && data) setEmployees(data);
      setLoading(false);
    };
    init();
  }, [router]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    await supabase.from("employees").delete().eq("id", deleteTarget.id);
    setEmployees((prev) => prev.filter((e) => e.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const filtered = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(search.toLowerCase()) ||
      e.role.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="p-8 text-zinc-500 text-sm">Loading...</div>;
  }

  return (
    <div className="text-white">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h2 className="text-white font-semibold text-base">Delete employee?</h2>
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">{deleteTarget.name}</span>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 text-sm text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-white px-4 py-2 rounded-lg transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded-lg transition-colors min-h-[40px] disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            People
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">
            Employee Directory
          </h1>
        </div>
        <Link
          href="/dashboard/people/new"
          className="shrink-0 bg-white text-black text-sm font-medium px-3 py-2.5 md:px-4 rounded-lg hover:bg-zinc-200 transition-colors min-h-[44px] flex items-center"
        >
          + Add
        </Link>
      </header>

      <div className="px-4 py-5 md:px-8 md:py-6">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by name or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-sm bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-zinc-500 mb-5"
        />

        {filtered.length === 0 ? (
          <div className="text-zinc-500 text-sm">No employees found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((emp) => (
              <div key={emp.id} className="relative group">
                <Link
                  href={`/dashboard/people/${emp.id}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors block active:bg-zinc-800"
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-white font-semibold text-sm mb-3">
                    {emp.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>

                  <p className="text-white font-semibold text-sm leading-tight pr-10">
                    {emp.full_name}
                  </p>
                  <p className="text-zinc-400 text-xs mt-0.5">{emp.role}</p>
                  <p className="text-zinc-500 text-xs mt-0.5">{emp.department}</p>

                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        seniorityColor[emp.seniority] ??
                        "text-zinc-400 bg-zinc-800"
                      }`}
                    >
                      {emp.seniority}
                    </span>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        emp.is_active
                          ? "text-emerald-400 bg-emerald-400/10"
                          : "text-red-400 bg-red-400/10"
                      }`}
                    >
                      {emp.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </Link>

                {/* Delete button — visible on hover */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget({ id: emp.id, name: emp.full_name });
                  }}
                  className="absolute top-3 right-3 text-[11px] font-medium text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-md hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
