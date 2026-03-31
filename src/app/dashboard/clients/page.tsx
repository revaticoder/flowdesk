"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STAGES, STAGE_COLOR, STAGE_DOT } from "@/lib/clients";

type Client = {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string | null;
  industry: string | null;
  current_stage: string;
  assigned_to: string | null;
  created_at: string;
  employees: { full_name: string } | null;
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
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
        .from("clients")
        .select("*, employees!clients_assigned_to_fkey(full_name)")
        .order("created_at", { ascending: false });
      setClients(data ?? []);
      setLoading(false);
    };
    load();
  }, []);

  const handleDeleteClient = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const clientId = deleteTarget.id;

    // Get all mandate IDs for this client
    const { data: mandates } = await supabase
      .from("mandates")
      .select("id")
      .eq("client_id", clientId);

    if (mandates && mandates.length > 0) {
      const mandateIds = mandates.map((m) => m.id);
      // Delete tasks linked to those mandates
      await supabase.from("tasks").delete().in("mandate_id", mandateIds);
      // Delete mandates
      await supabase.from("mandates").delete().eq("client_id", clientId);
    }

    // Delete stage history
    await supabase.from("client_stage_history").delete().eq("client_id", clientId);
    // Delete client
    await supabase.from("clients").delete().eq("id", clientId);

    setClients((prev) => prev.filter((c) => c.id !== clientId));
    setDeleteTarget(null);
    setDeleting(false);
  };

  const filtered = clients.filter(
    (c) =>
      c.company_name.toLowerCase().includes(search.toLowerCase()) ||
      c.contact_person.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="text-white flex flex-col h-full">
      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h2 className="text-white font-semibold text-base">Delete client?</h2>
            <p className="text-zinc-400 text-sm">
              Are you sure you want to delete{" "}
              <span className="text-white font-medium">{deleteTarget.name}</span>? This will also
              delete all their mandates and tasks. This cannot be undone.
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
                onClick={handleDeleteClient}
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
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Clients
          </p>
          <h1 className="text-lg font-bold text-white mt-0.5">Pipeline</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-lg p-0.5">
            <button
              onClick={() => setView("kanban")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "kanban"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                view === "list"
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              List
            </button>
          </div>
          <Link
            href="/dashboard/clients/new"
            className="bg-white text-black text-sm font-medium px-3 py-2 rounded-lg hover:bg-zinc-200 transition-colors min-h-[36px] flex items-center"
          >
            + Add
          </Link>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 pt-4 pb-0 md:px-8 shrink-0">
        <input
          type="text"
          placeholder="Search by company or contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-sm bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-500"
        />
      </div>

      {loading ? (
        <div className="px-8 py-8 text-zinc-500 text-sm">Loading…</div>
      ) : view === "kanban" ? (
        <KanbanView
          clients={filtered}
          isAdmin={isAdmin}
          onDelete={(id, name) => setDeleteTarget({ id, name })}
        />
      ) : (
        <ListView
          clients={filtered}
          isAdmin={isAdmin}
          onDelete={(id, name) => setDeleteTarget({ id, name })}
        />
      )}
    </div>
  );
}

/* ─── Kanban ─────────────────────────────────────────────────────────── */
function KanbanView({
  clients,
  isAdmin,
  onDelete,
}: {
  clients: Client[];
  isAdmin: boolean;
  onDelete: (id: string, name: string) => void;
}) {
  const byStage = Object.fromEntries(
    STAGES.map((s) => [s, clients.filter((c) => c.current_stage === s)])
  );

  return (
    <div className="flex-1 overflow-x-auto overflow-y-hidden">
      <div className="flex gap-3 px-4 md:px-8 py-4 h-full" style={{ minWidth: `${STAGES.length * 216}px` }}>
        {STAGES.map((stage) => {
          const cards = byStage[stage] ?? [];
          return (
            <div key={stage} className="w-52 shrink-0 flex flex-col">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${STAGE_DOT[stage]}`} />
                <p className="text-xs font-medium text-zinc-300 truncate leading-tight">
                  {stage}
                </p>
                <span className="ml-auto text-xs text-zinc-600 shrink-0">
                  {cards.length}
                </span>
              </div>

              <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-0.5">
                {cards.length === 0 ? (
                  <div className="border border-dashed border-zinc-800 rounded-lg h-16" />
                ) : (
                  cards.map((c) => (
                    <div key={c.id} className="relative group">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 hover:border-zinc-600 transition-colors block"
                      >
                        <p className="text-white text-xs font-semibold leading-tight truncate pr-6">
                          {c.company_name}
                        </p>
                        <p className="text-zinc-500 text-[11px] mt-0.5 truncate">
                          {c.contact_person}
                        </p>
                        {c.employees && (
                          <p className="text-zinc-600 text-[11px] mt-1.5 truncate">
                            → {c.employees.full_name}
                          </p>
                        )}
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onDelete(c.id, c.company_name);
                          }}
                          className="absolute top-2 right-2 text-[10px] font-medium text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded hover:bg-red-500/10"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── List ───────────────────────────────────────────────────────────── */
function ListView({
  clients,
  isAdmin,
  onDelete,
}: {
  clients: Client[];
  isAdmin: boolean;
  onDelete: (id: string, name: string) => void;
}) {
  if (clients.length === 0) {
    return (
      <div className="px-8 py-12 text-center text-zinc-500 text-sm">
        No clients found.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-4 py-4 md:px-8">
      <div className="border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                {["Company", "Contact", "Phone", "Stage", "Assigned To", "Created", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-zinc-500 font-medium whitespace-nowrap"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {clients.map((c) => (
                <tr key={c.id} className="bg-zinc-900/40 hover:bg-zinc-900/80 transition-colors">
                  <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                    {c.company_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">
                    {c.contact_person}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                    {c.phone ?? "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        STAGE_COLOR[c.current_stage] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"
                      }`}
                    >
                      {c.current_stage}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 whitespace-nowrap">
                    {c.employees?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                    {fmtDate(c.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="text-xs text-zinc-400 hover:text-white transition-colors"
                      >
                        View →
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() => onDelete(c.id, c.company_name)}
                          className="text-xs text-red-500 hover:text-red-400 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
