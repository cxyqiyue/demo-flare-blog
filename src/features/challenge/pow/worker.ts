import {
  type AltchaChallenge,
  decodeBase64Json,
  encodeBase64Json,
  solveAltchaChallenge,
} from "./altcha";

type SolverMessage =
  | { type: "work"; payload: string }
  | { type: "abort" };

let currentAbortController: AbortController | null = null;

self.onmessage = async (event: MessageEvent<SolverMessage>) => {
  const message = event.data;

  if (message.type === "abort") {
    currentAbortController?.abort();
    return;
  }

  const challenge = decodeBase64Json<AltchaChallenge>(message.payload);
  if (!challenge) {
    self.postMessage({ type: "aborted" });
    return;
  }

  const abortController = new AbortController();
  currentAbortController = abortController;

  const solution = await solveAltchaChallenge({
    challenge: challenge.challenge,
    salt: challenge.salt,
    max: challenge.maxnumber,
    signal: abortController.signal,
  });

  // 主线程主动中止（超时/重置）时由主线程处理状态，这里静默返回
  if (abortController.signal.aborted) return;

  if (solution === null) {
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
