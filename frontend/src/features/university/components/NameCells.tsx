import { shortId } from '@/lib/ids';
import type { Role } from '@/lib/roles';
import { useDemoDirectoryUser, useUserLabel } from '@/features/directory/users';

/** Table cells that need name hooks — hooks cannot be called inside a column render map. */
export function StudentNameCell({ userId }: { userId: string }) {
  return <>{useUserLabel(userId, 'student')}</>;
}

export function StudentMatriculeCell({ userId }: { userId: string }) {
  const user = useDemoDirectoryUser(userId);
  return <>{user?.matricule ?? shortId(userId)}</>;
}

export function SupervisorNameCell({ userId, fallback }: { userId?: string | null; fallback: string }) {
  const name = useUserLabel(userId ?? undefined, 'supervisor');
  return <>{userId ? name : fallback}</>;
}

export function RequesterNameCell({ userId, role }: { userId: string; role: Role }) {
  return <>{useUserLabel(userId, role)}</>;
}
