import demoDirectory from './directory.json';

export interface DemoUserInfo {
  name: string;
  email: string;
  role: string;
  matricule?: string;
  department?: string;
  university?: string;
  grade?: string;
}

export function resolveUserName(
  userId: string | null | undefined,
  fallbackRole: string = 'User'
): string {
  if (!userId) return 'Unassigned';

  // Demo directory check
  const isDemo = import.meta.env.VITE_DEMO_DIRECTORY !== '0';
  if (isDemo && userId in demoDirectory.users) {
    const user = (demoDirectory.users as Record<string, DemoUserInfo>)[userId];
    return user.name;
  }

  // Graceful degradation: Role · 3f2a9c
  const shortId = userId.length > 8 ? userId.slice(0, 6) : userId;
  const roleName = fallbackRole.charAt(0).toUpperCase() + fallbackRole.slice(1);
  return `${roleName} · ${shortId}`;
}

export function resolveUserMatricule(
  userId: string | null | undefined
): string {
  if (!userId) return '-';
  const isDemo = import.meta.env.VITE_DEMO_DIRECTORY !== '0';
  if (isDemo && userId in demoDirectory.users) {
    const user = (demoDirectory.users as Record<string, DemoUserInfo>)[userId];
    if (user.matricule) return user.matricule;
  }
  return userId.slice(0, 8);
}

export function getDemoDirectoryUsers(): Record<string, DemoUserInfo> {
  return demoDirectory.users;
}
