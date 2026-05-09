import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BrandLogo } from "@/components/brand-logo";
import { readServerState } from "@/lib/server-state";

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
  const state = await readServerState();
  const connector = state.connectorAccounts.find((item) => item.provider === "gmail");
  const latestModelTrace = state.modelTraces.find((item) => item.provider === "ollama");
  const unreadCount = state.notifications.filter((item) => item.status === "unread").length;
  const openReviewCount = state.reviewItems.filter((item) => item.status === "open").length;
  const connectorStatus = connector?.status ?? "disconnected";
  const modelMode =
    latestModelTrace?.status === "ready"
      ? "Gemma ready"
      : process.env.CAREEROS_OLLAMA_ENABLED === "true"
        ? "Check settings"
        : "Deterministic-only";
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
            <Link className="brand flex min-h-11 items-center gap-3" href="/" prefetch={false}>
              <BrandLogo />
            </Link>
            <nav>
              {navItems.map((item) => (
                <Link
                  className="flex min-h-10 items-center rounded-full border border-transparent px-3.5 text-[13px] font-bold text-[var(--muted)] transition hover:-translate-y-px hover:border-[var(--line)] hover:bg-white/70 hover:text-[var(--ink)] max-[720px]:min-w-max max-[720px]:justify-center max-[720px]:px-3 max-[720px]:text-xs"
                  key={item.href}
                  href={item.href}
                  prefetch={false}
                >
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
              <div
                className="status-items"
                aria-label="Local runtime status"
              >
                <div className="status-chip">
                  <small>Workspace</small>
                  <strong>{workspaceStatus}</strong>
                </div>
                <div className="status-chip">
                  <small>Model mode</small>
                  <strong>{modelMode}</strong>
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
              <Link
                className={`${unreadCount > 0 ? severityBadgeClass("warning") : "badge ok"} max-[720px]:flex-none`}
                href="/notifications"
                prefetch={false}
              >
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
