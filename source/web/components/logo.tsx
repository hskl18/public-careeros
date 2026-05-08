type LogoProps = {
  className?: string;
};

export function Logo({ className = "" }: LogoProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center rounded-md bg-[var(--ink-black)] text-[var(--paper)] ${className}`}
    >
      C
    </span>
  );
}
