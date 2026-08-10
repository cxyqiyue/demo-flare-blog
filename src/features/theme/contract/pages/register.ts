import type { FieldErrors, UseFormRegister } from "react-hook-form";

export interface RegisterSchema {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface RegisterFormData {
  register: UseFormRegister<RegisterSchema>;
  errors: FieldErrors<RegisterSchema>;
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  isSuccess: boolean;
  challengePending: boolean;
}

export interface RegisterPageProps {
  isEmailConfigured: boolean;
  registerForm: RegisterFormData;
  challengeElement: React.ReactNode;
}
