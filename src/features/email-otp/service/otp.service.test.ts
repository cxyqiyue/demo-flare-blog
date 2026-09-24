import { describe, expect, it } from "vitest";
import { OTP_LENGTH } from "@/features/email-otp/otp-constants";
import { generateOtp, getOtpIdentifier, hashOtp } from "./otp.service";

describe("generateOtp", () => {
  it("always produces a 6-digit zero-padded code", () => {
    for (let i = 0; i < 1000; i++) {
      const code = generateOtp();
      expect(code).toMatch(/^\d{6}$/);
    }
  });

  it("produces varying codes across calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) {
      seen.add(generateOtp());
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("respects OTP_LENGTH constant", () => {
    expect(generateOtp().length).toBe(OTP_LENGTH);
  });
});

describe("hashOtp", () => {
  it("returns a deterministic 64-char hex sha256", () => {
    const a = hashOtp("123456");
    const b = hashOtp("123456");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different codes", () => {
    expect(hashOtp("123456")).not.toBe(hashOtp("123457"));
  });
});

describe("getOtpIdentifier", () => {
  it("lowercases and trims the email", () => {
    expect(getOtpIdentifier(" User@Example.COM ", "login")).toBe(
      "email-otp:login:user@example.com",
    );
  });

  it("scopes by purpose", () => {
    expect(getOtpIdentifier("u@e.com", "register")).toBe(
      "email-otp:register:u@e.com",
    );
  });
});