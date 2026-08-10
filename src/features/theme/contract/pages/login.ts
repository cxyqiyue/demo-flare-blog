import type { FieldErrors, UseFormRegister } from "react-hook-form";

export interface LoginSchema {
  email: string;
  password: string;
}

export interface LoginFormData {
  register: UseFormRegister<LoginSchema>;
  errors: FieldErrors<LoginSchema>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  loginStep: "IDLE" | "VERIFYING" | "SUCCESS";
  isSubmitting: boolean;
  challengePending: boolean;
}

export interface SocialLoginData {
  isLoading: boolean;
  handleGithubLogin: () => Promise<void>;
}

export interface LoginPageProps {
  isEmailConfigured: boolean;
  loginForm: LoginFormData;
  socialLogin: SocialLoginData;
  challengeElement: React.ReactNode;
}
