type BrandLogoProps = {
  className?: string;
  markOnly?: boolean;
};

export function BrandLogo({ className = "", markOnly = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()} aria-label="CareerOS">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        role="img"
        aria-label="CareerOS"
        className="brand-logo-svg"
      >
        <path
          d="M 92 96 L 156 96 A 16 16 0 0 1 172 112 L 172 304 A 16 16 0 0 0 188 320 L 420 320 A 16 16 0 0 1 436 336 L 436 400 A 16 16 0 0 1 420 416 L 156 416 A 80 80 0 0 1 76 336 L 76 112 A 16 16 0 0 1 92 96 Z"
          fill="var(--logo-primary, #0f172a)"
        />
        <path
          d="M 212 96 L 300 96 A 16 16 0 0 1 316 112 L 316 176 A 16 16 0 0 1 300 192 L 212 192 A 16 16 0 0 1 196 176 L 196 112 A 16 16 0 0 1 212 96 Z"
          fill="var(--logo-accent, #2563eb)"
        />
        <circle cx="388" cy="144" r="48" fill="var(--logo-dot, #16a34a)" />
      </svg>
      {markOnly ? null : <strong>CareerOS</strong>}
    </span>
  );
}
