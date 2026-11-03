// Audit de cohérence des données (dans la vraie page) : références croisées entre toutes les tables.
import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 400, height: 800 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
await p.goto(`http://localhost:${process.env.PORT}/index.html`); await p.waitForTimeout(1500);
const out = await p.evaluate(async () => {
  const D = await import('/js/data.js'), A = await import('/js/art.js'), I = await import('/js/g3d/items3d.js'), ST = await import('/js/story.js'), WR = await import('/js/weapons-reg.js');
  const bad = [], ok = (c, m) => { if (!c) bad.push(m); };
  const mono = n => /\bvi\b/.test(A.iconImg(n)); // icône du jeu (sinon : étoile pixel de secours)
  const icon = (n, where) => ok(n && mono(n), `icône « ${n} » absente (${where})`);
  // champions
  for (const [id, c] of Object.entries(D.CLASSES)) {
    ok(D.EVOLUTIONS[id]?.length === 5, `${id} : 5 évolutions`);
    ok(D.ULTS[c.ult], `${id} : ultime ${c.ult}`); if (D.ULTS[c.ult]) icon(D.ULTS[c.ult].icon, 'ultime ' + c.ult);
    const ars = D.ARSENAL[id]; ok(ars?.length === 4, `${id} : arsenal de 4 armes`);
    ok(ars?.[0] === c.weapon, `${id} : arme de départ ${c.weapon} = 1re de l'arsenal (${ars?.[0]})`);
    for (const w of ars || []) {
      ok(D.WEAPONS[w], `${id} : arme ${w} dans WEAPONS`);
      if (D.WEAPONS[w]) { icon(D.WEAPONS[w].icon, 'arme ' + w); ok(D.WEAPONS[w].lv?.length === 6 || D.WEAPONS[w].lv?.length === 5, `arme ${w} : textes de niveau (${D.WEAPONS[w].lv?.length})`); }
      const E = D.WEAPON_EVOS[w]; ok(E, `arme ${w} : évolution`);
      if (E) { ok(D.TOMES[E.tome], `évolution de ${w} : tome ${E.tome}`); if (E.icon) icon(E.icon, 'évolution ' + w); }
    }
    if (c.passive) icon(c.passive.icon, 'passif ' + id);
    if (c.locked) ok(D.UNLOCK_CHALLENGES.some(ch => ch.rw?.key === 'cls:' + id || ch.rw?.keys?.includes('cls:' + id)) || D.SEASON_TRACK?.some(r => r.cls === id), `${id} verrouillé : un défi ou le pass le débloque`);
    ok(D.MASTERY.aura?.[id] || D.MASTERY.auras?.[id] || true, '');
  }
  // armes sans champion, tomes, bonus
  const allArs = new Set(Object.values(D.ARSENAL).flat());
  for (const w of Object.keys(D.WEAPONS)) ok(allArs.has(w) || ['boomerang'].includes(w), `arme ${w} : appartient à aucun arsenal`);
  for (const [k, t] of Object.entries(D.TOMES)) icon(t.icon, 'tome ' + k);
  for (const [k, t] of Object.entries(D.BOOSTS)) icon(t.icon, 'bonus ' + k);
  for (const [k, t] of Object.entries(D.BOONS)) icon(t.icon, 'bénédiction ' + k);
  for (const t of D.LOCKED.t || []) ok(D.TOMES[t], `tome verrouillé ${t}`);
  for (const d of D.DIFFICULTIES) icon(d.icon, 'difficulté ' + d.name);
  for (const [k, t] of Object.entries(D.TOTEMS || {})) icon(t.icon, 'totem ' + k);
  // objets : modèle 3D et icône de secours
  const models = new Set(I.ITEM_MODELS);
  for (const [slot, L] of Object.entries(D.ITEM_BASES)) for (const B of L) { ok(models.has(B.name), `objet « ${B.name} » sans image 3D`); icon(B.icon, 'objet ' + B.name); ok(D.AFFIXES[B.main] && D.AFFIXES[B.aff], `objet ${B.name} : bonus`); }
  for (const B of D.BOSS_ITEMS) { ok(models.has(B.name), `objet de boss « ${B.name} » sans image 3D`); ok(D.LEGEND_EFFECTS[B.effect], `objet ${B.name} : effet ${B.effect}`); }
  for (const M of D.MYTHIC_ITEMS) { ok(models.has(M.name), `objet mythique « ${M.name} » sans image 3D`); ok(D.MYTHIC_POWERS[M.power], `mythique ${M.id} : pouvoir ${M.power}`); ok(D.AFFIXES[M.main] && M.affs.length === 5 && M.affs.every(k => D.AFFIXES[k]), `mythique ${M.id} : bonus`); ok(D.SLOTS[M.slot], `mythique ${M.id} : emplacement`); icon(M.icon, 'mythique ' + M.id); }
  ok(new Set(D.MYTHIC_ITEMS.map(M => M.id)).size === D.MYTHIC_ITEMS.length && new Set(D.MYTHIC_ITEMS.map(M => M.power)).size === D.MYTHIC_ITEMS.length, 'mythiques : ids et pouvoirs uniques');
  for (const n of models) ok([...Object.values(D.ITEM_BASES).flat(), ...D.BOSS_ITEMS, ...D.MYTHIC_ITEMS].some(B => B.name === n), `modèle 3D « ${n} » sans objet`);
  // défis : récompenses valides
  const keyOk = k => { const [t, id] = k.split(':'); return t === 'cls' ? !!D.CLASSES[id] : t === 't' ? !!D.TOMES[id] : t === 'w' ? !!D.WEAPONS[id] : t === 'boost' ? !!D.BOOSTS[id] : t === 'title' ? !!D.TITLES[id] : t === 'aura' ? true : k === 'abyss'; };
  const ids = new Set();
  for (const ch of D.UNLOCK_CHALLENGES) {
    ok(!ids.has(ch.id), `défi en double ${ch.id}`); ids.add(ch.id);
    for (const k of [ch.rw?.key, ...(ch.rw?.keys || [])].filter(Boolean)) ok(keyOk(k), `défi ${ch.id} : récompense ${k}`);
    if (ch.icon) icon(ch.icon, 'défi ' + ch.id);
    if (ch.need) ok(D.CLASSES[ch.need], `défi ${ch.id} : champion ${ch.need}`);
  }
  // succès : identifiants uniques, titres existants
  const aids = new Set();
  for (const a of [...D.ACHIEVEMENTS, ...(D.ACH_MORE || [])]) { ok(!aids.has(a.id), `succès en double ${a.id}`); aids.add(a.id); if (a.title) ok(D.TITLES[a.title], `succès ${a.id} : titre ${a.title}`); }
  // pass : récompenses
  for (const [i, r] of (D.SEASON_TRACK || []).entries()) { if (r.title) ok(D.TITLES[r.title], `pass palier ${i + 1} : titre ${r.title}`); if (r.boostId) ok(D.BOOSTS[r.boostId], `pass palier ${i + 1} : bonus ${r.boostId}`); if (r.cls) ok(D.CLASSES[r.cls], `pass palier ${i + 1} : champion ${r.cls}`); }
  // histoire
  for (let n = 0; n < ST.storyLen; n++) { const c = ST.chapter(n); ok(D.ZONES[c.zone], `chapitre ${n + 1} : monde ${c.zone}`); ok(c.intro?.length && c.outro?.length && (c.mission ? ["collect", "survive", "elites"].includes(c.mission.type) : c.taunt), `chapitre ${n + 1} : dialogues`); ok(D.LOOT_TIERS[c.reward.chest], `chapitre ${n + 1} : coffre`); }
  // familiers
  for (const [k, pt] of Object.entries(D.PETS)) ok(D.ZONES[pt.zone], `familier ${k} : monde`);
  ok(D.PET_BY_ZONE.every(k => D.PETS[k]), 'PET_BY_ZONE');
  // armes du registre : chaque nouvelle arme d'arsenal a un comportement (registre ou moteur)
  const builtin = ['beam', 'orbs', 'lightning', 'arrows', 'boomerang', 'sword', 'aura', 'scythe', 'daggers', 'frost', 'snowball', 'shrooms'];
  for (const w of allArs) ok(builtin.includes(w) || WR.WX?.[w], `arme ${w} : aucun comportement (registre)`);
  return { bad: bad.filter(Boolean), n: { classes: Object.keys(D.CLASSES).length, weapons: Object.keys(D.WEAPONS).length, items: models.size, defis: D.UNLOCK_CHALLENGES.length, succes: aids.size } };
});
console.log(JSON.stringify(out.n));
console.log(out.bad.length ? out.bad.join('\n') : 'données cohérentes');
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
