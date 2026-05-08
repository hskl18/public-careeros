export const isAuthEnabled = false;

export async function getOptionalSession() {
  return null as null | { user?: { name?: string | null; email?: string | null } };
}

export async function signIn(..._args: unknown[]) {
  throw new Error("Authentication is disabled in the local-first public build.");
}
