import { http } from './http';
import type { components } from './schema/identity';

export type UserProfile = components['schemas']['UserProfile'];
export type TokenPair = components['schemas']['TokenPair'];
export type UserRegistration = components['schemas']['UserRegistration'];

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
