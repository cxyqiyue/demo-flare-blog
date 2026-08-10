import {
  type AltchaChallenge,
  encodeBase64Json,
  solveAltchaChallenge,
} from "./altcha";

type SolverMessage =
  | { type: "work"; payload: AltchaChallenge }
  | { type: "abort" };

let currentAbortController: AbortController | null = null;

self.onmessage = async (event: MessageEvent<SolverMessage>) => {
  const message = event.data;

  if (message.type === "abort") {
    currentAbortController?.abort();
    return;
  }

  const challenge = message.payload;
  const abortController = new AbortController();
  currentAbortController = abortController;

  const solution = await solveAltchaChallenge({
    challenge: challenge.challenge,
    salt: challenge.salt,
    max: challenge.maxnumber,
    signal: abortController.signal,
  });

  if (abortController.signal.aborted || solution === null) {
    self.postMessage({ type: "aborted" });
    return;
  }

  self.postMessage({
    type: "solution",
    payload: encodeBase64Json({
      algorithm: challenge.algorithm,
      challenge: challenge.challenge,
      maxnumber: challenge.maxnumber,
      number: solution,
      salt: challenge.salt,
      signature: challenge.signature,
    }),
  });
};
