import { stdin } from "node:process";

const decoder = new TextDecoder();
let buffer = "";

for await (const chunk of stdin) {
  buffer += decoder.decode(chunk, { stream: true });
  if (buffer.includes("\n")) {
    process.exit(9);
  }
}
