export type UserRole =
  | 'student'
  | 'company'
  | 'university_admin'
  | 'supervisor'
  | 'platform_admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active?: boolean;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RefreshResponse {
  access: string;
  refresh: string;
}

export interface RegisterCompanyData {
  email: string;
  name: string;
  password: string;
  role: 'company';
}
