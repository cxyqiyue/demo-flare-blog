import type { FieldErrors, UseFormRegister } from "react-hook-form";

export interface ForgotPasswordSchema {
  email: string;
}

export interface ForgotPasswordFormData {
  register: UseFormRegister<ForgotPasswordSchema>;
  errors: FieldErrors<ForgotPasswordSchema>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  isSent: boolean;
  sentEmail: string;
}

export interface ForgotPasswordPageProps {
  forgotPasswordForm: ForgotPasswordFormData;
}
