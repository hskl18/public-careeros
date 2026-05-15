import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ActionLinkProps = ComponentProps<typeof Link> & {
  children: ReactNode;
  variant?: "primary" | "secondary";
  size?: "default" | "sm";
};

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function ActionLink({
  children,
  className,
  variant = "secondary",
  size = "default",
  ...props
}: ActionLinkProps) {
  return (
    <Link
      className={cn("btn", variant === "primary" ? "btn-primary" : "btn-secondary", size === "sm" && "btn-sm", className)}
      {...props}
    >
      {children}
    </Link>
  );
}
