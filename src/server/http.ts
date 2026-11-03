import { z } from "zod";

// A JSON body checked against a schema; a missing or malformed body fails the check.
export const parse = async <T>(schema: z.ZodType<T>, req: Request) =>
  schema.safeParse(await req.json().catch(() => undefined));

export const PermissionBody = z.object({
  id: z.string(),
  behavior: z.enum(["allow", "deny", "always"]),
  message: z.string().optional(),
});
