// A rotation that ends within a few degrees of a quarter turn lands on it, so
// shapes line up without holding Shift.
export const QUARTER = Math.PI / 2;
export const SNAP_TOLERANCE = (5 * Math.PI) / 180;

// The angle a rotation should end at: the nearest quarter turn when within the
// tolerance, normalized to [0, 2π), and otherwise the angle as it is.
export function snapAngle(angle: number, tolerance = SNAP_TOLERANCE): number {
  const nearest = Math.round(angle / QUARTER) * QUARTER;
  if (Math.abs(angle - nearest) > tolerance) return angle;
  const full = 2 * Math.PI;
  return ((nearest % full) + full) % full;
}
