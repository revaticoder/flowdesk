"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STAGES, STAGE_COLOR, STAGE_DOT, STAGE_SERVICES } from "@/lib/clients";

type Client = {
  id: string;
  company_name: string;
  contact_person: string;
  email: string | null;
  phone: string | null;
  industry: string | null;
  source: string | null;
  current_stage: string;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  employees: { full_name: string } | null;
};

type Mandate = {
  id: string;
  mandate_type: string;
  platform: string | null;
  status: string;
  fulfillment_percentage: number | null;
  renewal_date: string | null;
  monthly_value: number | null;
};

const MANDATE_STATUS_COLOR: Record<string, string> = {
  Active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Paused: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Completed: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  Cancelled: "text-zinc-500 bg-zinc-800 border-zinc-700",
};

type HistoryEntry = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string;
  notes: string | null;
  created_at: string;
};

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ClientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [manualStage, setManualStage] = useState("");
  const [stageNote, setStageNote] = useState("");
  const [showStagePanel, setShowStagePanel] = useState(false);
  const [mandates, setMandates] = useState<Mandate[]>([]);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [clientRes, histRes, meRes, mandatesRes] = await Promise.all([
        supabase
          .from("clients")
          .select("*, employees!clients_assigned_to_fkey(full_name)")
          .eq("id", id)
          .single(),
        supabase
          .from("client_stage_history")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
        user
          ? supabase.from("employees").select("full_name").eq("email", user.email!).single()
          : Promise.resolve({ data: null }),
        supabase
          .from("mandates")
          .select("id, mandate_type, platform, status, fulfillment_percentage, renewal_date, monthly_value")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
      ]);

      if (clientRes.data) {
        setClient(clientRes.data);
        setManualStage(clientRes.data.current_stage);
      }
      setHistory(histRes.data ?? []);
      if (meRes.data) setCurrentUserName(meRes.data.full_name);
      setMandates(mandatesRes.data ?? []);
      setLoading(false);
    };
    init();
  }, [id]);

  const changeStage = async (newStage: string, note?: string) => {
    if (!client || newStage === client.current_stage) return;
    setActing(true);
    setError(null);
    const supabase = createClient();

    const [updateRes, histRes] = await Promise.all([
      supabase.from("clients").update({ current_stage: newStage }).eq("id", id),
      supabase.from("client_stage_history").insert({
        client_id: id,
        from_stage: client.current_stage,
        to_stage: newStage,
        changed_by: currentUserName || "Admin",
        notes: note?.trim() || null,
      }).select().single(),
    ]);

    if (updateRes.error) {
      setError(updateRes.error.message);
      setActing(false);
      return;
    }

    setClient((prev) => prev ? { ...prev, current_stage: newStage } : prev);
    setManualStage(newStage);
    if (histRes.data) setHistory((prev) => [histRes.data!, ...prev]);
    setStageNote("");
    setShowStagePanel(false);
    setActing(false);
  };

  const handleNextStage = () => {
    const idx = STAGES.indexOf(client!.current_stage as typeof STAGES[number]);
    if (idx < STAGES.length - 1) changeStage(STAGES[idx + 1]);
  };

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;
  if (!client) {
    return (
      <div className="p-8">
        <p className="text-zinc-400 text-sm">Client not found.</p>
        <Link href="/dashboard/clients" className="text-zinc-500 hover:text-white text-sm mt-2 inline-block">
          ← Back
        </Link>
      </div>
    );
  }

  const stageIdx = STAGES.indexOf(client.current_stage as typeof STAGES[number]);
  const isLastStage = stageIdx === STAGES.length - 1;
  const nextStage = !isLastStage ? STAGES[stageIdx + 1] : null;
  const activeServices = STAGE_SERVICES[client.current_stage] ?? [];

  return (
    <div className="text-white">
      {/* Top bar */}
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard/clients"
            className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center shrink-0"
          >
            ← Back
          </Link>
          <div className="min-w-0">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Clients</p>
            <h1 className="text-lg font-bold text-white mt-0.5 truncate">{client.company_name}</h1>
          </div>
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full border ${
            STAGE_COLOR[client.current_stage] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"
          }`}
        >
          {client.current_stage}
        </span>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-4xl space-y-6">
        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
            {error}
          </p>
        )}

        {/* Stage Actions */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-4">
            Stage Management
          </p>

          {/* Progress bar */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STAGE_DOT[client.current_stage]}`} />
              <span className="text-white font-semibold text-sm">{client.current_stage}</span>
              <span className="text-zinc-600 text-xs ml-1">
                {stageIdx + 1} / {STAGES.length}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${((stageIdx + 1) / STAGES.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {!isLastStage && (
              <button
                onClick={handleNextStage}
                disabled={acting}
                className="bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {acting ? "Moving…" : `Move to ${nextStage}`} →
              </button>
            )}
            <button
              onClick={() => setShowStagePanel((v) => !v)}
              className="bg-zinc-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-700 transition-colors min-h-[44px]"
            >
              Change Stage
            </button>
          </div>

          {/* Manual stage change panel */}
          {showStagePanel && (
            <div className="mt-4 pt-4 border-t border-zinc-800 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <select
                  value={manualStage}
                  onChange={(e) => setManualStage(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  value={stageNote}
                  onChange={(e) => setStageNote(e.target.value)}
                  placeholder="Optional note…"
                  className="bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-zinc-600 min-h-[44px]"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => changeStage(manualStage, stageNote)}
                  disabled={acting || manualStage === client.current_stage}
                  className="bg-white text-black text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {acting ? "Saving…" : "Apply"}
                </button>
                <button
                  onClick={() => { setShowStagePanel(false); setManualStage(client.current_stage); }}
                  className="text-zinc-400 hover:text-white text-sm px-3 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
              Client Details
            </p>
            <div className="divide-y divide-zinc-800/60">
              <DetailRow label="Contact" value={client.contact_person} />
              <DetailRow label="Email" value={client.email ?? "—"} />
              <DetailRow label="Phone" value={client.phone ?? "—"} />
              <DetailRow label="Industry" value={client.industry ?? "—"} />
              <DetailRow label="Source" value={client.source ?? "—"} />
              <DetailRow label="Assigned To" value={client.employees?.full_name ?? "—"} />
              <DetailRow label="Added On" value={fmtDate(client.created_at)} />
            </div>
          </div>

          {/* Active services */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-b border-zinc-800">
              Active Services · {client.current_stage}
            </p>
            <div className="px-5 py-4">
              {activeServices.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {activeServices.map((s) => (
                    <span
                      key={s}
                      className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 text-sm">
                  No active services at this stage.
                </p>
              )}
            </div>
            {client.notes && (
              <>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium px-5 py-3 border-t border-zinc-800">
                  Notes
                </p>
                <p className="px-5 pb-4 text-zinc-400 text-sm leading-relaxed">
                  {client.notes}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Mandates */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Mandates
            </p>
            <Link
              href={`/dashboard/mandates/new?client_id=${id}`}
              className="text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              + Add Mandate
            </Link>
          </div>
          {mandates.length === 0 ? (
            <p className="text-zinc-600 text-sm">No mandates yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {mandates.map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/mandates/${m.id}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors block"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{m.mandate_type}</p>
                      {m.platform && (
                        <p className="text-zinc-600 text-xs mt-0.5">{m.platform}</p>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border shrink-0 ${
                        MANDATE_STATUS_COLOR[m.status] ?? "text-zinc-400 bg-zinc-800 border-zinc-700"
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-24 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full"
                          style={{ width: `${m.fulfillment_percentage ?? 0}%` }}
                        />
                      </div>
                      <span className="text-zinc-500 text-xs">{m.fulfillment_percentage ?? 0}%</span>
                    </div>
                    {m.monthly_value != null && (
                      <span className="text-zinc-500 text-xs">
                        ₹{m.monthly_value.toLocaleString("en-IN")}/mo
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stage History */}
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
            Stage History
          </p>
          {history.length === 0 ? (
            <p className="text-zinc-500 text-sm">No history yet.</p>
          ) : (
            <div className="space-y-0 border border-zinc-800 rounded-xl overflow-hidden">
              {history.map((entry, i) => (
                <div
                  key={entry.id}
                  className={`flex items-start gap-4 px-5 py-4 ${
                    i !== history.length - 1 ? "border-b border-zinc-800/60" : ""
                  } bg-zinc-900/40`}
                >
                  {/* Timeline dot */}
                  <div className="flex flex-col items-center pt-1 shrink-0">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        STAGE_DOT[entry.to_stage] ?? "bg-zinc-600"
                      }`}
                    />
                    {i !== history.length - 1 && (
                      <div className="w-px flex-1 bg-zinc-800 mt-1 min-h-[16px]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      {entry.from_stage ? (
                        <>
                          <span className="text-zinc-500 text-xs">{entry.from_stage}</span>
                          <span className="text-zinc-600 text-xs">→</span>
                          <span className="text-white text-xs font-medium">{entry.to_stage}</span>
                        </>
                      ) : (
                        <span className="text-white text-xs font-medium">
                          Created at {entry.to_stage}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      <p className="text-zinc-500 text-xs">{fmtDateTime(entry.created_at)}</p>
                      <p className="text-zinc-600 text-xs">by {entry.changed_by}</p>
                    </div>
                    {entry.notes && (
                      <p className="text-zinc-500 text-xs mt-1 italic">{entry.notes}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start px-5 py-3">
      <p className="text-zinc-500 text-sm w-28 shrink-0">{label}</p>
      <p className="text-white text-sm break-all">{value}</p>
    </div>
  );
}
