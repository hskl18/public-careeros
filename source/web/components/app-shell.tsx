"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { notifications, setupStatuses, formatDateTime } from "@/lib/demo-data";
import { StatusPill } from "@/components/ui";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/applications", label: "Applications", icon: BriefcaseBusiness },
  { href: "/review", label: "Review", icon: ClipboardCheck },
  { href: "/resume", label: "Resume", icon: FileText },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
] satisfies Array<{ href: string; label: string; icon: LucideIcon }>;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/" || pathname === "/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const newCount = notifications.filter((item) => item.status === "new").length;

  if (pathname.startsWith("/judge-demo")) {
    return children;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/dashboard" className="brand" aria-label="CareerOS dashboard">
          <span className="brand-mark">C</span>
          <span>
            <p className="brand-title">CareerOS</p>
            <p className="brand-subtitle">Local-first workspace</p>
          </span>
        </Link>

        <nav className="nav-list" aria-label="Primary workspace">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <p className="sidebar-note">
          Gmail and Ollama are optional. Seeded demo data, local imports, manual
          applications, and deterministic review flows stay available offline.
        </p>
      </aside>

      <div className="main-shell">
        <div className="status-strip">
          <div className="status-items" aria-label="Workspace status">
            {setupStatuses.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`status-chip tone-${item.tone}`}>
                  <Icon size={17} aria-hidden="true" />
                  <span>
                    <small>{item.label}</small>
                    <strong>{item.value}</strong>
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            className="notification-button"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((value) => !value)}
          >
            <Bell size={17} aria-hidden="true" />
            Notifications
            <span className="pill tone-warn">{newCount}</span>
          </button>
        </div>

        {drawerOpen ? (
          <aside className="notification-drawer" aria-label="Notification drawer">
            <div className="drawer-header">
              <div>
                <p className="eyebrow">Notification window</p>
                <h2>Current signals</h2>
              </div>
              <button
                type="button"
                className="button ghost"
                onClick={() => setDrawerOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="drawer-body">
              {notifications.slice(0, 4).map((item) => (
                <article key={item.id} className="row-card">
                  <div className="row-top">
                    <StatusPill tone={item.severity}>{item.status}</StatusPill>
                    <span className="small muted">{formatDateTime(item.timestamp)}</span>
                  </div>
                  <h3>{item.message}</h3>
                  <p className="small muted">{item.source}</p>
                  <Link href={item.destination} className="button secondary">
                    {item.destinationLabel}
                  </Link>
                </article>
              ))}
            </div>
          </aside>
        ) : null}

        {children}
      </div>
    </div>
  );
}
