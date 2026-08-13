import { describe, expect, it } from "vitest";
import {
  type AltchaChallenge,
  createAltchaChallenge,
  decodeBase64Json,
  encodeBase64Json,
  parseAltchaSolution,
  solveAltchaChallenge,
  verifyAltchaSolution,
} from "./altcha";

const SECRET = "test-secret";

describe("ALTCHA PoW challenge flow", () => {
  it("should verify a valid solution produced by the worker payload shape", async () => {
    const challenge = createAltchaChallenge({
      maxNumber: 2000,
      secret: SECRET,
      number: 1234,
    });

    const number = await solveAltchaChallenge({
      challenge: challenge.challenge,
      salt: challenge.salt,
      max: challenge.maxnumber,
    });

    expect(number).toBe(1234);

    const payload = encodeBase64Json({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      maxnumber: challenge.maxnumber,
      number,
      salt: challenge.salt,
      signature: challenge.signature,
    });

    const solution = parseAltchaSolution(payload);
    expect(solution).not.toBeNull();
    expect(
      verifyAltchaSolution(solution as NonNullable<typeof solution>, SECRET),
    ).toBe(true);
  });

  it("should decode a base64 challenge payload, solve and produce a verifiable solution (worker flow)", async () => {
    const payload = encodeBase64Json(
      createAltchaChallenge({
        maxNumber: 3000,
        secret: SECRET,
      }),
    );

    const challenge = decodeBase64Json<AltchaChallenge>(payload);
    expect(challenge).not.toBeNull();
    const c = challenge as NonNullable<typeof challenge>;

    const number = await solveAltchaChallenge({
      challenge: c.challenge,
      salt: c.salt,
      max: c.maxnumber,
    });
    expect(number).not.toBeNull();

    const solutionPayload = encodeBase64Json({
      algorithm: c.algorithm,
      challenge: c.challenge,
      maxnumber: c.maxnumber,
      number: number as number,
      salt: c.salt,
      signature: c.signature,
    });

    const solution = parseAltchaSolution(solutionPayload);
    expect(solution).not.toBeNull();
    expect(
      verifyAltchaSolution(solution as NonNullable<typeof solution>, SECRET),
    ).toBe(true);
  });

  it("should reject a solution with an out-of-range number", () => {
    const challenge = createAltchaChallenge({
      maxNumber: 100,
      secret: SECRET,
      number: 50,
    });

    const solution = {
      ...challenge,
      maxnumber: 100,
      number: 500,
    };

    expect(verifyAltchaSolution(solution, SECRET)).toBe(false);
  });

  it("should reject a solution with a wrong secret", () => {
    const challenge = createAltchaChallenge({
      maxNumber: 100,
      secret: SECRET,
      number: 50,
    });

    const payload = encodeBase64Json({
      ...challenge,
      number: 50,
    });

    const solution = parseAltchaSolution(payload);
    expect(solution).not.toBeNull();
    expect(
      verifyAltchaSolution(solution as NonNullable<typeof solution>, "wrong"),
    ).toBe(false);
  });

  it("should round-trip base64 JSON encoding", () => {
    const value = { a: 1, b: "你好" };
    const decoded = decodeBase64Json<typeof value>(encodeBase64Json(value));
    expect(decoded).toEqual(value);
  });
});
