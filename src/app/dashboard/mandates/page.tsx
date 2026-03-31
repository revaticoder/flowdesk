"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

const MANDATE_TYPES = [
  "Strategy & Consulting",
  "Branding & Identity",
  "Rebranding",
  "Brand Guidelines",
  "Market Research & Analysis",
  "Content Production & Shoot",
  "Creative Design (Digital & Offline Collaterals)",
  "Packaging Design",
  "Social Media Marketing",
  "Performance Marketing",
  "SEO, AISEO & Content Marketing",
  "Google My Business (GMB)",
  "Reddit & Quora Marketing",
  "Influencer Marketing Management",
  "PR Management & Coordination",
  "Website Design & Development",
  "Landing Page Development",
  "E-commerce Development",
  "AMC (Annual Maintenance Contract)",
  "Third-Party Listings & Marketplace Management",
  "360° Campaigns",
  "E-commerce Support Services",
  "Wikipedia Page Creation",
];

const STATUS_COLOR: Record<string, string> = {
  Active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Paused: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Completed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Cancelled: "text-zinc-500 bg-zinc-800 border-zinc-700",
};

type Mandate = {
  id: string;
  client_id: string;
  mandate_type: string;
  platform: string | null;
  start_date: string | null;
  renewal_date: string | null;
  monthly_value: number | null;
  fulfillment_percentage: number | null;
  status: string;
  created_at: string;
  clients: { company_name: string } | null;
};

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function CircleProgress({ pct }: { pct: number }) {
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke={pct >= 80 ? "#34d399" : pct >= 40 ? "#60a5fa" : "#f59e0b"}
        strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontSize="9" fill="#e4e4e7" fontWeight="600">
        {pct}%
      </text>
    </svg>
  );
}

export default function MandatesPage() {
  const [mandates, setMandates] = useState<Mandate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: emp } = await supabase
          .from("employees")
          .select("role")
          .eq("email", user.email)
          .maybeSingle();
        if (emp?.role === "Admin") setIsAdmin(true);
      }

      const { data } = await supabase
        .from("mandates")
        .select("*, clients(company_name)")
        .order("created_at", { ascending: false });
      setMandates(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handleDeleteMandate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    // Delete linked tasks first
    await supabase.from("tasks").delete().eq("mandate_id", deleteTarget.id);
    // Delete mandate
    await supabase.from("mandates").delete().eq("id", deleteTarget.id);
    setMandates((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const filtered = mandates.filter((m) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      m.clients?.company_name.toLowerCase().includes(q) ||
      m.mandate_type.toLowerCase().includes(q) ||
      (m.platform ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "All" || m.status === statusFilter;
    const matchType = typeFilter === "All" || m.mandate_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <div className="text-white">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h2 className="text-white font-semibold text-base">Delete mandate?</h2>
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">{deleteTarget.name}</span>? This will also
              delete all tasks linked to this mandate. This cannot be undone.
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
                onClick={handleDeleteMandate}
                disabled={deleting}
                className="flex-1 text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 px-4 py-2 rounded-lg transition-colors min-h-[40px] disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Admin</p>
          <h1 className="text-lg font-bold text-white mt-0.5">Mandates</h1>
        </div>
        <Link
          href="/dashboard/mandates/new"
          className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:bg-zinc-200 transition-colors min-h-[40px] flex items-center"
        >
          + New Mandate
        </Link>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-6xl space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search client, type, platform…"
            className="bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-500 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-zinc-600 min-w-[220px] flex-1 min-h-[40px]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 min-h-[40px]"
          >
            <option value="All">All Status</option>
            {["Active", "Paused", "Completed", "Cancelled"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-zinc-900 border border-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-600 min-h-[40px]"
          >
            <option value="All">All Types</option>
            {MANDATE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-zinc-500 text-sm">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <p className="text-3xl mb-3">◑</p>
            <p className="text-sm">No mandates found</p>
            {mandates.length === 0 && (
              <Link
                href="/dashboard/mandates/new"
                className="mt-4 inline-block text-sm text-white border border-zinc-700 px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Add your first mandate
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m) => {
              const expiring = isExpiringSoon(m.renewal_date);
              return (
                <div key={m.id} className="relative group">
                  <Link
                    href={`/dashboard/mandates/${m.id}`}
                    className="block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-sm leading-snug truncate pr-6">
                          {m.clients?.company_name ?? "Unknown Client"}
                        </p>
                        <p className="text-zinc-500 text-xs mt-0.5 truncate">{m.mandate_type}</p>
                        {m.platform && (
                          <p className="text-zinc-600 text-xs mt-0.5 truncate">{m.platform}</p>
                        )}
                      </div>
                      <CircleProgress pct={m.fulfillment_percentage ?? 0} />
                    </div>

                    {/* Status + value */}
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          STATUS_COLOR[m.status] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"
                        }`}
                      >
                        {m.status}
                      </span>
                      {m.monthly_value != null && (
                        <span className="text-zinc-300 text-xs font-semibold">
                          ₹{m.monthly_value.toLocaleString("en-IN")}/mo
                        </span>
                      )}
                    </div>

                    {/* Renewal date */}
                    {m.renewal_date && (
                      <div
                        className={`mt-3 text-xs flex items-center gap-1.5 ${
                          expiring ? "text-red-400" : "text-zinc-600"
                        }`}
                      >
                        <span>{expiring ? "⚠" : "↻"}</span>
                        <span>
                          Renews {fmtDate(m.renewal_date)}
                          {expiring && " — Soon!"}
                        </span>
                      </div>
                    )}
                  </Link>

                  {/* Delete button — visible on hover (admin only) */}
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        setDeleteTarget({
                          id: m.id,
                          name: `${m.clients?.company_name ?? "this client"} — ${m.mandate_type}`,
                        });
                      }}
                      className="absolute top-3 right-3 text-[11px] font-medium text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-md hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
                    >
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-xs text-zinc-600">
            Showing {filtered.length} of {mandates.length} mandate{mandates.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}
