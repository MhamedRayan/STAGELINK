import { http } from './http';
import type { components } from './schema/identity';

export type UserProfile = components['schemas']['UserProfile'];
export type TokenPair = components['schemas']['TokenPair'];
export type UserRegistration = components['schemas']['UserRegistration'];
export type Role = components['schemas']['Role'];
export type VerificationStatus = components['schemas']['VerificationStatus'];
export type AdminCompanySummary = components['schemas']['AdminCompanySummary'];
export type AdminCompanyPage = components['schemas']['AdminCompanyPage'];
export type AdminUserSummary = components['schemas']['AdminUserSummary'];
export type AdminUserPage = components['schemas']['AdminUserPage'];
export type AdminUserCreateRequest = components['schemas']['AdminUserCreateRequest'];
export type AdminUserCreateResponse = components['schemas']['AdminUserCreateResponse'];
export type AdminUserUpdateRequest = components['schemas']['AdminUserUpdateRequest'];
export type ProvisionableRole = components['schemas']['ProvisionableRole'];
export type PublicCompanyProfile = components['schemas']['PublicCompanyProfile'];
export type UserSummary = components['schemas']['UserSummary'];
export type BatchUserLookup = components['schemas']['BatchUserLookup'];

const LOOKUP_CHUNK_SIZE = 100;

export function login(email: string, password: string): Promise<TokenPair> {
  return http<TokenPair>('identity', '/api/auth/login/', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export function registerCompany(input: {
  email: string;
  name: string;
  password: string;
}): Promise<unknown> {
  return http('identity', '/api/auth/register/', {
    method: 'POST',
    body: { ...input, role: 'company' },
    skipAuth: true,
  });
}

export function logout(refresh: string): Promise<void> {
  return http<void>('identity', '/api/auth/logout/', {
    method: 'POST',
    body: { refresh },
    skipAuth: true,
  });
}

export function getMe(): Promise<UserProfile> {
  return http<UserProfile>('identity', '/api/users/me/');
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return http<void>('identity', '/api/users/me/password/', {
    method: 'POST',
    body: { current_password: currentPassword, new_password: newPassword },
  });
}

// --- Platform administration (contracts/identity.yaml §Admin) --------------------------------

export function listAdminCompanies(params: {
  status: VerificationStatus;
  page?: number;
}): Promise<AdminCompanyPage> {
  return http<AdminCompanyPage>('identity', '/api/admin/companies/', {
    query: { status: params.status, page: params.page },
  });
}

export function verifyAdminCompany(companyId: string): Promise<AdminCompanySummary> {
  return http<AdminCompanySummary>('identity', `/api/admin/companies/${companyId}/verify/`, {
    method: 'POST',
  });
}

export function rejectAdminCompany(companyId: string, reason: string): Promise<AdminCompanySummary> {
  return http<AdminCompanySummary>('identity', `/api/admin/companies/${companyId}/reject/`, {
    method: 'POST',
    body: { reason },
  });
}

export function listAdminUsers(params: { role?: Role; page?: number }): Promise<AdminUserPage> {
  return http<AdminUserPage>('identity', '/api/admin/users/', {
    query: { role: params.role, page: params.page },
  });
}

export function createAdminUser(input: AdminUserCreateRequest): Promise<AdminUserCreateResponse> {
  return http<AdminUserCreateResponse>('identity', '/api/admin/users/', {
    method: 'POST',
    body: input,
  });
}

export function getAdminUser(userId: string): Promise<AdminUserSummary> {
  return http<AdminUserSummary>('identity', `/api/admin/users/${userId}/`);
}

export function updateAdminUser(
  userId: string,
  input: AdminUserUpdateRequest,
): Promise<AdminUserSummary> {
  return http<AdminUserSummary>('identity', `/api/admin/users/${userId}/`, {
    method: 'PATCH',
    body: input,
  });
}

/** Public and unauthenticated; only verified (active) companies exist, others 404. */
export function getPublicCompanyProfile(companyId: string): Promise<PublicCompanyProfile> {
  return http<PublicCompanyProfile>('identity', `/api/companies/${companyId}/profile/`, {
    skipAuth: true,
  });
}

interface PendingUserLookup {
  ids: string[];
  resolve: (users: UserSummary[]) => void;
  reject: (error: unknown) => void;
}

let lookupQueue: PendingUserLookup[] = [];
let lookupScheduled = false;

/**
 * Resolve UUIDs to display names through the authenticated Identity directory.
 * Calls made in the same render tick are coalesced into one batch request
 * (chunks of at most 100), then fanned back out in the requested order.
 */
export function lookupUsers(ids: string[]): Promise<UserSummary[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return Promise.resolve([]);
  return new Promise<UserSummary[]>((resolve, reject) => {
    lookupQueue.push({ ids: unique, resolve, reject });
    if (!lookupScheduled) {
      lookupScheduled = true;
      queueMicrotask(flushUserLookups);
    }
  });
}

async function flushUserLookups(): Promise<void> {
  lookupScheduled = false;
  const pending = lookupQueue;
  lookupQueue = [];
  const allIds = [...new Set(pending.flatMap((entry) => entry.ids))];

  const chunks: string[][] = [];
  for (let index = 0; index < allIds.length; index += LOOKUP_CHUNK_SIZE) {
    chunks.push(allIds.slice(index, index + LOOKUP_CHUNK_SIZE));
  }
  try {
    const pages = await Promise.all(
      chunks.map((chunk) =>
        http<BatchUserLookup>('identity', '/api/users/lookup/', { query: { ids: chunk.join(',') } }),
      ),
    );
    const byId = new Map(pages.flatMap((page) => page.results).map((user) => [user.id, user]));
    pending.forEach(({ ids, resolve }) =>
      resolve(
        ids.flatMap((id) => {
          const user = byId.get(id);
          return user ? [user] : [];
        }),
      ),
    );
  } catch (error) {
    pending.forEach(({ reject }) => reject(error));
  }
}
