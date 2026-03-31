import { getTransform } from './transform-registry';

describe('transform-registry', () => {
  describe('getTransform', () => {
    it('returns undefined for unknown transform names', () => {
      expect(getTransform('nonexistent')).toBeUndefined();
      expect(getTransform('')).toBeUndefined();
    });
  });

  describe('upper', () => {
    const fn = getTransform('upper')!;
    it('converts to uppercase', () => expect(fn('hello')).toBe('HELLO'));
    it('handles already-uppercase string', () => expect(fn('API')).toBe('API'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('lower', () => {
    const fn = getTransform('lower')!;
    it('converts to lowercase', () => expect(fn('HELLO')).toBe('hello'));
    it('handles mixed case', () => expect(fn('HeLLo WoRLd')).toBe('hello world'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('capitalize', () => {
    const fn = getTransform('capitalize')!;
    it('capitalizes first letter', () => expect(fn('hello')).toBe('Hello'));
    it('does not change remaining characters', () => expect(fn('hello WORLD')).toBe('Hello WORLD'));
    it('handles empty string', () => expect(fn('')).toBe(''));
    it('handles single character', () => expect(fn('a')).toBe('A'));
  });

  describe('title_case', () => {
    const fn = getTransform('title_case')!;
    it('capitalizes first letter of each word', () => expect(fn('hello world')).toBe('Hello World'));
    it('handles single word', () => expect(fn('hello')).toBe('Hello'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('trim', () => {
    const fn = getTransform('trim')!;
    it('removes leading and trailing whitespace', () => expect(fn('  hello  ')).toBe('hello'));
    it('handles string with no whitespace', () => expect(fn('hello')).toBe('hello'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('remove_spaces', () => {
    const fn = getTransform('remove_spaces')!;
    it('removes all whitespace', () => expect(fn('hello world')).toBe('helloworld'));
    it('removes multiple spaces', () => expect(fn('a  b   c')).toBe('abc'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('collapse_spaces', () => {
    const fn = getTransform('collapse_spaces')!;
    it('collapses multiple spaces to one', () => expect(fn('hello   world')).toBe('hello world'));
    it('trims leading and trailing spaces', () => expect(fn('  hello  world  ')).toBe('hello world'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('snake_case', () => {
    const fn = getTransform('snake_case')!;
    it('converts spaces to underscores and lowercases', () => expect(fn('Hello World')).toBe('hello_world'));
    it('handles single word', () => expect(fn('Hello')).toBe('hello'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('kebab_case', () => {
    const fn = getTransform('kebab_case')!;
    it('converts spaces to hyphens and lowercases', () => expect(fn('Hello World')).toBe('hello-world'));
    it('handles single word', () => expect(fn('Hello')).toBe('hello'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('camel_case', () => {
    const fn = getTransform('camel_case')!;
    it('converts to camelCase', () => expect(fn('Hello World')).toBe('helloWorld'));
    it('handles single word', () => expect(fn('hello')).toBe('hello'));
    it('lowercases first word', () => expect(fn('My Service Name')).toBe('myServiceName'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('pascal_case', () => {
    const fn = getTransform('pascal_case')!;
    it('converts to PascalCase', () => expect(fn('hello world')).toBe('HelloWorld'));
    it('handles single word', () => expect(fn('hello')).toBe('Hello'));
    it('handles multi-word phrase', () => expect(fn('my service name')).toBe('MyServiceName'));
    it('handles empty string', () => expect(fn('')).toBe(''));
  });

  describe('replace', () => {
    const fn = getTransform('replace')!;
    it('replaces all occurrences of search with replacement', () => expect(fn('a-b-c', '-', '_')).toBe('a_b_c'));
    it('replaces dots', () => expect(fn('1.2.3', '.', '_')).toBe('1_2_3'));
    it('handles no occurrences gracefully', () => expect(fn('hello', 'x', 'y')).toBe('hello'));
    it('handles empty replacement (deletion)', () => expect(fn('hello world', ' ', '')).toBe('helloworld'));
    it('handles empty string input', () => expect(fn('', '-', '_')).toBe(''));
  });

  describe('default', () => {
    const fn = getTransform('default')!;
    it('returns the value when non-empty', () => expect(fn('found', 'N/A')).toBe('found'));
    it('returns fallback when value is empty string', () => expect(fn('', 'N/A')).toBe('N/A'));
    it('returns empty string fallback when not provided', () => expect(fn('', undefined as unknown as string)).toBe(''));
  });

  describe('truncate', () => {
    const fn = getTransform('truncate')!;
    it('truncates to given length', () => expect(fn('hello world', '5')).toBe('hello'));
    it('returns full string when n exceeds length', () => expect(fn('hi', '10')).toBe('hi'));
    it('returns empty string when n is 0', () => expect(fn('hello', '0')).toBe(''));
    it('handles empty string', () => expect(fn('', '5')).toBe(''));
  });

  describe('pad_left', () => {
    const fn = getTransform('pad_left')!;
    it('pads string on the left with spaces by default', () => expect(fn('hi', '5')).toBe('   hi'));
    it('pads with custom character', () => expect(fn('hi', '5', '-')).toBe('---hi'));
    it('does not pad when string meets target length', () => expect(fn('hello', '5')).toBe('hello'));
    it('handles empty string', () => expect(fn('', '3', '*')).toBe('***'));
  });

  describe('pad_right', () => {
    const fn = getTransform('pad_right')!;
    it('pads string on the right with spaces by default', () => expect(fn('hi', '5')).toBe('hi   '));
    it('pads with custom character', () => expect(fn('hi', '5', '-')).toBe('hi---'));
    it('does not pad when string meets target length', () => expect(fn('hello', '5')).toBe('hello'));
    it('handles empty string', () => expect(fn('', '3', '*')).toBe('***'));
  });
});
