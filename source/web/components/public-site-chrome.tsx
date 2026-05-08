import type { Route } from "next";
import Link from "next/link";
import { getOptionalSession, isAuthEnabled, signIn } from "@/auth";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { publicUseCases } from "@/lib/public-seo-routes";

type PublicNavId = "product" | "technology" | "showcase" | "security";

export const gemmaHackathonHref =
  "https://www.kaggle.com/competitions/gemma-4-good-hackathon/";

type GemmaHackathonRibbonProps = {
  label?: string;
  className?: string;
};

export function GemmaHackathonRibbon({
  label = "Gemma 4 Good Hackathon · Submission",
  className = "",
}: GemmaHackathonRibbonProps) {
  return (
    <a
      href={gemmaHackathonHref}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--brand-blue)]/18 bg-[var(--blue-soft)] px-3 py-1.5 transition hover:bg-[var(--blue-soft)]/80 ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
      <p className="typewriter-text text-[0.66rem] uppercase tracking-[0.16em] text-[var(--ink-blue)] sm:text-[0.68rem]">
        {label}
      </p>
      <span
        aria-hidden="true"
        className="text-[0.68rem] font-bold text-[var(--ink-blue)]"
      >
        ↗
      </span>
    </a>
  );
}

const navLinks = [
  { href: "/", label: "Overview", id: "product" },
  { href: "/tech" as Route, label: "Build", id: "technology" },
  { href: "/showcase", label: "Demo", id: "showcase" },
  { href: "/security", label: "Trust", id: "security" },
] satisfies Array<{
  href: Route;
  label: string;
  id: PublicNavId;
}>;

const footerLinkClass =
  "inline-flex min-h-[34px] items-center rounded-sm py-1 hover:text-[var(--ink-blue)]";
const footerStrongLinkClass =
  "inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-sm py-1 font-semibold text-[var(--ink-blue)]";

type PublicSiteNavProps = {
  appHref?: Route;
  current?: PublicNavId;
  signInHref?: Route;
};

export async function PublicSiteNav({
  appHref = "/app",
  current,
  signInHref = "/?next=/app",
}: PublicSiteNavProps) {
  const session = await getOptionalSession();

  return (
    <>
      <header className="public-nav-shell sticky top-3 z-50 mx-auto w-full max-w-[1120px] rounded-lg border px-3 py-2.5 backdrop-blur-xl sm:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <Link
              href="/"
              className="flex min-h-9 min-w-0 items-center gap-2.5 sm:gap-3"
            >
              <Logo className="h-7 w-7 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[var(--ink-black)] sm:text-base">
                  Other Candidate
                </span>
              </span>
            </Link>
          </div>
          <nav
            aria-label="Public showcase sections"
            className="public-site-nav hidden items-center gap-1 rounded-md p-1 text-center text-sm font-semibold lg:flex"
          >
            {navLinks.map((link) => {
              const isActive = current === link.id;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`public-site-nav-link ${
                    isActive ? "is-active" : ""
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center justify-end gap-2">
            <ThemeToggle compact />
            {session?.user ? (
              <Link href={appHref} className="btn btn-primary btn-sm">
                Open app
              </Link>
            ) : isAuthEnabled ? (
              <form
                action={async () => {
                  "use server";
                  await signIn(
                    "google",
                    { redirectTo: appHref },
                    {
                      prompt: "select_account",
                    },
                  );
                }}
              >
                <button type="submit" className="btn btn-primary btn-sm">
                  Sign in
                </button>
              </form>
            ) : (
              <Link href={signInHref} className="btn btn-primary btn-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <nav
        aria-label="Public showcase sections"
        className="public-bottom-nav fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 gap-1.5 border-t px-3 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 text-center text-[0.68rem] font-bold shadow-[0_-10px_30px_rgba(17,33,45,0.08)] backdrop-blur-xl lg:hidden"
      >
        {navLinks.map((link) => {
          const isActive = current === link.id;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive ? "page" : undefined}
              className={`public-mobile-nav-link ${
                isActive ? "is-active" : ""
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function PublicSiteFooter() {
  const useCaseLinks = Object.values(publicUseCases);

  return (
    <footer className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-col gap-2 py-1 text-xs text-[var(--ink-black)]/58 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <p className="typewriter-text uppercase tracking-[0.18em]">
          Private beta
        </p>
        <a
          href={gemmaHackathonHref}
          target="_blank"
          rel="noopener noreferrer"
          className="typewriter-text inline-flex items-center gap-1.5 uppercase tracking-[0.18em] text-[var(--ink-blue)] hover:underline"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--green)]" />
          Gemma 4 Good Hackathon
          <span aria-hidden="true">↗</span>
        </a>
      </div>
      <nav className="flex flex-wrap gap-3">
        {useCaseLinks.map((link) => (
          <Link
            key={link.path}
            href={link.path as Route}
            className={footerLinkClass}
          >
            {link.title}
          </Link>
        ))}
        <Link href="/security" className={footerStrongLinkClass}>
          Trust
        </Link>
        <Link href="/contact" className={footerLinkClass}>
          Contact
        </Link>
        <Link href="/privacy" className={footerLinkClass}>
          Privacy
        </Link>
        <Link href="/terms" className={footerLinkClass}>
          Terms
        </Link>
        <Link
          href="/data-deletion"
          className={footerStrongLinkClass}
        >
          Data deletion
        </Link>
      </nav>
    </footer>
  );
}
