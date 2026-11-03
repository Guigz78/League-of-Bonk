import { chromium } from 'playwright';
import fs from 'fs';
import { serve } from '../../tests/server.mjs';
const { port, close } = await serve(0);
const b = await chromium.launch(); const p = await b.newPage();
await p.goto(`http://localhost:${port}/`);
const r = await p.evaluate(async () => {
  const S = await import('/js/story.js'), D = await import('/js/data.js'), out = [];
  S.STORY.chapters.forEach((c, n) => {
    const boss = c.giga ? 'gorgoth' : 'boss' + c.zone;
    for (const part of ['intro', 'outro', 'epilogue']) (c[part] || []).forEach((l, i) => {
      const [k, t, mood] = l;
      const who = k === 'h' ? 'hero' : k === 'p' ? 'pompon' : k === 'n' ? 'narr' : k === 'g' ? 'gorgoth' : k === 'm' ? 'garde' + c.zone : boss;
      out.push({ id: `${c.id}-${part}-${i}`, k, who, t, mood: mood || '' });
    });
    if (c.taunt) out.push({ id: `${c.id}-taunt`, k: 'b', who: boss, t: c.taunt, mood: 'angry' });
    if (c.end) out.push({ id: `${c.id}-end`, k: 'n', who: 'narr', t: c.end, mood: '' });
  });
  const bosses = D.ZONES.map((z, i) => ({ i, name: z.boss?.name, body: z.boss?.body, garde: z.monsters[4]?.name, zone: z.name }));
  return { lines: out, bosses };
});
fs.writeFileSync(new URL('./lines.json', import.meta.url), JSON.stringify(r, null, 1));
const g = {}; for (const l of r.lines) { g[l.who] ||= { n: 0, c: 0 }; g[l.who].n++; g[l.who].c += l.t.length; }
console.log(JSON.stringify(g)); console.log(JSON.stringify(r.bosses));
await b.close(); close();
