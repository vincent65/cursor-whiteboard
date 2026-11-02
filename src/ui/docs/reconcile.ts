// Decides what an open editor does when its file changed on disk: a clean
// editor follows the disk, a dirty one asks before either side is lost.
export function reconcileExternalChange(input: {
  dirty: boolean;
  localText: string;
  diskText: string;
}): "reload" | "banner" | "noop" {
  if (input.localText === input.diskText) return "noop";
  return input.dirty ? "banner" : "reload";
}
