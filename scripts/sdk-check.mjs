// Run by hand: checks that the Agent SDK works with the user's own Claude
// Code login (no API key). Never run by tests.
import { query } from "@anthropic-ai/claude-agent-sdk";

const timer = setTimeout(() => {
  console.error("no result within 120 seconds");
  process.exit(1);
}, 120_000);

for await (const msg of query({
  prompt: "Reply with the single word ready.",
  options: { cwd: process.cwd(), maxTurns: 1, allowedTools: [] },
})) {
  if (msg.type === "system" && msg.subtype === "init") {
    console.log(`apiKeySource: ${msg.apiKeySource}`);
    console.log(`claude_code_version: ${msg.claude_code_version}`);
    console.log(`model: ${msg.model}`);
  } else if (msg.type === "result") {
    clearTimeout(timer);
    console.log(
      `result (${msg.subtype}): ${msg.result ?? JSON.stringify(msg)}`,
    );
    process.exit(msg.is_error ? 1 : 0);
  }
}
console.error("query ended without a result");
process.exit(1);
