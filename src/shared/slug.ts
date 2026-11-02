// The names boards and docs may have; they become file names and URL paths.
export const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

// "My Board" -> "my-board"; returns "" when nothing usable remains.
export const slugify = (input: string): string =>
  input
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
