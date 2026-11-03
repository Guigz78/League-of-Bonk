// Connexion : bande en haut de l'accueil (web), fiche e-mail, redirection Google ; app iOS simulée (Capacitor factice :
// Browser.open, App.appUrlOpen) avec les réponses de Supabase interceptées → session, compte affiché, synchronisation.
import { chromium, devices } from 'playwright';
import fs from 'fs';
const OUT = process.env.OUT; fs.mkdirSync(OUT, { recursive: true });
const VP = process.env.VP || '13';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const dev = VP === 'se' ? { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } } : { ...devices['iPhone 13'] };
const wait = (p, ms) => p.waitForTimeout(ms);
const errs = [];
const SB = 'https://bplagnxryyxqwumhrxco.supabase.co';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = b64({ alg: 'HS256', typ: 'JWT' }) + '.' + b64({ sub: 'u-123', email: 'joueur@exemple.fr', exp: Math.floor(Date.now() / 1000) + 3600, role: 'authenticated', aud: 'authenticated' }) + '.sig';
const SESSION = { access_token: jwt, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r-123',
  user: { id: 'u-123', aud: 'authenticated', role: 'authenticated', email: 'joueur@exemple.fr', app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Joueur Test', avatar_url: '' }, created_at: new Date().toISOString() } };
const seen = [];
async function setup(ctx) {
  await ctx.route(`${SB}/**`, async route => {
    const r = route.request(), u = r.url();
    seen.push(r.method() + ' ' + u.replace(SB, '').slice(0, 70));
    if (u.includes('/auth/v1/otp')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (u.includes('/auth/v1/token')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION) });
    if (u.includes('/auth/v1/user')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SESSION.user) });
    if (u.includes('/auth/v1/authorize')) return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Google (factice)</h1>' });
    if (u.includes('/rest/v1/lob_saves')) return route.fulfill({ status: r.method() === 'GET' ? 200 : 201, contentType: 'application/json', body: r.method() === 'GET' ? '[]' : '' });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
}
async function open(native) {
  const ctx = await b.newContext(dev); await setup(ctx);
  if (native) await ctx.addInitScript(() => {
    const listeners = {};
    window.__opened = [];
    window.Capacitor = { isNativePlatform: () => true, Plugins: {
      Haptics: { impact: async () => {} },
      Browser: { open: async o => { window.__opened.push(o.url); }, close: async () => {} },
      App: { addListener: (ev, fn) => { (listeners[ev] ||= []).push(fn); return { remove() {} }; } },
    } };
    window.__appUrl = url => (listeners.appUrlOpen || []).forEach(f => f({ url }));
  });
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(`http://localhost:${process.env.PORT || 8765}/`);
  await p.evaluate(async () => { localStorage.clear(); const S = await import('/js/save.js'); S.save.cls = 'archer'; S.save.tutorialDone = true; S.save.stats.runs = 6; S.save.zoneCleared[0] = true; S.save.unlockedZone = 1; S.persist(); });
  await p.reload(); await wait(p, 2500);
  for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(p, 500); }
  return { ctx, p };
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${VP}-${n}.png` });

// ---------- web ----------
{
  const { ctx, p } = await open(false);
  await shot(p, '01-accueil-bande');
  console.log('bande :', await p.evaluate(() => document.querySelector('.login-strip')?.innerText.replace(/\s+/g, ' ')),
    '| accueil déborde :', await p.evaluate(() => { const m = document.querySelector('.hub-main'); return m.scrollHeight > m.clientHeight + 2; }));
  // × : cachée 3 jours, même après rechargement
  await p.click('[data-act=hideStrip]', { force: true }); await wait(p, 300);
  await p.reload(); await wait(p, 2500);
  for (let i = 0; i < 4; i++) { const m = await p.$('.modal-wrap'); if (!m) break; await p.evaluate(() => document.querySelector('.modal-wrap .btn.ghost, .modal-wrap .btn')?.click()); await wait(p, 500); }
  console.log('après × et rechargement : bande', !!(await p.$('.login-strip')));
  await p.evaluate(() => localStorage.removeItem('lob_login_hide')); await p.evaluate(() => document.querySelector('[data-act=tab][data-tab=adventure]').click()); await wait(p, 700);
  // e-mail
  await p.click('.login-strip [data-act=signIn]', { force: true }); await wait(p, 700);
  await shot(p, '02-fiche-connexion');
  await p.fill('.si-mail', 'pas-un-mail'); await p.click('[data-v=mail]', { force: true }); await wait(p, 300);
  console.log('e-mail invalide :', await p.evaluate(() => document.querySelector('.si-msg').innerText));
  await p.fill('.si-mail', 'joueur@exemple.fr'); await p.click('[data-v=mail]', { force: true }); await wait(p, 1200);
  console.log('e-mail valide :', await p.evaluate(() => document.querySelector('.si-msg').innerText));
  await shot(p, '03-lien-envoye');
  await p.evaluate(() => document.querySelector('.modal-wrap .modal-btns .btn').click()); await wait(p, 500);
  // Google : redirection vers Supabase avec le bon retour
  const nav = p.waitForURL(/auth\/v1\/authorize/, { timeout: 10000 }).catch(() => null);
  await p.click('.login-strip [data-act=signGoogle]', { force: true }); await nav;
  const url = new URL(p.url());
  console.log('Google (web) :', url.pathname, 'provider', url.searchParams.get('provider'), 'retour', url.searchParams.get('redirect_to'));
  await ctx.close();
}
// ---------- app iOS simulée ----------
{
  const { ctx, p } = await open(true);
  console.log('app : classe native', await p.evaluate(() => document.documentElement.classList.contains('native')), '| connexion dispo', await p.evaluate(async () => (await import('/js/cloud.js')).cloud.available));
  await shot(p, '04-app-accueil');
  await p.click('.login-strip [data-act=signGoogle]', { force: true }); await wait(p, 1500);
  const opened = await p.evaluate(() => window.__opened[0] || '');
  const u = opened ? new URL(opened) : null;
  console.log('app Google : fenêtre ouverte', !!u, '| provider', u?.searchParams.get('provider'), '| retour', u?.searchParams.get('redirect_to'), '| PKCE', !!u?.searchParams.get('code_challenge'));
  // retour de Google par le lien de l'app
  await p.evaluate(() => window.__appUrl('com.guigz78.leagueofbonk://login?code=abc123')); await wait(p, 2500);
  console.log('app après retour :', await p.evaluate(async () => { const { cloud } = await import('/js/cloud.js'); return JSON.stringify({ user: cloud.user?.name, email: cloud.user?.email, status: cloud.status }); }),
    '| bande', !!(await p.$('.login-strip')), '| bouton compte connecté', !!(await p.$('.icon-btn.account.in')));
  await shot(p, '05-app-connecte');
  await p.click('[data-act=account]', { force: true }); await wait(p, 800); await shot(p, '06-app-compte');
  console.log('compte :', await p.evaluate(() => document.querySelector('.account-modal')?.innerText.replace(/\s+/g, ' ').slice(0, 160)));
  await ctx.close();
}
console.log('requêtes Supabase :', [...new Set(seen)].join(' | '));
console.log(errs.length ? errs.join('\n') : 'no errors'); await b.close();
