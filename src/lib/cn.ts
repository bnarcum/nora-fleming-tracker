/**
 * Tiny class-name combiner. Avoids pulling in a dependency for what is
 * essentially a one-line utility.
 */
export function cn(...inputs: Array<string | number | boolean | null | undefined>): string {
  return inputs.filter((v) => typeof v === "string" && v.length > 0).join(" ");
}
