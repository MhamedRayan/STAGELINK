/** Only the account keys the user actually changed (PATCH /api/users/me/ is partial). */
export function accountChanges(
  current: { name: string; email: string },
  next: { name: string; email: string },
): { name?: string; email?: string } {
  const changes: { name?: string; email?: string } = {};
  if (next.name !== current.name) changes.name = next.name;
  if (next.email.toLowerCase() !== current.email.toLowerCase()) changes.email = next.email;
  return changes;
}
