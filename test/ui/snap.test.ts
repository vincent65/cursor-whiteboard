import { snapAngle } from "../../src/ui/board/snap";

const deg = (d: number) => (d * Math.PI) / 180;

test("snapAngle lands a rotation within 5 degrees of a quarter turn on it", () => {
  expect(snapAngle(deg(88))).toBeCloseTo(deg(90));
  expect(snapAngle(deg(184))).toBeCloseTo(deg(180));
  expect(snapAngle(deg(357))).toBe(0);
  expect(snapAngle(deg(2))).toBe(0);
  // Further from a quarter turn, the angle stays where the user left it.
  expect(snapAngle(deg(80))).toBe(deg(80));
  expect(snapAngle(deg(45))).toBe(deg(45));
});
