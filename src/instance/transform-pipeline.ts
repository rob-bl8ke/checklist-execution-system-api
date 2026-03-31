import { getTransform } from './transform-registry';

interface TransformCall {
  name: string;
  args: string[];
}

/**
 * Splits expression on `|`, respecting quoted strings that may contain
 * pipe characters or commas.
 */
function splitPipes(expr: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of expr) {
    if (inQuote) {
      current += ch;
      if (ch === quoteChar) inQuote = false;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === '|') {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  const last = current.trim();
  if (last) parts.push(last);

  return parts;
}

/**
 * Parses comma-separated arguments from inside a transform's parentheses,
 * stripping surrounding quote characters.
 */
function parseArgs(argsStr: string): string[] {
  if (!argsStr.trim()) return [];

  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of argsStr) {
    if (inQuote) {
      if (ch === quoteChar) {
        inQuote = false;
      } else {
        current += ch;
      }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ',') {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  args.push(current.trim());
  return args;
}

/**
 * Parses a single transform segment such as `upper` or `replace(".", "_")`.
 */
function parseTransformCall(segment: string): TransformCall {
  const parenIdx = segment.indexOf('(');
  if (parenIdx === -1) {
    return { name: segment.trim(), args: [] };
  }

  const name = segment.slice(0, parenIdx).trim();
  const closeParen = segment.lastIndexOf(')');
  const argsStr = closeParen > parenIdx ? segment.slice(parenIdx + 1, closeParen) : '';
  return { name, args: parseArgs(argsStr) };
}

/**
 * Evaluates a full placeholder expression (the text between delimiters) against
 * the provided variables map.
 *
 * @returns The rendered string, or `null` if the placeholder should be left
 *          intact (unknown transform, or variable not found without a `default`
 *          in the chain).
 */
export function evaluate(
  expression: string,
  variables: Record<string, string>,
): string | null {
  const parts = splitPipes(expression);
  if (parts.length === 0) return null;

  const varName = parts[0].trim();
  if (!varName) return null;

  const transformCalls = parts.slice(1).map(parseTransformCall);

  // Fail-safe: if any transform is unknown, leave placeholder intact
  for (const t of transformCalls) {
    if (t.name && !getTransform(t.name)) return null;
  }

  const hasDefault = transformCalls.some((t) => t.name === 'default');
  const rawValue = variables[varName];

  // Var not found and no `default` fallback → leave placeholder intact
  if (rawValue === undefined && !hasDefault) return null;

  // Apply transform chain left-to-right; start with raw value or '' (for default chain)
  let value = rawValue ?? '';
  for (const t of transformCalls) {
    const fn = getTransform(t.name);
    if (fn) {
      value = fn(value, ...t.args);
    }
  }

  return value;
}
