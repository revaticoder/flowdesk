"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "▦" },
  { label: "People", href: "/dashboard/people", icon: "◉" },
  { label: "Clients", href: "#", icon: "◈", soon: true },
  { label: "Tasks", href: "#", icon: "◻", soon: true },
  { label: "Attendance", href: "#", icon: "◷", soon: true },
  { label: "KPIs", href: "#", icon: "◎", soon: true },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="px-5 py-6 border-b border-zinc-800">
          <span className="text-white font-bold text-lg tracking-tight">
            FlowDesk
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href !== "#" &&
              (item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href));

            if (item.soon) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-2 rounded-md text-zinc-600 cursor-not-allowed"
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    <span>{item.icon}</span>
                    {item.label}
                  </span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    Soon
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">FlowDesk v0.1</p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
