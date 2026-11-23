import type { components as Identity } from './generated/identity';
import type { components as Offers } from './generated/offers';
import type { components as Applications } from './generated/applications';
import type { components as Internships } from './generated/internships';
import type { components as Notifications } from './generated/notifications';

export type Role = Identity['schemas']['Role'];
export type User = Identity['schemas']['UserProfile'];
export type UserRegistration = Identity['schemas']['UserRegistration'];
export type TokenPair = Identity['schemas']['TokenPair'];
export type PublicCompanyProfile = Identity['schemas']['PublicCompanyProfile'];
export type CompanyRoleProfile = Identity['schemas']['CompanyRoleProfile'];
export type StudentRoleProfile = Identity['schemas']['StudentRoleProfile'];
export type SupervisorRoleProfile = Identity['schemas']['SupervisorRoleProfile'];
export type RoleProfile = Identity['schemas']['RoleProfile'];
export type RoleProfileUpdate = Identity['schemas']['RoleProfileUpdate'];
export type AdminCompany = Identity['schemas']['AdminCompanySummary'];
export type AdminUser = Identity['schemas']['AdminUserSummary'];
export type AdminCompanyPage = Identity['schemas']['AdminCompanyPage'];
export type AdminUserPage = Identity['schemas']['AdminUserPage'];
export type AdminUserCreateRequest = Identity['schemas']['AdminUserCreateRequest'];
export type AdminUserCreateResponse = Identity['schemas']['AdminUserCreateResponse'];
export type VerificationStatus = Identity['schemas']['VerificationStatus'];
export type PasswordChangeRequest = Identity['schemas']['PasswordChangeRequest'];

export type Offer = Offers['schemas']['Offer'];
export type OfferWrite = Offers['schemas']['OfferWrite'];
export type OfferStatus = Offers['schemas']['OfferStatus'];
export type PaginatedOffers = Offers['schemas']['PaginatedOffers'];

export type Application = Applications['schemas']['Application'];
export type ApplicationStatus = Applications['schemas']['ApplicationStatus'];
export type ApplicationList = Applications['schemas']['ApplicationList'];
export type ApplicationCreate = Applications['schemas']['ApplicationCreate'];
export type ApplicationHistory = Applications['schemas']['ApplicationStatusHistory'];

export type Internship = Internships['schemas']['Internship'];
export type InternshipStatus = Internships['schemas']['InternshipStatus'];
export type InternshipPage = Internships['schemas']['InternshipPage'];
export type CancellationRequest = Internships['schemas']['CancellationRequest'];
export type InternshipSubmission = Internships['schemas']['InternshipSubmission'];
export type InternshipEvaluation = Internships['schemas']['InternshipEvaluation'];

export type Notification = Notifications['schemas']['Notification'];
export type NotificationList = Notifications['schemas']['NotificationList'];
