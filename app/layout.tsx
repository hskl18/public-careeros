import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { checkOllamaStatus } from "@/lib/model-status";
import { readState } from "@/lib/store";

export const metadata: Metadata = {
  title: "CareerOS",
  description: "Local-first job pipeline dashboard with review gates and optional Gemma analysis."
};

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/applications", label: "Applications" },
  { href: "/review", label: "Review" },
  { href: "/resume", label: "Resume" },
  { href: "/notifications", label: "Notifications" },
  { href: "/settings", label: "Settings" }
];

function severityBadgeClass(severity: string) {
  if (severity === "critical") return "badge danger";
  if (severity === "warning") return "badge warn";
  return "badge info";
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [state, modelStatus] = await Promise.all([readState(), checkOllamaStatus()]);
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const unreadCount = state.notifications.filter((item) => item.status === "unread").length;
  const openReviewCount = state.reviewItems.filter((item) => item.status === "open").length;
  const connectorStatus = connector?.status ?? "disconnected";
  const workspaceStatus = state.applications.length
    ? state.importJobs.some((item) => item.source === "seed")
      ? "Seeded demo data"
      : `${state.applications.length} applications`
    : "Empty workspace";

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <aside className="sidebar">
            <Link className="brand" href="/">
              <span className="brand-mark">CO</span>
              <span>
                <strong>CareerOS</strong>
                <small>Local workspace</small>
              </span>
            </Link>
            <nav>
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <p className="sidebar-note">
              Gmail and Ollama are optional. Local imports, seeded demo data, deterministic rules, and review gates work
              before any provider setup.
            </p>
          </aside>
          <div className="main-column">
            <div className="status-strip">
              <div className="status-items" aria-label="Local runtime status">
                <div className="status-chip">
                  <small>Workspace</small>
                  <strong>{workspaceStatus}</strong>
                </div>
                <div className="status-chip">
                  <small>Model mode</small>
                  <strong>{modelStatus.status === "ready" ? "Gemma ready" : "Deterministic-only"}</strong>
                </div>
                <div className="status-chip">
                  <small>Gmail</small>
                  <strong>{connectorStatus === "connected" ? "Connected" : connectorStatus === "needs_attention" ? "Needs attention" : "Not connected"}</strong>
                </div>
                <div className="status-chip">
                  <small>Review gate</small>
                  <strong>{openReviewCount} blocking update{openReviewCount === 1 ? "" : "s"}</strong>
                </div>
              </div>
              <Link className={unreadCount > 0 ? severityBadgeClass("warning") : "badge ok"} href="/notifications">
                Notifications {unreadCount}
              </Link>
            </div>
            <main className="main-surface">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
