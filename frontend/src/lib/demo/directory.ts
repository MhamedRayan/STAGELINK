import type { Role } from '@/lib/api/types';
import { shortId } from '@/lib/ids';

export interface DirectoryEntry {
  name: string;
  email?: string;
  role?: Role;
  matricule?: string;
  department?: string;
}

interface DirectoryFile {
  users: Record<string, DirectoryEntry>;
}

let cache: DirectoryFile | null = null;

function load(): DirectoryFile {
  if (cache) return cache;
  cache = { users: {} };
  if (import.meta.env.VITE_DEMO_DIRECTORY === '1') {
    // Loaded synchronously via Vite's JSON import so name lookups never suspend.
    try {
      const modules = import.meta.glob('/src/demo/directory.json', { eager: true }) as Record<
        string,
        { default: DirectoryFile }
      >;
      const file = Object.values(modules)[0]?.default;
      if (file?.users) cache = file;
    } catch {
      /* demo directory is optional */
    }
  }
  return cache;
}

export function directoryUser(id: string | null | undefined): DirectoryEntry | undefined {
  if (!id) return undefined;
  return load().users[id];
}

export function listDirectoryUsers(role?: Role): Array<{ id: string } & DirectoryEntry> {
  return Object.entries(load().users)
    .filter(([, entry]) => (role ? entry.role === role : true))
    .map(([id, entry]) => ({ id, ...entry }));
}

export function displayUserName(id: string | null | undefined, roleLabel = 'User'): string {
  const entry = directoryUser(id);
  if (entry?.name) return entry.name;
  return `${roleLabel} · ${id ? shortId(id) : 'unknown'}`;
}

export function displayUserMatricule(id: string | null | undefined): string {
  const entry = directoryUser(id);
  return entry?.matricule ?? (id ? shortId(id) : 'unknown');
}
