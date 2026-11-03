import { readFileSync } from "node:fs";
import { z } from "zod";

// What a split costs, and a rule that names no costUsd.
export const DEFAULT_COST_USD = 0.01;

const isRegExp = (source: string) => {
  try {
    new RegExp(source);
    return true;
  } catch {
    return false;
  }
};

const Step = z.discriminatedUnion("do", [
  z.object({ do: z.literal("say"), text: z.string() }),
  z.object({
    do: z.literal("tool"),
    server: z.literal("blueprint"),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
  // Relative to the session's cwd.
  z.object({ do: z.literal("write"), path: z.string(), content: z.string() }),
  // Goes through canUseTool.
  z.object({
    do: z.literal("ask"),
    tool: z.string(),
    input: z.record(z.string(), z.unknown()),
  }),
]);
// match: a regular expression tested against the user message.
const Rule = z.object({
  match: z.string().refine(isRegExp, "not a valid regular expression"),
  steps: z.array(Step),
  costUsd: z.number().default(DEFAULT_COST_USD),
});
const Scenario = z.object({
  plan: z.array(Rule),
  run: z.array(Rule),
  split: z.object({ tasks: z.array(z.unknown()) }),
});

export type Step = z.infer<typeof Step>;
export type Rule = z.infer<typeof Rule>;
export type Scenario = z.infer<typeof Scenario>;

// Throws naming the file and, for a schema error, the bad step's path.
export function loadScenario(path: string): Scenario {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(
      `The fake SDK scenario ${path} could not be read: ${(err as Error).message}`,
    );
  }
  const parsed = Scenario.safeParse(json);
  if (!parsed.success)
    throw new Error(
      `The fake SDK scenario ${path} is invalid:\n${z.prettifyError(parsed.error)}`,
    );
  return parsed.data;
}
