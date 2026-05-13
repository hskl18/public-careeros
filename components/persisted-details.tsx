"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type PersistedDetailsProps = {
  storageKey: string;
  defaultOpen?: boolean;
  className?: string;
  summary: ReactNode;
  children: ReactNode;
};

export function PersistedDetails({
  storageKey,
  defaultOpen = false,
  className,
  summary,
  children
}: PersistedDetailsProps) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined" || !ref.current) return;
    try {
      const stored = window.localStorage.getItem(`careeros.details.${storageKey}`);
      if (stored === "1") ref.current.open = true;
      else if (stored === "0") ref.current.open = false;
    } catch {
      /* localStorage unavailable; fall back to defaultOpen */
    }
  }, [storageKey]);

  return (
    <details
      ref={ref}
      className={className}
      open={defaultOpen}
      suppressHydrationWarning
      onToggle={(event) => {
        if (!hydrated || typeof window === "undefined") return;
        try {
          window.localStorage.setItem(
            `careeros.details.${storageKey}`,
            event.currentTarget.open ? "1" : "0"
          );
        } catch {
          /* persistence is best-effort */
        }
      }}
    >
      {summary}
      {children}
    </details>
  );
}
