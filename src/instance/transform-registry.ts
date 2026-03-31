export type TransformFn = (value: string, ...args: string[]) => string;

const registry = new Map<string, TransformFn>([
  // Case transforms
  ['upper', (v) => v.toUpperCase()],
  ['lower', (v) => v.toLowerCase()],
  ['capitalize', (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1) : v)],
  [
    'title_case',
    (v) => v.replace(/\b\w/g, (c) => c.toUpperCase()),
  ],

  // Whitespace transforms
  ['trim', (v) => v.trim()],
  ['remove_spaces', (v) => v.replace(/\s+/g, '')],
  ['collapse_spaces', (v) => v.trim().replace(/\s+/g, ' ')],

  // Naming convention transforms
  ['snake_case', (v) => v.trim().replace(/\s+/g, '_').toLowerCase()],
  ['kebab_case', (v) => v.trim().replace(/\s+/g, '-').toLowerCase()],
  [
    'camel_case',
    (v) => {
      const words = v.trim().split(/\s+/);
      if (words.length === 0) return v;
      return (
        words[0].toLowerCase() +
        words
          .slice(1)
          .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
          .join('')
      );
    },
  ],
  [
    'pascal_case',
    (v) =>
      v
        .trim()
        .split(/\s+/)
        .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
        .join(''),
  ],

  // Substitution transforms
  ['replace', (v, search = '', replacement = '') => v.split(search).join(replacement)],
  ['default', (v, fallback = '') => v || fallback],

  // Padding / truncation transforms
  ['truncate', (v, n = '0') => v.slice(0, Number(n))],
  ['pad_left', (v, len = '0', ch = ' ') => v.padStart(Number(len), ch || ' ')],
  ['pad_right', (v, len = '0', ch = ' ') => v.padEnd(Number(len), ch || ' ')],
]);

export function getTransform(name: string): TransformFn | undefined {
  return registry.get(name);
}
