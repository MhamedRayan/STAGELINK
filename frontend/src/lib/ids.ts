import { ROLE_LABEL, type Role } from './roles';

/** First 6 characters of a UUID, e.g. "3f2a9c". */
export function shortId(id: string): string {
  return id.replace(/-/g, '').slice(0, 6);
}

/** Honest fallback when a name cannot be resolved: "Student · 3f2a9c". */
export function fallbackLabel(role: Role | 'Company', id: string): string {
  const label = role === 'Company' ? 'Company' : ROLE_LABEL[role];
  return `${label} · ${shortId(id)}`;
}
