import { useQuery } from '@tanstack/react-query';
import { lookupUsers, type UserSummary } from '@/api/identity';
import directory from '@/demo/directory.json';
import { fallbackLabel } from '@/lib/ids';
import { getAccessToken } from '@/lib/session';
import { ROLE_LABEL, type Role } from '@/lib/roles';

export interface DemoDirectoryUser {
  name: string;
  email?: string;
  role: Role;
  matricule?: string;
  department?: string;
}

/** Normalised shape shared by the live directory and the legacy demo fixture. */
export type DirectoryUser = DemoDirectoryUser & {
  id: string;
  university?: string;
  specialty?: string;
  academic_year?: string;
};

const USERS = directory.users as Record<string, DemoDirectoryUser>;

export const userKeys = {
  detail: (userId: string) => ['directory-user', userId] as const,
};

function fromSummary(user: UserSummary): DirectoryUser {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    email: user.email,
    matricule: user.matricule,
    university: user.university,
    department: user.department,
    specialty: user.specialty,
    academic_year: user.academic_year,
  };
}

/**
 * Resolve a UUID through Identity's live directory. The API filters sensitive
 * fields by caller role, so data the viewer may not see is simply absent.
 * Anonymous callers skip the request entirely (guest screens use short ids).
 */
export function useDirectoryUser(userId: string | undefined): DirectoryUser | undefined {
  const { data } = useQuery({
    queryKey: userKeys.detail(userId ?? ''),
    queryFn: async () => (await lookupUsers([userId as string]))[0] ?? null,
    enabled: Boolean(userId) && Boolean(getAccessToken()),
    staleTime: 10 * 60_000,
    retry: false,
  });

  if (data) return fromSummary(data);
  // Legacy demo fixture: kept as a fallback for offline/demo runs only.
  if (userId && import.meta.env.VITE_DEMO_DIRECTORY === '1') {
    const demo = USERS[userId];
    if (demo) return { id: userId, ...demo };
  }
  return undefined;
}

/** Demo-only roster for a role, sorted by name (used by supervisor pickers). */
export function demoDirectoryUsers(role: Role): Array<DemoDirectoryUser & { id: string }> {
  if (import.meta.env.VITE_DEMO_DIRECTORY !== '1') return [];
  return Object.entries(USERS)
    .filter(([, user]) => user.role === role)
    .map(([id, user]) => ({ id, ...user }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Resolve a user id to a live name; unknown ids degrade to `Role · 3f2a9c`. */
export function useUserLabel(userId: string | undefined, role: Role): string {
  const user = useDirectoryUser(userId);
  if (user?.name) return user.name;
  if (!userId) return ROLE_LABEL[role];
  return fallbackLabel(role, userId);
}
