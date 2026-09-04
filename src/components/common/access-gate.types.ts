export type AccessGateMode = "private" | "password" | "login";

export type AccessGateError =
  | "wrongPassword"
  | "rateLimited"
  | "locked"
  | "invalidLink"
  | "generic";
