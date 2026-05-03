export function demoGuard(ctx: { profile?: { is_demo?: boolean } | null } | null | undefined) {
  if ((ctx?.profile as { is_demo?: boolean } | null)?.is_demo) {
    return { error: "Demo mode — sign up to make changes." };
  }
  return null;
}
