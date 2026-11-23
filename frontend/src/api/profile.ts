import { http } from './http';
import type { components } from './schema/identity';

type Schemas = components['schemas'];
export type UserProfile = Schemas['UserProfile'];
export type UserProfileUpdate = Schemas['UserProfileUpdate'];
export type StudentRoleProfile = Schemas['StudentRoleProfile'];
export type CompanyRoleProfile = Schemas['CompanyRoleProfile'];
export type SupervisorRoleProfile = Schemas['SupervisorRoleProfile'];
export type StudentProfileUpdate = Schemas['StudentProfileUpdate'];
export type CompanyProfileUpdate = Schemas['CompanyProfileUpdate'];
export type SupervisorProfileUpdate = Schemas['SupervisorProfileUpdate'];
export type RoleProfileUpdate = Schemas['RoleProfileUpdate'];

/** Name and/or email of the signed-in account. */
export function updateAccount(body: UserProfileUpdate): Promise<UserProfile> {
  return http<UserProfile>('identity', '/api/users/me/', { method: 'PATCH', body });
}

/** Role-specific profile (student, company, supervisor). 403 for other roles. */
export function getRoleProfile<T extends Schemas['RoleProfile']>(): Promise<T> {
  return http<T>('identity', '/api/users/me/profile/');
}

/** Full replace: every required field of the role's update schema must be sent. */
export function putRoleProfile(body: RoleProfileUpdate): Promise<Schemas['RoleProfile']> {
  return http<Schemas['RoleProfile']>('identity', '/api/users/me/profile/', { method: 'PUT', body });
}
