/** Tiny classnames join — keeps the overlay dependency-free. */
export default function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
