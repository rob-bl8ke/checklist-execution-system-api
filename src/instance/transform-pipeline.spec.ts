import { evaluate } from './transform-pipeline';

describe('transform-pipeline evaluate()', () => {
  // -------------------------------------------------------------------------
  // Plain variable (no transforms)
  // -------------------------------------------------------------------------
  describe('plain variable lookup', () => {
    it('returns the variable value when no transforms are applied', () => {
      expect(evaluate('service', { service: 'api' })).toBe('api');
    });

    it('returns null when variable is not in the map', () => {
      expect(evaluate('missing', {})).toBeNull();
    });

    it('returns null for empty expression', () => {
      expect(evaluate('', { service: 'api' })).toBeNull();
    });

    it('trims variable name whitespace', () => {
      expect(evaluate('  service  ', { service: 'api' })).toBe('api');
    });
  });

  // -------------------------------------------------------------------------
  // Single transform
  // -------------------------------------------------------------------------
  describe('single transform', () => {
    it('applies upper transform', () => {
      expect(evaluate('service | upper', { service: 'api' })).toBe('API');
    });

    it('applies lower transform', () => {
      expect(evaluate('name | lower', { name: 'WORLD' })).toBe('world');
    });

    it('applies trim transform', () => {
      expect(evaluate('val | trim', { val: '  hello  ' })).toBe('hello');
    });
  });

  // -------------------------------------------------------------------------
  // Chained transforms
  // -------------------------------------------------------------------------
  describe('chained transforms', () => {
    it('applies transforms left-to-right', () => {
      expect(evaluate('title | remove_spaces | lower', { title: 'My Service' })).toBe('myservice');
    });

    it('applies multiple case transforms in sequence', () => {
      expect(evaluate('v | upper | lower', { v: 'Hello' })).toBe('hello');
    });

    it('applies snake_case after trim', () => {
      expect(evaluate('v | trim | snake_case', { v: '  Hello World  ' })).toBe('hello_world');
    });
  });

  // -------------------------------------------------------------------------
  // Parameterized transforms
  // -------------------------------------------------------------------------
  describe('parameterized transforms', () => {
    it('applies replace with dot and underscore', () => {
      expect(evaluate('version | replace(".", "_")', { version: '1.2.3' })).toBe('1_2_3');
    });

    it('applies replace with single-quoted args', () => {
      expect(evaluate("version | replace('.', '_')", { version: '1.2.3' })).toBe('1_2_3');
    });

    it('applies truncate', () => {
      expect(evaluate('name | truncate(3)', { name: 'hello' })).toBe('hel');
    });

    it('applies pad_left with custom char', () => {
      expect(evaluate('val | pad_left(5, "0")', { val: '42' })).toBe('00042');
    });

    it('applies pad_right', () => {
      expect(evaluate('val | pad_right(5)', { val: 'hi' })).toBe('hi   ');
    });
  });

  // -------------------------------------------------------------------------
  // default transform
  // -------------------------------------------------------------------------
  describe('default transform', () => {
    it('returns fallback when variable is not in the map', () => {
      expect(evaluate('optional | default("N/A")', {})).toBe('N/A');
    });

    it('returns variable value when present (ignores default)', () => {
      expect(evaluate('optional | default("N/A")', { optional: 'present' })).toBe('present');
    });

    it('returns fallback when variable is empty string', () => {
      expect(evaluate('optional | default("N/A")', { optional: '' })).toBe('N/A');
    });

    it('can chain default with other transforms', () => {
      // missing variable → default("hello world") → upper → "HELLO WORLD"
      expect(evaluate('v | default("hello world") | upper', {})).toBe('HELLO WORLD');
    });

    it('allows default fallback containing a comma', () => {
      expect(evaluate('v | default("hello, world")', {})).toBe('hello, world');
    });
  });

  // -------------------------------------------------------------------------
  // Fail-safe behaviours
  // -------------------------------------------------------------------------
  describe('fail-safe / unknown transform', () => {
    it('returns null when transform is unknown', () => {
      expect(evaluate('service | nonexistent', { service: 'api' })).toBeNull();
    });

    it('returns null when second transform in chain is unknown', () => {
      expect(evaluate('service | upper | mystery', { service: 'api' })).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Quoted args containing special characters
  // -------------------------------------------------------------------------
  describe('quoted args with special characters', () => {
    it('handles double-quoted args containing a pipe character', () => {
      // arg is the literal string "a|b"
      expect(evaluate('v | replace("a|b", "X")', { v: 'prefix a|b suffix' })).toBe('prefix X suffix');
    });

    it('handles replace with empty replacement (deletion)', () => {
      expect(evaluate('v | replace("-", "")', { v: 'a-b-c' })).toBe('abc');
    });
  });

  // -------------------------------------------------------------------------
  // Complex real-world expressions
  // -------------------------------------------------------------------------
  describe('real-world expressions', () => {
    it('Deploy step: upper + replace', () => {
      expect(evaluate('service | upper', { service: 'api-server' })).toBe('API-SERVER');
    });

    it('Version normalization: replace dots with underscores', () => {
      expect(
        evaluate('version | replace(".", "_")', { version: '2.1.0' }),
      ).toBe('2_1_0');
    });

    it('Same variable with no pipe still resolves correctly', () => {
      expect(evaluate('service', { service: 'api' })).toBe('api');
    });
  });
});
