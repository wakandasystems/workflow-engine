export type Role = "APPLICANT" | "REVIEWER";

export type ApplicationStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type TransitionAction =
  | "submit"
  | "start_review"
  | "approve"
  | "reject"
  | "return_for_changes";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Application {
  id: string;
  title: string;
  category: string;
  description: string;
  amount: number | null;
  status: ApplicationStatus;
  applicantId: string;
  createdAt: string;
  updatedAt: string;
  applicant: Pick<User, "id" | "name" | "email">;
  auditLogs?: AuditLog[];
}

export interface AuditLog {
  id: string;
  applicationId: string;
  actorId: string;
  oldStatus: ApplicationStatus;
  newStatus: ApplicationStatus;
  comment: string | null;
  createdAt: string;
  actor: Pick<User, "id" | "name" | "email"> & { role: Role };
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
  details?: Record<string, string[]>;
}
