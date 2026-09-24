import type { FieldErrors, UseFormRegister } from "react-hook-form";

export type LoginStep = "IDLE" | "OTP" | "VERIFYING" | "SUCCESS";

export interface LoginSchema {
  email: string;
  password: string;
  otp?: string;
}

export interface LoginFormData {
  register: UseFormRegister<LoginSchema>;
  errors: FieldErrors<LoginSchema>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  loginStep: LoginStep;
  isSubmitting: boolean;
  challengePending: boolean;
  /** 验证码已发送到的邮箱（OTP 步骤展示） */
  otpEmail: string | null;
  /** 距可重新发送的剩余秒数（0 = 可重发） */
  resendSecondsLeft: number;
  handleResendCode: () => Promise<void>;
  handleBackToCredentials: () => void;
}

export interface SocialLoginData {
  isLoading: boolean;
  /** 人机验证未通过时禁用登录按钮 */
  challengePending: boolean;
  handleGithubLogin: () => Promise<void>;
}

export interface LoginPageProps {
  isEmailConfigured: boolean;
  loginForm: LoginFormData;
  socialLogin: SocialLoginData;
  challengeElement: React.ReactNode;
}