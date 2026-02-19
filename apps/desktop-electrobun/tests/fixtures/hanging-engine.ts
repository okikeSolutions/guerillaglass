import { stdin } from "node:process";

const decoder = new TextDecoder();
let buffer = "";

for await (const chunk of stdin) {
  buffer += decoder.decode(chunk, { stream: true });
  let newlineIndex = buffer.indexOf("\n");
  while (newlineIndex >= 0) {
    buffer = buffer.slice(newlineIndex + 1);
    newlineIndex = buffer.indexOf("\n");
  }
}
