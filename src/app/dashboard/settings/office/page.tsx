"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type OfficeSettings = {
  id: string;
  office_start_time: string;
  office_end_time: string;
  grace_period_minutes: number;
};

function toTimeInput(t: string) {
  return t.slice(0, 5); // "10:00:00" -> "10:00"
}

export default function OfficeSettingsPage() {
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("19:00");
  const [grace, setGrace] = useState(15);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

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

      const { data } = await supabase
        .from("office_settings")
        .select("*")
        .single();

      if (data) {
        setSettingsId(data.id);
        setStartTime(toTimeInput(data.office_start_time));
        setEndTime(toTimeInput(data.office_end_time));
        setGrace(data.grace_period_minutes);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleSave = async () => {
    if (!settingsId) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    if (!startTime || !endTime) {
      setError("Start time and end time are required.");
      setSaving(false);
      return;
    }
    const supabase = createClient();
    const { error: err } = await supabase
      .from("office_settings")
      .update({
        office_start_time: startTime + ":00",
        office_end_time: endTime + ":00",
        grace_period_minutes: grace,
      })
      .eq("id", settingsId);

    if (err) {
      setError(err.message);
    } else {
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;

  if (unauthorized) {
    return (
      <div className="text-white">
        <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
            Settings
          </p>
          <h1 className="text-base md:text-lg font-bold text-white mt-0.5">
            Office Settings
          </h1>
        </header>
        <div className="px-4 py-6 md:px-8 md:py-8">
          <div className="bg-zinc-900 border border-red-500/20 rounded-xl px-6 py-6">
            <p className="text-red-400 text-sm font-medium">Access Denied</p>
            <p className="text-zinc-500 text-sm mt-1">
              This page is only accessible to Admin users.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white">
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Settings
        </p>
        <h1 className="text-base md:text-lg font-bold text-white mt-0.5">
          Office Settings
        </h1>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-lg">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 md:p-6 space-y-6">
          {/* Office Start Time */}
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">
              Office Start Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm w-full max-w-[160px] focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Office End Time */}
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">
              Office End Time
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm w-full max-w-[160px] focus:outline-none focus:border-zinc-500"
            />
          </div>

          {/* Grace Period */}
          <div>
            <label className="block text-xs text-zinc-500 uppercase tracking-widest mb-2">
              Grace Period
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={120}
                value={grace}
                onChange={(e) => setGrace(Number(e.target.value))}
                className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2.5 text-sm w-[90px] focus:outline-none focus:border-zinc-500"
              />
              <span className="text-zinc-400 text-sm">minutes</span>
            </div>
            <p className="text-zinc-600 text-xs mt-2">
              Employees arriving within {grace} minute{grace !== 1 ? "s" : ""}{" "}
              of start time will NOT be marked late.
            </p>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {success && <p className="text-emerald-400 text-sm">Settings saved.</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
