export type Role = 'student' | 'company' | 'supervisor' | 'university_admin' | 'platform_admin';

export const ROLES: readonly Role[] = [
  'student',
  'company',
  'supervisor',
  'university_admin',
  'platform_admin',
];

export const ROLE_LABEL: Record<Role, string> = {
  student: 'Student',
  company: 'Company',
  supervisor: 'Supervisor',
  university_admin: 'University Admin',
  platform_admin: 'Platform Admin',
};

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function roleHome(role: Role): string {
  return ROLE_HOME[role];
}

const ROLE_HOME: Record<Role, string> = {
  student: '/app/student',
  company: '/app/company',
  supervisor: '/app/supervisor',
  university_admin: '/app/university',
  platform_admin: '/app/platform',
};
