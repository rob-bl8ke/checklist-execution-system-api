/**
 * Escapes all regex metacharacters in a string so it can be safely used
 * inside a RegExp constructor.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
