import type { FieldErrors, UseFormRegister } from "react-hook-form";

export type RegisterStep = "IDLE" | "OTP" | "VERIFYING" | "SUCCESS";

export interface RegisterSchema {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  otp?: string;
}

export interface RegisterFormData {
  register: UseFormRegister<RegisterSchema>;
  errors: FieldErrors<RegisterSchema>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  isSuccess: boolean;
  registerStep: RegisterStep;
  /** 验证码已发送到的邮箱（OTP 步骤展示） */
  otpEmail: string | null;
  /** 距可重新发送的剩余秒数（0 = 可重发） */
  resendSecondsLeft: number;
  handleResendCode: () => Promise<void>;
  handleBackToCredentials: () => void;
}

export interface RegisterPageProps {
  isEmailConfigured: boolean;
  registerForm: RegisterFormData;
  challengeElement: React.ReactNode;
}