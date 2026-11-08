import "server-only";

export type UserRole = "reader" | "admin";
export type UserStatus = "active" | "disabled";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  passwordResetRequired: boolean;
};

export type Session = AuthUser & {
  sessionId: string;
  expiresAt: Date;
};

export type RequestMeta = {
  ip: string;
};
