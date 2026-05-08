import { createHash, randomUUID } from "crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function stableId(prefix: string, parts: readonly string[]) {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 18);
  return `${prefix}_${digest}`;
}

export function hashText(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
