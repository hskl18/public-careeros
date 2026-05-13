"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Pipeline" },
  { href: "/applications", label: "Applications" },
  { href: "/agents", label: "Agents" },
  { href: "/analytics", label: "Analytics" },
  { href: "/resume", label: "Resume" }
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

type AppNavProps = {
  className?: string;
  mode?: "header" | "bottom";
};

export function AppNav({ className, mode = "header" }: AppNavProps) {
  const pathname = usePathname();
  const isBottom = mode === "bottom";

  return (
    <nav
      className={
        isBottom
          ? `app-nav-bottom ${className ?? ""}`
          : `app-nav-header ${className ?? ""}`
      }
      aria-label="Workspace"
    >
      {navigation.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
            {active ? <span aria-hidden="true" className="active-line" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}
