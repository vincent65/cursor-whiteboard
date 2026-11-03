// $<i> names the add_node op at index i of the same proposal. No zod here,
// so the UI bundle can share the rule with the server.

const REF = /^\$(0|[1-9]\d*)$/;

// Any end starting with $ is meant as a reference, well formed or not.
export const isRef = (s: string): boolean => s.startsWith("$");

export function refIndex(s: string): number | null {
  return REF.test(s) ? Number(s.slice(1)) : null;
}
