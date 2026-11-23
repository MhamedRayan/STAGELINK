import { request, toQuery } from './client';
import type {
  AdminCompany,
  AdminCompanyPage,
  AdminUser,
  AdminUserCreateRequest,
  AdminUserCreateResponse,
  AdminUserPage,
  PasswordChangeRequest,
  PublicCompanyProfile,
  RoleProfile,
  RoleProfileUpdate,
  TokenPair,
  User,
  UserRegistration,
} from './types';

export const identityApi = {
  login: (email: string, password: string) =>
    request<TokenPair>('identity', '/api/auth/login/', {
      method: 'POST',
      auth: false,
      body: { email, password },
    }),

  register: (payload: UserRegistration) =>
    request<User>('identity', '/api/auth/register/', {
      method: 'POST',
      auth: false,
      body: payload,
    }),

  logout: (refresh: string) =>
    request<{ detail: string }>('identity', '/api/auth/logout/', {
      method: 'POST',
      body: { refresh },
    }),

  me: () => request<User>('identity', '/api/users/me/'),

  updateMe: (payload: { name?: string; email?: string }) =>
    request<User>('identity', '/api/users/me/', { method: 'PATCH', body: payload }),

  changePassword: (payload: PasswordChangeRequest) =>
    request<{ detail: string }>('identity', '/api/users/me/password/', {
      method: 'POST',
      body: payload,
    }),

  getMyProfile: () => request<RoleProfile>('identity', '/api/users/me/profile/'),

  updateMyProfile: (payload: RoleProfileUpdate) =>
    request<RoleProfile>('identity', '/api/users/me/profile/', { method: 'PUT', body: payload }),

  getPublicCompany: (companyUserId: string) =>
    request<PublicCompanyProfile>(
      'identity',
      `/api/companies/${encodeURIComponent(companyUserId)}/profile/`,
      { auth: false },
    ),

  listCompanies: (params: { status?: string; page?: number; search?: string } = {}) =>
    request<AdminCompanyPage>('identity', `/api/admin/companies/${toQuery(params)}`),

  verifyCompany: (companyUserId: string) =>
    request<AdminCompany>(
      'identity',
      `/api/admin/companies/${encodeURIComponent(companyUserId)}/verify/`,
      { method: 'POST' },
    ),

  rejectCompany: (companyUserId: string, reason: string) =>
    request<AdminCompany>(
      'identity',
      `/api/admin/companies/${encodeURIComponent(companyUserId)}/reject/`,
      { method: 'POST', body: { reason } },
    ),

  listUsers: (params: { role?: string; page?: number; search?: string } = {}) =>
    request<AdminUserPage>('identity', `/api/admin/users/${toQuery(params)}`),

  createUser: (payload: AdminUserCreateRequest) =>
    request<AdminUserCreateResponse>('identity', '/api/admin/users/', {
      method: 'POST',
      body: payload,
    }),

  updateUser: (
    userId: string,
    payload: { is_active?: boolean; verification_status?: string; rejection_reason?: string },
  ) =>
    request<AdminUser>('identity', `/api/admin/users/${encodeURIComponent(userId)}/`, {
      method: 'PATCH',
      body: payload,
    }),
};
