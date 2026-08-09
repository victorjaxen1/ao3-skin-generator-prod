import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { buildMasterWorkSkin } from '../src/lib/workSkin';
import { defaultProject } from '../src/lib/schema';

/**
 * The BACKLOG §11 check, automated.
 *
 * On 7 Aug 2026 a saved iOS skin came back from AO3 **missing eleven
 * consecutive rules** — the bubble tails, both `.time` rules, `.reaction`,
 * `.status-indicator`, `.attach` and the typing row — while everything before
 * and after survived. The cause was never established. Since then the rule has
 * been: anything that touches `buildCSS` is not verified by our own tests. It
 * is verified by **saving the skin on real AO3, reading the stored CSS back,
 * and diffing it rule by rule.**
 *
 * That had been done by hand three times before this existed. This is the same
 * comparison, so the fourth time costs a command instead of an afternoon.
 *
 * ## How to use it
 *
 * 1. In the app, open the work skin modal, choose **All four platforms**, and
 *    copy the CSS.
 * 2. On AO3: Preferences → Skins → Create Work Skin. Paste, title it, submit.
 * 3. Reopen the skin on AO3 and copy what is now in the CSS box — AO3 stores a
 *    *cleaned, pretty-printed* copy, so this is a direct readout of what
 *    survived its sanitizer.
 * 4. Save that next to this repo as `ao3 master workskin <anything>.txt`.
 * 5. `npx playwright test --project=unit -g "AO3 readback"`
 *
 * With no such file the test skips — it cannot run in CI, because it needs a
 * human to have talked to the archive.
 *
 * ## What it does and does not prove
 *
 * Selectors and rule/declaration counts are structural: they do not depend on
 * the project the skin was exported from, so they can be compared exactly.
 * **Values are not compared** — those follow the author's settings, and the
 * readback comes from whatever project happened to be open. A value silently
 * rewritten by AO3 would not be caught here; a rule or property *dropped* is,
 * and that is the failure mode with a history.
 */

const ROOT = join(__dirname, '..');
const CANARIES = [
  // The eleven that vanished on 7 Aug 2026, plus the neighbours that share
  // their fate if it recurs. Named individually so a silent recurrence cannot
  // hide inside a matching total.
  'bubble-tail', '.time', '.reaction', 'has-reaction', '.status-indicator',
  '.attach', 'typing', 'check-icon', 'group-sender', 'message-image',
];

type Rule = { selector: string; props: string[] };

function parse(css: string): Rule[] {
  const rules: Rule[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  while ((m = re.exec(noComments))) {
    // AO3 pretty-prints grouped selectors as "a, b"; we emit "a,b".
    const selector = m[1].replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
    if (!selector) continue;
    const props = m[2]
      .split(';')
      .map(d => d.trim())
      .filter(Boolean)
      .map(d => d.split(':')[0].trim());
    rules.push({ selector, props });
  }
  return rules;
}

function newestReadback(): string | null {
  const matches = readdirSync(ROOT)
    .filter(f => /^ao3 master workskin.*\.txt$/i.test(f))
    .map(f => ({ f, mtime: statSync(join(ROOT, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return matches.length ? join(ROOT, matches[0].f) : null;
}

test('AO3 readback — the archive stored every rule we sent', () => {
  const path = newestReadback();
  test.skip(!path, 'No "ao3 master workskin*.txt" readback present — see this file’s header.');

  console.log(`  [MEASURE] readback: ${path!.replace(ROOT, '.')}`);
  const stored = parse(readFileSync(path!, 'utf-8'));
  const ours = parse(buildMasterWorkSkin({ ...defaultProject(), template: 'ios' }).css);

  const props = (rs: Rule[]) => rs.reduce((n, r) => n + r.props.length, 0);
  console.log(`  [MEASURE] rules        sent ${ours.length}  stored ${stored.length}`);
  console.log(`  [MEASURE] declarations sent ${props(ours)}  stored ${props(stored)}`);

  const tally = (rs: Rule[]) => {
    const m = new Map<string, number>();
    for (const r of rs) m.set(r.selector, (m.get(r.selector) || 0) + 1);
    return m;
  };
  const storedSel = tally(stored);
  const ourSel = tally(ours);

  const dropped = [...ourSel].filter(([s, n]) => (storedSel.get(s) || 0) < n).map(([s]) => s);
  expect(dropped, `AO3 did not store ${dropped.length} selector(s) we sent`).toEqual([]);

  // Per-rule property check, so a rule that survives with a property missing
  // still fails. Compared by name only — see the header on values.
  const storedBySel = new Map(stored.map(r => [r.selector, r]));
  const lostProps: string[] = [];
  for (const r of ours) {
    const s = storedBySel.get(r.selector);
    if (!s) continue;
    for (const p of r.props) {
      if (!s.props.includes(p)) lostProps.push(`${r.selector} { ${p} }`);
    }
  }
  expect(lostProps, `AO3 dropped ${lostProps.length} declaration(s)`).toEqual([]);

  for (const c of CANARIES) {
    const n = stored.filter(r => r.selector.includes(c)).length;
    console.log(`  [MEASURE] canary ${c.padEnd(18)} ${n} rule(s) stored`);
    expect(n, `canary "${c}" is absent from the stored skin`).toBeGreaterThan(0);
  }

  expect(stored.length).toBe(ours.length);
  expect(props(stored)).toBe(props(ours));
});
