type BrandLogoProps = {
  className?: string;
  markOnly?: boolean;
};

export function BrandLogo({ className = "", markOnly = false }: BrandLogoProps) {
  return (
    <span className={`brand-logo ${className}`.trim()} aria-label="CareerOS">
      <svg className="brand-logo-mark" viewBox="0 0 48 48" role="img" aria-hidden="true">
        <rect x="3" y="3" width="42" height="42" rx="12" />
        <path d="M17 16.5c-4.2 0-7.1 3.1-7.1 7.5s2.9 7.5 7.1 7.5c2.4 0 4.3-.8 5.8-2.5l-2.2-2.5c-.9 1-2 1.5-3.4 1.5-2.2 0-3.7-1.6-3.7-4s1.5-4 3.7-4c1.4 0 2.5.5 3.4 1.5l2.2-2.5c-1.5-1.7-3.4-2.5-5.8-2.5Z" />
        <path d="M31.2 16.5c-4.4 0-7.6 3.1-7.6 7.5s3.2 7.5 7.6 7.5 7.6-3.1 7.6-7.5-3.2-7.5-7.6-7.5Zm0 3.5c2.2 0 3.9 1.6 3.9 4s-1.7 4-3.9 4-3.9-1.6-3.9-4 1.7-4 3.9-4Z" />
      </svg>
      {markOnly ? null : (
        <span className="brand-logo-copy">
          <strong>CareerOS</strong>
          <small>Local workspace</small>
        </span>
      )}
    </span>
  );
}
