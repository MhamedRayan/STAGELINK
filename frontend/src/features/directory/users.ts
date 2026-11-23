import directory from '@/demo/directory.json';
import { fallbackLabel } from '@/lib/ids';
import { ROLE_LABEL, type Role } from '@/lib/roles';

export interface DemoDirectoryUser {
  name: string;
  email: string;
  role: Role;
  matricule?: string;
  department?: string;
}

const USERS = directory.users as Record<string, DemoDirectoryUser>;

/** Demo-only name directory. Production never reads `directory.json` (design-plan §6.1). */
export function useDemoDirectoryUser(userId: string | undefined): DemoDirectoryUser | undefined {
  if (!userId || import.meta.env.VITE_DEMO_DIRECTORY !== '1') return undefined;
  return USERS[userId];
}

/** Resolve a user id to a name; unknown ids degrade to `Role · 3f2a9c`. */
export function useUserLabel(userId: string | undefined, role: Role): string {
  const user = useDemoDirectoryUser(userId);
  if (user?.name) return user.name;
  if (!userId) return ROLE_LABEL[role];
  return fallbackLabel(role, userId);
}
