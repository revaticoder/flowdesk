"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const allNavItems = [
  { label: "Dashboard", href: "/dashboard", icon: "▦", adminOnly: false },
  { label: "People", href: "/dashboard/people", icon: "◉", adminOnly: true },
  { label: "Clients", href: "/dashboard/clients", icon: "◈", adminOnly: true },
  { label: "Tasks", href: "#", icon: "◻", soon: true, adminOnly: false },
  { label: "Attendance", href: "/dashboard/attendance", icon: "◷", adminOnly: false },
  { label: "KPIs", href: "#", icon: "◎", soon: true, adminOnly: false },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkRole = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: emp } = await supabase
        .from("employees")
        .select("role")
        .eq("email", user.email)
        .maybeSingle();

      if (emp?.role === "Admin") setIsAdmin(true);
    };
    checkRole();
  }, []);

  const navItems = allNavItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-[#0d0d0d] border-r border-zinc-800
          transition-transform duration-200 ease-in-out
          md:relative md:w-56 md:translate-x-0 md:shrink-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="px-5 py-5 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-white font-bold text-lg tracking-tight">
            FlowDesk
          </span>
          <button
            onClick={closeSidebar}
            className="md:hidden text-zinc-400 hover:text-white p-1 -mr-1"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
                  className="flex items-center justify-between px-3 py-2.5 rounded-md text-zinc-600 cursor-not-allowed"
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
                onClick={closeSidebar}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors ${
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

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-[#0d0d0d]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-zinc-400 hover:text-white p-1 -ml-1 text-xl leading-none"
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="text-white font-bold text-base tracking-tight">
            FlowDesk
          </span>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
