export const TASK_TYPES = [
  "Content Creation",
  "Copywriting",
  "Design",
  "Video Editing",
  "Performance Marketing",
  "SEO",
  "Strategy",
  "Client Communication",
  "Website",
  "Shoot Planning",
  "Shoot Execution",
  "Reporting",
  "Research",
  "Influencer Outreach",
  "PR",
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const PRIORITY_LEVELS = ["Urgent", "High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITY_LEVELS)[number];

export const TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "In Review",
  "Revision Requested",
  "Completed",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITY_COLOR: Record<string, string> = {
  Urgent: "text-red-400 bg-red-400/10 border-red-400/20",
  High: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Medium: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  Low: "text-green-400 bg-green-400/10 border-green-400/20",
};

export const PRIORITY_LEFT_BORDER: Record<string, string> = {
  Urgent: "border-l-red-500",
  High: "border-l-orange-400",
  Medium: "border-l-yellow-400",
  Low: "border-l-green-400",
};

export const PRIORITY_DOT: Record<string, string> = {
  Urgent: "bg-red-500",
  High: "bg-orange-400",
  Medium: "bg-yellow-400",
  Low: "bg-green-400",
};

export const STATUS_COLOR: Record<string, string> = {
  "Not Started": "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
  "In Progress": "text-blue-400 bg-blue-400/10 border-blue-400/20",
  "In Review": "text-violet-400 bg-violet-400/10 border-violet-400/20",
  "Revision Requested": "text-orange-400 bg-orange-400/10 border-orange-400/20",
  Completed: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
};

export const STATUS_COLUMN_HEADER: Record<string, string> = {
  "Not Started": "text-zinc-400",
  "In Progress": "text-blue-400",
  "In Review": "text-violet-400",
  "Revision Requested": "text-orange-400",
  Completed: "text-emerald-400",
};

export const PRIORITY_POINTS: Record<string, number> = {
  Low: 5,
  Medium: 10,
  High: 15,
  Urgent: 20,
};

export const LEVEL_THRESHOLDS = [
  { min: 0, max: 100, name: "Junior Agent" },
  { min: 101, max: 300, name: "Rising Star" },
  { min: 301, max: 600, name: "Senior Executor" },
  { min: 601, max: 1000, name: "Elite Performer" },
  { min: 1001, max: Infinity, name: "RevFlow Legend" },
];

export function getLevelInfo(points: number): {
  name: string;
  min: number;
  max: number;
  pct: number;
  nextName: string;
} {
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    const lvl = LEVEL_THRESHOLDS[i];
    if (points >= lvl.min && points <= lvl.max) {
      const effectiveMax = lvl.max === Infinity ? lvl.min + 500 : lvl.max;
      const pct = Math.min(
        100,
        Math.round(((points - lvl.min) / (effectiveMax - lvl.min)) * 100)
      );
      const nextName =
        i < LEVEL_THRESHOLDS.length - 1
          ? LEVEL_THRESHOLDS[i + 1].name
          : "Max Level";
      return { name: lvl.name, min: lvl.min, max: effectiveMax, pct, nextName };
    }
  }
  return {
    name: "RevFlow Legend",
    min: 1001,
    max: 1501,
    pct: 100,
    nextName: "Max Level",
  };
}

export const BADGE_INFO: Record<
  string,
  { icon: string; label: string; description: string }
> = {
  on_fire: {
    icon: "🔥",
    label: "On Fire",
    description: "5 tasks completed in a row",
  },
  speed_runner: {
    icon: "⚡",
    label: "Speed Runner",
    description: "3 tasks before deadline in a week",
  },
  zero_revision: {
    icon: "💎",
    label: "Zero Revision",
    description: "Approved with zero revisions",
  },
  perfect_month: {
    icon: "🎯",
    label: "Perfect Month",
    description: "100% on time in a month",
  },
  top_performer: {
    icon: "👑",
    label: "Top Performer",
    description: "#1 on leaderboard for the month",
  },
};

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function dueDateClass(due: string | null, status: string): string {
  if (!due || status === "Completed") return "text-zinc-500";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(due);
  const dueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );
  if (dueDay < today) return "text-red-400";
  if (dueDay.getTime() === today.getTime()) return "text-orange-400";
  return "text-zinc-500";
}

export function dueDateLabel(due: string | null, status: string): string {
  if (!due) return "No due date";
  if (status === "Completed") return fmtDate(due);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDate = new Date(due);
  const dueDay = new Date(
    dueDate.getFullYear(),
    dueDate.getMonth(),
    dueDate.getDate()
  );
  const diff = Math.ceil(
    (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return `Overdue ${Math.abs(diff)}d`;
  if (diff === 0) return "Due today";
  if (diff === 1) return "Due tomorrow";
  return fmtDate(due);
}
