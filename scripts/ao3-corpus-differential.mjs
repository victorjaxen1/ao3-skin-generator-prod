import fs from 'node:fs'; import path from 'node:path';
const { sanitizeDeclarationValue, propertyAllowed } = await import('./ao3-sanitizer-oracle.mjs');
const { lintAo3Css, stripCssComments } = await import('../src/lib/siteSkin/ao3Css.ts');
const { AO3_PROPERTIES, AO3_SHORTHANDS } = await import('../src/lib/siteSkin/ao3Properties.ts');
const ctx = { properties: new Set(AO3_PROPERTIES), shorthands: [...AO3_SHORTHANDS], keywords: new Set(['!important','url']) };

const EX = process.argv[2]; const files=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);
 if(e.isDirectory())walk(p); else if(!/\.(png|jpe?g|gif|webp)$/i.test(e.name)&&!/^read\s*me/i.test(e.name))files.push(p);}})(EX);

// Collect every (property, value) pair in the corpus.
const decls = new Map();
for (const f of files) {
  let css = fs.readFileSync(f,'utf8'); if(!/[{}]/.test(css)) continue;
  css = stripCssComments(css);
  for (const m of css.matchAll(/\{([^{}]*)\}/g)) {
    for (const d of m[1].split(';')) {
      const i = d.indexOf(':'); if (i<1) continue;
      const p = d.slice(0,i).trim().toLowerCase(); const v = d.slice(i+1).trim();
      if (!p || !v || /[{}]/.test(p)) continue;
      const k = p+'\u0000'+v; if(!decls.has(k)) decls.set(k,{p,v,f:path.basename(path.dirname(f))});
    }
  }
}
console.log('distinct declarations in corpus:', decls.size);

// Our lint's verdict on a single declaration, isolated in a rule.
const ourVerdict = (p,v) => {
  const vio = lintAo3Css(`x { ${p}: ${v}; }`, 'site');
  return vio.filter(x=>x.kind!=='empty_rule').length===0;
};
const groups = new Map();
let stricter=0, looser=0, agree=0;
for (const {p,v,f} of decls.values()) {
  let ao3; try { ao3 = propertyAllowed(p,ctx) && sanitizeDeclarationValue(p,v,ctx)!==''; } catch { continue; }
  let ours; try { ours = ourVerdict(p,v); } catch { continue; }
  if (ao3===ours) { agree++; continue; }
  if (ao3 && !ours) stricter++; else looser++;
  const key = (ao3?'WE-ARE-STRICTER':'WE-ARE-LOOSER')+' | '+p;
  (groups.get(key) ?? groups.set(key,[]).get(key)).push({v,f});
}
console.log(`agree: ${agree}  WE-ARE-STRICTER (blocks legal CSS): ${stricter}  WE-ARE-LOOSER (false accept): ${looser}`);
console.log('\n=== DIVERGENCES ===');
[...groups.entries()].sort((a,b)=>b[1].length-a[1].length).slice(0,40).forEach(([k,arr])=>{
  console.log(`\n${k}  (${arr.length})`);
  arr.slice(0,3).forEach(x=>console.log('    ', JSON.stringify(x.v).slice(0,120), ' @'+x.f));
});
