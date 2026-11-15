import { twMerge } from "tailwind-merge";

/**
 * Class merge with conflict resolution.
 *
 * This used to be a plain join, which meant a call site could not override a component's
 * base utility: `className="hidden md:inline-flex"` on a button whose base says
 * `inline-flex` produced both classes, and whichever came later in the generated CSS won —
 * `.inline-flex` does. The button stayed visible on phones while the source said "hidden".
 *
 * twMerge resolves the conflict the way the author intended: the last class wins.
 */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return twMerge(parts.filter(Boolean).join(" "));
}
