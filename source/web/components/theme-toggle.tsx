"use client";

type ThemeToggleProps = {
  compact?: boolean;
};

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  return (
    <button
      type="button"
      className={compact ? "btn btn-secondary btn-sm" : "button secondary"}
      aria-label="Theme preference"
      title="Theme preference"
    >
      Tone
    </button>
  );
}
