// Bundles the web app for the native shell: local assets only, no license gate, no service worker.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const out = 'www';
rmSync(out, { recursive: true, force: true }); mkdirSync(out);
for (const f of ['index.html', 'style.css', 'app.js', 'logic.js', 'store.js', 'notify.js', 'config.js', 'manifest.webmanifest', 'privacy.html']) cpSync(f, `${out}/${f}`);
cpSync('icons', `${out}/icons`, { recursive: true });
// Native build: purchase handled by the App Store, so no license gate and no external purchase links.
const ver = (readFileSync('config.js', 'utf8').match(/APP_VERSION = '(.*?)'/) || [])[1] || '1.0.0';
writeFileSync(`${out}/config.js`, `export const LICENSE_PRODUCT_ID = '';\nexport const LICENSE_VERIFY_URL = '';\nexport const BUY_URL = '';\nexport const APP_NAME = 'Restock';\nexport const APP_VERSION = '${ver}';\n`);
// Native privacy page: App Store purchase wording, no external purchase or support links.
let pv = readFileSync('privacy.html', 'utf8');
pv = pv.replace(/<h2>Purchase and license<\/h2>[\s\S]*?(?=<h2>Terms<\/h2>)/, '<h2>Purchase</h2>\n<p>Restock is a one-time purchase through the App Store. It does not expire and is not billed again.</p>\n\n');
pv = pv.replace(/<h2>Support<\/h2>[\s\S]*?<\/p>/, '');
if (/gumroad/i.test(pv)) throw new Error('native privacy page still mentions Gumroad');
writeFileSync(`${out}/privacy.html`, pv);
for (const f of ['index.html', 'app.js', 'logic.js', 'store.js', 'notify.js', 'config.js', 'manifest.webmanifest', 'privacy.html'])
  if (/gumroad/i.test(readFileSync(`${out}/${f}`, 'utf8'))) throw new Error(`native build: ${f} mentions Gumroad`);
console.log('www ready');
