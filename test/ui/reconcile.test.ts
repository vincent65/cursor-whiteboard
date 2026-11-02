import { reconcileExternalChange } from "../../src/ui/docs/reconcile";

test("clean editor reloads, dirty editor with a different disk text gets a banner, identical text is a noop", () => {
  expect(
    reconcileExternalChange({ dirty: false, localText: "a", diskText: "b" }),
  ).toBe("reload");
  expect(
    reconcileExternalChange({ dirty: true, localText: "a", diskText: "b" }),
  ).toBe("banner");
  expect(
    reconcileExternalChange({ dirty: true, localText: "a", diskText: "a" }),
  ).toBe("noop");
});
