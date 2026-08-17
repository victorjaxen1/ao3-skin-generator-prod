import { test, expect } from '@playwright/test';
import {
  CHARACTER_TARGETS,
  FontCharacter,
  KNOWN_FACES,
  classifyFont,
  describeFontMatch,
  parseFontStack,
  stackDisplayName,
} from '../src/lib/siteSkin/fontClassify';
import { FONT_STACKS, FontRole, fontStacksFor, validateTheme } from '../src/lib/siteSkin/theme';
import { TEMPLATES, cloneTheme } from '../src/lib/siteSkin/templates';

/**
 * The classifier's contract.
 *
 * The load-bearing test here is the storage round-trip: every stack this file
 * can ever emit must survive `validateTheme`, which accepts a font only if the
 * string is a member of `FONT_STACKS`. The bank is append-only and grows, so a
 * target written as a near-miss string — a stray quote, an old spelling — is not
 * a compile error and not a runtime error. It is a font the user chooses, sees
 * applied, and loses on reload. Everything else in this file is cheaper than
 * that one.
 */

const ROLES: readonly FontRole[] = ['heading', 'body'];
const CHARACTERS = Object.keys(CHARACTER_TARGETS) as FontCharacter[];

test.describe('every target is a real, role-legal member of the bank', () => {
  for (const character of CHARACTERS) {
    for (const role of ROLES) {
      test(`${character} → a ${role} stack that exists`, () => {
        const value = CHARACTER_TARGETS[character][role];
        expect(FONT_STACKS.some(f => f.value === value)).toBe(true);
        expect(fontStacksFor(role).some(f => f.value === value)).toBe(true);
      });
    }
  }

  test('a display or script target is never offered for body text', () => {
    for (const character of CHARACTERS) {
      const body = FONT_STACKS.find(f => f.value === CHARACTER_TARGETS[character].body)!;
      expect(body.roles).toContain('body');
      expect(['display', 'script']).not.toContain(body.group);
    }
  });
});

test('every known face classifies, for both roles, to something storage keeps', () => {
  const base = cloneTheme(TEMPLATES[0]);
  for (const name of Object.keys(KNOWN_FACES)) {
    for (const role of ROLES) {
      const match = classifyFont(name, role);
      expect(match, name).not.toBeNull();

      // The real check: through the storage boundary and back out unchanged.
      const theme = {
        ...base,
        typography: {
          ...base.typography,
          headingFont: role === 'heading' ? match!.stack : base.typography.headingFont,
          bodyFont: role === 'body' ? match!.stack : base.typography.bodyFont,
        },
      };
      const stored = validateTheme(JSON.parse(JSON.stringify(theme)), base);
      const kept = role === 'heading' ? stored.typography.headingFont : stored.typography.bodyFont;
      expect(kept, `${name} (${role})`).toBe(match!.stack);
    }
  }
});

test.describe('the judgements', () => {
  const cases: Array<[string, string, string]> = [
    // source stack, expected character, a word from the stack we should land on
    ['Poppins, sans-serif', 'geometric', 'Futura'],
    ['Inter, system-ui, sans-serif', 'neo-grotesque', 'Arial'],
    ['"GT Sectra", Georgia, serif', 'transitional', 'Baskerville'],
    ['"EB Garamond", Garamond, serif', 'old-style', 'Garamond'],
    ["'Playfair Display', serif", 'didone', 'Didot'],
    ['"Roboto Slab", Georgia, serif', 'slab', 'Rockwell'],
    ['Bebas Neue, Impact, sans-serif', 'poster', 'Impact'],
    ['"JetBrains Mono", monospace', 'code', 'Consolas'],
    ['"Open Sans", Arial, sans-serif', 'humanist', 'Gill Sans'],
    ['"Dancing Script", cursive', 'handwriting', 'Segoe Script'],
  ];

  for (const [declaration, character, expected] of cases) {
    test(declaration, () => {
      const match = classifyFont(declaration, 'heading');
      expect(match).not.toBeNull();
      expect(match!.character).toBe(character);
      expect(stackDisplayName(match!.stack)).toContain(expected);
    });
  }

  test('the leftmost recognisable family wins — the rest is their fallback chain', () => {
    // Georgia is second, and is a face we know; Poppins is the one they chose.
    expect(classifyFont('Poppins, Georgia, serif', 'heading')!.character).toBe('geometric');
  });

  test('a face our own bank names is preferred over the nearest neighbour', () => {
    const match = classifyFont('Verdana, sans-serif', 'body')!;
    expect(match.exact).toBe(true);
    expect(match.stack).toBe('Verdana, Geneva, sans-serif');
  });

  test('an unknown family falls through to the generic, and says so', () => {
    const match = classifyFont('"Söhne Halbfett Kondensiert 9000", sans-serif', 'body')!;
    expect(match.fromGeneric).toBe(true);
    expect(match.matchedName).toBeNull();
    expect(match.group).toBe('sans');
  });

  test('nothing recognisable at all returns null, so the caller leaves the font alone', () => {
    expect(classifyFont('', 'body')).toBeNull();
    expect(classifyFont('inherit', 'body')).toBeNull();
    expect(classifyFont('var(--font-body)', 'body')).toBeNull();
    expect(classifyFont(undefined as unknown as string, 'body')).toBeNull();
  });
});

test.describe('a heading-only face still answers for body text', () => {
  // Sites do set Impact and Playfair on body copy. The bank refuses both there
  // (Phase A), and `validateTheme` would silently swap in the template's font —
  // so the classifier has to have picked a legal one itself.
  for (const declaration of ['Impact, sans-serif', 'Playfair Display, serif', 'Copperplate, sans-serif', 'Great Vibes, cursive', 'Rockwell, serif']) {
    test(declaration, () => {
      const match = classifyFont(declaration, 'body')!;
      expect(fontStacksFor('body').some(f => f.value === match.stack)).toBe(true);
    });
  }
});

test.describe('what we tell the user — §6d step 4', () => {
  test('a substitution names the source, the character and our answer', () => {
    const sentence = describeFontMatch(classifyFont('Poppins, sans-serif', 'heading')!);
    expect(sentence).toContain('Poppins');
    expect(sentence).toContain('geometric sans');
    expect(sentence).toContain('Futura');
  });

  test('it never promises the font itself — §2a, which is not negotiable', () => {
    for (const name of Object.keys(KNOWN_FACES)) {
      for (const role of ROLES) {
        const sentence = describeFontMatch(classifyFont(name, role)!);
        expect(sentence.toLowerCase()).not.toContain('match');
        expect(sentence.toLowerCase()).not.toContain('embed');
        expect(sentence).not.toContain('undefined');
        expect(sentence.trim().endsWith('.')).toBe(true);
      }
    }
  });

  test('the article agrees with the word after it', () => {
    // "a interface sans" turned up on a real site the first time this ran, and
    // it is the kind of slip that makes a reader trust the rest of the sentence
    // less than they should.
    expect(describeFontMatch(classifyFont('system-ui, sans-serif', 'body')!))
      .toContain('an interface sans');
    expect(describeFontMatch(classifyFont('Poppins, sans-serif', 'body')!))
      .toContain('a geometric sans');
    for (const name of Object.keys(KNOWN_FACES)) {
      expect(describeFontMatch(classifyFont(name, 'heading')!)).not.toMatch(/\ba [aeiou]/);
    }
  });

  test('an exact bank hit says the reader may actually see it', () => {
    const sentence = describeFontMatch(classifyFont('Georgia, serif', 'body')!);
    expect(sentence).toContain('Georgia');
    expect(sentence).toContain('AO3 allows it');
  });
});

test.describe('parsing somebody else\'s stylesheet', () => {
  test('quotes, case and whitespace', () => {
    expect(parseFontStack(`  "Times New Roman" ,  Times,   serif `)).toEqual([
      'times new roman',
      'times',
      'serif',
    ]);
  });

  test('custom properties are dropped, not classified', () => {
    expect(parseFontStack('var(--heading, Poppins), sans-serif')).toEqual(['sans-serif']);
  });

  test('CSS-wide keywords are not families', () => {
    expect(parseFontStack('inherit')).toEqual([]);
  });
});
