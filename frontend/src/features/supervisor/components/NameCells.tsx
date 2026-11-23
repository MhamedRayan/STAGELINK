import { useDemoDirectoryUser, useUserLabel } from '@/features/directory/users';
import { shortId } from '@/lib/ids';

/** Name cells for table columns (hooks cannot run inside a column render map). */
export function StudentNameCell({ userId }: { userId: string }) {
  return <>{useUserLabel(userId, 'student')}</>;
}

export function StudentMatriculeCell({ userId }: { userId: string }) {
  const user = useDemoDirectoryUser(userId);
  return <>{user?.matricule ?? shortId(userId)}</>;
}
