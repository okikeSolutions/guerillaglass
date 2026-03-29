import { stdin, stdout } from "node:process";

type Request = {
  id: string;
};

const decoder = new TextDecoder();
let buffer = "";
let hasWrittenInvalidResponse = false;

for await (const chunk of stdin) {
  buffer += decoder.decode(chunk, { stream: true });

  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    const raw = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    newlineIndex = buffer.indexOf("\n");
    if (!raw) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    const requestId = (parsed as Request).id;
    if (typeof requestId !== "string" || requestId.length === 0 || hasWrittenInvalidResponse) {
      continue;
    }

    hasWrittenInvalidResponse = true;
    stdout.write(`${JSON.stringify({ id: requestId, ok: "yes", result: {} })}\n`);
  }
}
