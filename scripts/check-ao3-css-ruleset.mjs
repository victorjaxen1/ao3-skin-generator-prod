import fs from 'node:fs/promises';
import path from 'node:path';

const PINNED_COMMIT = 'cf1d7f997047eaca14370985dafd156a91696313';
const ref = process.argv[2] || PINNED_COMMIT;
const sourceUrl = `https://raw.githubusercontent.com/otwcode/otwarchive/${ref}/config/config.yml`;

function readYamlList(source, key) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex(line => line.trim() === `${key}:`);
  if (start < 0) throw new Error(`Could not find ${key} in upstream config.yml`);

  const values = [];
  for (const line of lines.slice(start + 1)) {
    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    if (!match) {
      if (/^[A-Z][A-Z0-9_]+:/.test(line.trim())) break;
      continue;
    }
    values.push(match[1].replace(/^['"]|['"]$/g, ''));
  }
  return values;
}

function readTsArray(source, exportName) {
  const match = source.match(
    new RegExp(`export const ${exportName}:[^=]*=\\s*\\[([\\s\\S]*?)\\];`)
  );
  if (!match) throw new Error(`Could not read ${exportName} from ao3Properties.ts`);
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1]);
}

function diff(local, upstream) {
  const localSet = new Set(local);
  const upstreamSet = new Set(upstream);
  return {
    missing: upstream.filter(value => !localSet.has(value)),
    extra: local.filter(value => !upstreamSet.has(value)),
  };
}

const localSource = await fs.readFile(
  path.join(process.cwd(), 'src', 'lib', 'siteSkin', 'ao3Properties.ts'),
  'utf8'
);
const response = await fetch(sourceUrl);
if (!response.ok) throw new Error(`Upstream request failed: ${response.status} ${response.statusText}`);
const upstreamSource = await response.text();

const comparisons = [
  ['properties', 'AO3_PROPERTIES', 'SUPPORTED_CSS_PROPERTIES'],
  ['shorthands', 'AO3_SHORTHANDS', 'SUPPORTED_CSS_SHORTHAND_PROPERTIES'],
];

let hasDrift = false;
for (const [label, localName, upstreamName] of comparisons) {
  const local = readTsArray(localSource, localName);
  const upstream = readYamlList(upstreamSource, upstreamName);
  const result = diff(local, upstream);
  hasDrift ||= result.missing.length > 0 || result.extra.length > 0;
  console.log(`${label}: local=${local.length} upstream=${upstream.length}`);
  console.log(`  missing locally: ${result.missing.length ? result.missing.join(', ') : 'none'}`);
  console.log(`  extra locally: ${result.extra.length ? result.extra.join(', ') : 'none'}`);
}

console.log(`Compared with otwcode/otwarchive ${ref}`);
if (hasDrift) {
  console.error('AO3 CSS ruleset drift detected. Review every difference before editing the vendored list.');
  process.exitCode = 1;
}
