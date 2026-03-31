"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BADGE_INFO, getLevelInfo, initials } from "@/lib/tasks";

type Employee = {
  id: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

type PointsRow = {
  employee_id: string;
  points: number;
  created_at: string;
};

type Badge = {
  employee_id: string;
  badge_type: string;
};

type LeaderEntry = {
  id: string;
  full_name: string;
  role: string;
  points: number;
  level: string;
  badges: string[];
};

export default function LeaderboardPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allPoints, setAllPoints] = useState<PointsRow[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [currentEmpId, setCurrentEmpId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"month" | "alltime">("month");

  useEffect(() => {
    const load = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: emp } = await supabase
        .from("employees")
        .select("id, role")
        .eq("email", user.email!)
        .maybeSingle();

      if (emp) setCurrentEmpId(emp.id);

      const [empRes, pointsRes, badgesRes] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, role, is_active")
          .eq("is_active", true)
          .order("full_name"),
        supabase
          .from("employee_points")
          .select("employee_id, points, created_at"),
        supabase
          .from("employee_badges")
          .select("employee_id, badge_type"),
      ]);

      setEmployees(empRes.data ?? []);
      setAllPoints((pointsRes.data as PointsRow[]) ?? []);
      setBadges((badgesRes.data as Badge[]) ?? []);
      setLoading(false);
    };
    load();
  }, [router]);

  const leaderboard = useMemo((): LeaderEntry[] => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const filteredPoints =
      tab === "month"
        ? allPoints.filter((p) => new Date(p.created_at) >= monthStart)
        : allPoints;

    const totalsMap: Record<string, number> = {};
    for (const p of filteredPoints) {
      totalsMap[p.employee_id] = (totalsMap[p.employee_id] ?? 0) + p.points;
    }

    const badgeMap: Record<string, string[]> = {};
    for (const b of badges) {
      if (!badgeMap[b.employee_id]) badgeMap[b.employee_id] = [];
      badgeMap[b.employee_id].push(b.badge_type);
    }

    const entries: LeaderEntry[] = employees.map((emp) => {
      const pts = Math.max(0, totalsMap[emp.id] ?? 0);
      // For level, always use all-time points
      const allTimePts = Math.max(
        0,
        allPoints
          .filter((p) => p.employee_id === emp.id)
          .reduce((s, p) => s + p.points, 0)
      );
      return {
        id: emp.id,
        full_name: emp.full_name,
        role: emp.role,
        points: pts,
        level: getLevelInfo(allTimePts).name,
        badges: badgeMap[emp.id] ?? [],
      };
    });

    return entries.sort((a, b) => b.points - a.points);
  }, [employees, allPoints, badges, tab]);

  const myEntry = leaderboard.find((e) => e.id === currentEmpId);
  const myRank = leaderboard.findIndex((e) => e.id === currentEmpId) + 1;

  if (loading)
    return <div className="p-8 text-zinc-500 text-sm">Loading…</div>;

  return (
    <div className="text-white">
      <header className="border-b border-zinc-800 px-4 py-3 md:px-8 md:py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/tasks"
            className="text-zinc-400 hover:text-white text-sm transition-colors min-h-[44px] flex items-center shrink-0"
          >
            ← Back
          </Link>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
              Tasks
            </p>
            <h1 className="text-lg font-bold text-white mt-0.5">
              🏆 Leaderboard
            </h1>
          </div>
        </div>
        <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
          <button
            onClick={() => setTab("month")}
            className={`px-4 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
              tab === "month"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            This Month
          </button>
          <button
            onClick={() => setTab("alltime")}
            className={`px-4 py-1.5 text-xs font-medium transition-colors min-h-[36px] border-l border-zinc-700 ${
              tab === "alltime"
                ? "bg-zinc-700 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            All Time
          </button>
        </div>
      </header>

      <div className="px-4 py-6 md:px-8 md:py-8 max-w-3xl space-y-4">
        {/* My position card */}
        {myEntry && myRank > 0 && (
          <div className="bg-gradient-to-r from-violet-500/10 to-blue-500/10 border border-violet-500/20 rounded-xl p-4 flex items-center gap-4">
            <div className="text-center shrink-0 w-12">
              <p className="text-2xl font-bold text-white">#{myRank}</p>
              <p className="text-xs text-zinc-400">Your rank</p>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{myEntry.full_name}</p>
              <p className="text-xs text-zinc-400">{myEntry.level}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold text-white">
                {myEntry.points}
              </p>
              <p className="text-xs text-zinc-500">pts {tab === "month" ? "this month" : "all time"}</p>
            </div>
          </div>
        )}

        {/* Top 3 podium */}
        {leaderboard.length >= 3 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { entry: leaderboard[1], rank: 2, medal: "🥈", height: "pt-6" },
              { entry: leaderboard[0], rank: 1, medal: "🥇", height: "pt-0" },
              { entry: leaderboard[2], rank: 3, medal: "🥉", height: "pt-8" },
            ].map(({ entry, rank, medal, height }) => (
              <div
                key={entry.id}
                className={`bg-zinc-900 border rounded-xl p-4 text-center flex flex-col items-center gap-2 ${height} ${
                  rank === 1
                    ? "border-yellow-500/30 bg-yellow-500/5"
                    : "border-zinc-800"
                } ${entry.id === currentEmpId ? "ring-2 ring-violet-500/40" : ""}`}
              >
                <span className="text-2xl">{medal}</span>
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-300">
                  {initials(entry.full_name)}
                </div>
                <p className="text-xs font-semibold text-white leading-tight text-center">
                  {entry.full_name}
                </p>
                <p className="text-xs text-zinc-500">{entry.level}</p>
                <p className="text-sm font-bold text-white">
                  {entry.points} pts
                </p>
                {entry.badges.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {entry.badges.slice(0, 3).map((b) => (
                      <span
                        key={b}
                        title={BADGE_INFO[b]?.label}
                        className="text-sm"
                      >
                        {BADGE_INFO[b]?.icon}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Full leaderboard */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-zinc-800/60">
            {leaderboard.map((entry, idx) => {
              const rank = idx + 1;
              const isMe = entry.id === currentEmpId;
              const medalEmoji =
                rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                    isMe
                      ? "bg-violet-500/5 border-l-2 border-l-violet-500"
                      : "hover:bg-zinc-800/30"
                  }`}
                >
                  {/* Rank */}
                  <div className="w-8 text-center shrink-0">
                    {medalEmoji ? (
                      <span className="text-lg">{medalEmoji}</span>
                    ) : (
                      <span className="text-sm text-zinc-600 font-medium">
                        {rank}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-300 shrink-0">
                    {initials(entry.full_name)}
                  </div>

                  {/* Name + level */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isMe ? "text-violet-300" : "text-white"
                        }`}
                      >
                        {entry.full_name}
                        {isMe && (
                          <span className="text-xs text-zinc-500 font-normal ml-1">
                            (you)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-zinc-500 truncate">
                        {entry.role} · {entry.level}
                      </p>
                      {entry.badges.length > 0 && (
                        <span className="text-xs flex gap-0.5">
                          {entry.badges.map((b) => (
                            <span
                              key={b}
                              title={BADGE_INFO[b]?.label}
                            >
                              {BADGE_INFO[b]?.icon}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Points */}
                  <div className="text-right shrink-0">
                    <p
                      className={`text-sm font-bold ${
                        rank === 1
                          ? "text-yellow-400"
                          : rank === 2
                          ? "text-zinc-300"
                          : rank === 3
                          ? "text-orange-400"
                          : "text-zinc-400"
                      }`}
                    >
                      {entry.points}
                    </p>
                    <p className="text-[10px] text-zinc-600">pts</p>
                  </div>
                </div>
              );
            })}

            {leaderboard.length === 0 && (
              <div className="px-5 py-12 text-center">
                <p className="text-zinc-600 text-sm">
                  No points earned yet. Complete tasks to climb the board!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
            Level System
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { range: "0–100", name: "Junior Agent" },
              { range: "101–300", name: "Rising Star" },
              { range: "301–600", name: "Senior Executor" },
              { range: "601–1000", name: "Elite Performer" },
              { range: "1000+", name: "RevFlow Legend" },
            ].map((lvl) => (
              <div
                key={lvl.name}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-zinc-400">{lvl.name}</span>
                <span className="text-zinc-600">{lvl.range} pts</span>
              </div>
            ))}
          </div>
        </div>

        {/* Badge legend */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium mb-3">
            Badges
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.values(BADGE_INFO).map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-xs">
                <span className="text-base">{b.icon}</span>
                <div>
                  <span className="text-zinc-300 font-medium">{b.label}</span>
                  <p className="text-zinc-600">{b.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
