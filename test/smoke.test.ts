import { APP_NAME } from "../src/shared/types";

test("smoke", () => {
  expect(APP_NAME).toBe("Blueprint");
});
