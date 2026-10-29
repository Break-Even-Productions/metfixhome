import type { RoleId } from "@shared/join";

export type { RoleId };
export type AuthProvider = "google" | "email";
export type JoinStep = "name" | "auth" | "roles" | "conditional" | "path";
export type AuthView = "choose" | "email-signin" | "email-signup";
export type PathView = "plan" | "article" | "course";
export type WhopPlan = "pro" | "org";

export type JoinProfile = {
  firstName: string;
  lastName: string;
  email: string;
  authProvider: AuthProvider | null;
  roles: RoleId[];
  hasPhysicalGym: boolean | null;
  hasPhysicalClinic: boolean | null;
  completed: boolean;
};

export type RecommendCourse = {
  id: string;
  title: string;
  category: string;
  description: string;
  hours: string;
  image: string;
  tone: string;
  badge?: string;
  roles: RoleId[];
};

export type RecommendArticle = {
  id: string;
  title: string;
  category: string;
  description: string;
  minutes: string;
  roles: RoleId[];
  body: string[];
};
