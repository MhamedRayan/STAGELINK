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

/**
 * Demo-only roster for a role, sorted by name. Production has no directory endpoint
 * (design-plan §3.4), so callers must hide roster-based pickers when the flag is off.
 */
export function demoDirectoryUsers(role: Role): Array<DemoDirectoryUser & { id: string }> {
  if (import.meta.env.VITE_DEMO_DIRECTORY !== '1') return [];
  return Object.entries(USERS)
    .filter(([, user]) => user.role === role)
    .map(([id, user]) => ({ id, ...user }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a user id to a name; unknown ids degrade to `Role · 3f2a9c`. */
export function useUserLabel(userId: string | undefined, role: Role): string {
  const user = useDemoDirectoryUser(userId);
  if (user?.name) return user.name;
  if (!userId) return ROLE_LABEL[role];
  return fallbackLabel(role, userId);
}
