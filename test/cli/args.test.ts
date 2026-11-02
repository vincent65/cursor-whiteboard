import { expect, test } from "vitest";
import { parseArgs } from "../../src/cli/args.js";

test("defaults to serve on 4242 with open", () =>
  expect(parseArgs([])).toEqual({ command: "serve", port: 4242, open: true }));
test("init, --port and --no-open", () =>
  expect(parseArgs(["init", "--port", "5000", "--no-open"])).toEqual({
    command: "init",
    port: 5000,
    open: false,
  }));
test("unknown flag throws with the flag name", () =>
  expect(() => parseArgs(["--bogus"])).toThrow("--bogus"));
