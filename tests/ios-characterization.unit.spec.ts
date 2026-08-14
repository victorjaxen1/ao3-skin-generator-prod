import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { buildCSS, buildHTML } from '../src/lib/generator';
import { buildWorkSkin } from '../src/lib/workSkin';
import { IOS_CHARACTERIZATION_SCENES } from './_ios-fixtures';

/**
 * Phase 0 of `docs/IOS-IMESSAGE-PLATFORM-IMPROVEMENT-IMPLEMENTATION-PLAN.md`.
 *
 * A golden of what the shipped iOS renderer emits, taken *before* the renderer
 * was extracted from the shared `msgHTML` path. Its whole job is to make the
 * extraction provable: move the code, run this, and a clean pass means the
 * markup did not move with it.
 *
 * When a later phase changes iOS markup deliberately, refresh with:
 *
 *   IOS_CAPTURE=1 npx playwright test --project=unit tests/ios-characterization.unit.spec.ts
 *
 * and read the resulting git diff. That diff is the review — do not refresh to
 * make a red test green without reading it.
 */

const GOLDEN = path.join(__dirname, 'fixtures', 'ios-characterization.json');

type Golden = Record<string, { static: string; ao3: string; workSkinCss: string; violations: string[] }>;

function capture(): Golden {
  const golden: Golden = {};
  for (const scene of IOS_CHARACTERIZATION_SCENES) {
    const project = scene.project();
    const skin = buildWorkSkin(project);
    golden[scene.name] = {
      static: buildHTML(project, 'static'),
      ao3: buildHTML(project, 'ao3-work'),
      workSkinCss: skin.css,
      violations: skin.violations.map(violation => String(violation)),
    };
  }
  return golden;
}

test.describe('iOS renderer characterization', () => {
  test('current iOS markup, work-skin CSS, and lint verdict are unchanged', () => {
    const current = capture();
    if (process.env.IOS_CAPTURE === '1' || !fs.existsSync(GOLDEN)) {
      fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
      fs.writeFileSync(GOLDEN, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
      test.info().annotations.push({ type: 'golden', description: `wrote ${GOLDEN}` });
      return;
    }
    const golden = JSON.parse(fs.readFileSync(GOLDEN, 'utf8')) as Golden;
    for (const scene of IOS_CHARACTERIZATION_SCENES) {
      expect(current[scene.name].static, `${scene.name} static HTML`).toBe(golden[scene.name].static);
      expect(current[scene.name].ao3, `${scene.name} AO3 Work Text`).toBe(golden[scene.name].ao3);
      expect(current[scene.name].workSkinCss, `${scene.name} work-skin CSS`).toBe(golden[scene.name].workSkinCss);
      expect(current[scene.name].violations, `${scene.name} lint`).toEqual(golden[scene.name].violations);
    }
  });

  test('the load-bearing pieces of the current iOS contract are named, not just hashed', () => {
    // A golden tells you *that* something moved. These say what must not.
    const plain = buildHTML(IOS_CHARACTERIZATION_SCENES[0].project(), 'static');
    expect(plain).toContain('class="chat ios theme-light ios-frame-header"');
    expect(plain).toContain('<dl class="msg">');
    expect(plain).toContain('<dt class="visually-hidden">');
    expect(plain).toContain('bubble-tail');
    expect(plain).toContain('status-indicator');

    // SVG tails are for html2canvas only; AO3 removes <svg> with its contents,
    // so the work skin drops them and switches on the CSS tails instead (§7).
    const skin = buildWorkSkin(IOS_CHARACTERIZATION_SCENES[0].project());
    expect(skin.html).not.toContain('<svg');
    expect(skin.html).toContain('css-tails');
    expect(skin.violations).toEqual([]);
  });

  test('every characterized iOS scene lints clean in both skin modes', () => {
    for (const scene of IOS_CHARACTERIZATION_SCENES) {
      const project = scene.project();
      expect(buildWorkSkin(project).violations, scene.name).toEqual([]);
      expect(buildCSS(project)).toContain('#workskin');
    }
  });
});
