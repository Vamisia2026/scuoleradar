/**
 * Guardia FAVICON ufficiale — la scheda del browser deve mostrare la TESSERA
 * AZZURRA con il radar bianco (grafica originale), mai un asset temporaneo,
 * scuro o "compresso" che sgrana l'identità visiva di ScuoleRadar.it.
 *
 * Verifiche (zero dipendenze: PNG decodificato con `node:zlib`):
 *  1. `index.html` dichiara ESATTAMENTE il set ufficiale (16/32/48/256 px +
 *     `favicon.ico` + `apple-touch-icon.png`) e NESSUN asset legacy/scuro;
 *  2. ogni href esiste in `public/` ed è un PNG valido della misura dichiarata;
 *  3. `public/favicon.ico` è un contenitore multi-misura 16/32/48 con payload PNG;
 *  4. ogni favicon è la TESSERA (campo azzurro dominante) e NON il logo intero
 *     schiacciato; il file da 256 px è a pieno formato (nessun bordo trasparente);
 *  5. `apple-touch-icon.png` è 180×180 e OPACO (iOS non applica sfondo nero);
 *  6. peso: nessuna favicon oltre 60 KB e nessun file in `public/` oltre 1 MB;
 *  7. `public/` non contiene più gli asset della vecchia identità scura.
 *
 * Uso: npm run test:favicon   (rigenerare il set: npm run favicon)
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { decodificaPng, u16le, u32le, u32be, type Immagine } from './lib/pngRgba.ts';

/** Set ufficiale dichiarato in `index.html`. */
const FAVICON_PNG = [16, 32, 48, 256];
const APPLE = { misura: 180, file: 'apple-touch-icon.png' };
const ICO = 'favicon.ico';
/** Misure contenute nel contenitore `.ico` (tab dei browser + fallback legacy). */
const ICO_MISURE = [16, 32, 48];
/** Asset della vecchia identità (scuri/legacy): MAI nel sito servito. */
const VIETATI = [
  'ScuoleRadar Favicon Square.png',
  'ScuoleRadar Logo Transparent Full Final.png',
  'favicon_old.svg',
  'logo_old.png',
];
/** Azzurro del marchio campionato dal logo originale (public/logo.png). */
const AZZURRO = { r: 43, g: 111, b: 158 };
const TOLLERANZA_AZZURRO = 30;
const LIMITE_FAVICON = 60 * 1024;
const LIMITE_PUBLIC = 1024 * 1024;

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

const html = readFileSync('index.html', 'utf8');
const leggi = (file: string): Uint8Array => readFileSync(`public/${file}`);

/** Colore dominante fra i pixel opachi (campo della tessera). */
function coloreDominante(img: Immagine): { r: number; g: number; b: number } {
  const istogramma = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i < img.pixel.length; i += 4) {
    if (img.pixel[i + 3] < 250) continue;
    const chiave = `${img.pixel[i] >> 4}-${img.pixel[i + 1] >> 4}-${img.pixel[i + 2] >> 4}`;
    const voce = istogramma.get(chiave) ?? { n: 0, r: 0, g: 0, b: 0 };
    voce.n += 1;
    voce.r += img.pixel[i];
    voce.g += img.pixel[i + 1];
    voce.b += img.pixel[i + 2];
    istogramma.set(chiave, voce);
  }
  let migliore: { n: number; r: number; g: number; b: number } | null = null;
  for (const voce of istogramma.values()) if (!migliore || voce.n > migliore.n) migliore = voce;
  if (!migliore) return { r: -1, g: -1, b: -1 };
  return {
    r: Math.round(migliore.r / migliore.n),
    g: Math.round(migliore.g / migliore.n),
    b: Math.round(migliore.b / migliore.n),
  };
}

/**
 * Quota di pixel VISIBILI chiaramente più chiari del campo azzurro: è la firma
 * del radar bianco. L'azzurro del marchio ha canale minimo ≈43; sopra la soglia
 * (default 70) resta solo il segno del radar, anche quando il downscaling lo
 * ammorbidisce (16-32 px). Misurato: 16px 4,7% · 32px 9,4% · 48px 10% · 256px 6,3%.
 */
function quotaMarchio(img: Immagine, soglia = 70): number {
  let visibili = 0;
  let chiari = 0;
  for (let i = 0; i < img.pixel.length; i += 4) {
    if (img.pixel[i + 3] < 128) continue;
    visibili += 1;
    const minimo = Math.min(img.pixel[i], img.pixel[i + 1], img.pixel[i + 2]);
    if (minimo > soglia) chiari += 1;
  }
  return visibili === 0 ? 0 : chiari / visibili;
}

/** Riquadro dei pixel opachi (per il controllo "pieno formato"). */
function riquadroOpachi(img: Immagine): { sinistra: number; sopra: number; destra: number; sotto: number } {
  let sinistra = img.larghezza;
  let sopra = img.altezza;
  let destra = -1;
  let sotto = -1;
  for (let y = 0; y < img.altezza; y += 1) {
    for (let x = 0; x < img.larghezza; x += 1) {
      if (img.pixel[(y * img.larghezza + x) * 4 + 3] < 250) continue;
      if (x < sinistra) sinistra = x;
      if (x > destra) destra = x;
      if (y < sopra) sopra = y;
      if (y > sotto) sotto = y;
    }
  }
  return { sinistra, sopra, destra, sotto };
}

const misurePngIn = (dati: Uint8Array): { larghezza: number; altezza: number } | null => {
  if (dati.length < 24 || u32be(dati, 0) !== 0x89504e47) return null;
  return { larghezza: u32be(dati, 16), altezza: u32be(dati, 20) };
};

console.log('— 1. index.html: set ufficiale dichiarato —');
check(
  'nessun asset legacy/scuro referenziato',
  [],
  html.match(/[^"'\s]*(Favicon Square|FaviconSquare|Transparent Full Final|favicon_old|logo_old)[^"'\s]*/g) ?? [],
);
for (const misura of FAVICON_PNG) {
  check(
    `favicon-${misura}.png dichiarata (sizes="${misura}x${misura}")`,
    true,
    html.includes(`rel="icon" type="image/png" sizes="${misura}x${misura}" href="/favicon-${misura}.png"`),
  );
}
check(
  'apple-touch-icon dichiarata (180x180)',
  true,
  /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/.test(html),
);
check('favicon.ico dichiarata (shortcut icon)', true, /rel="shortcut icon" href="\/favicon\.ico"/.test(html));
check('nessun link icon senza misura', FAVICON_PNG.length, (html.match(/rel="icon"/g) ?? []).length);
check('theme-color = azzurro del marchio', true, /name="theme-color" content="#2B6F9E"/.test(html));

console.log('\n— 2. public/: file e misure reali —');
for (const misura of FAVICON_PNG) {
  const file = `favicon-${misura}.png`;
  const esiste = existsSync(`public/${file}`);
  check(`${file} esiste`, true, esiste);
  if (!esiste) continue;
  const dati = leggi(file);
  const misure = misurePngIn(dati);
  check(`${file} è un PNG ${misura}×${misura}`, true, misure?.larghezza === misura && misure?.altezza === misura);
  check(`${file} leggero (<60 KB)`, true, dati.length <= LIMITE_FAVICON);
}
check(`${APPLE.file} esiste`, true, existsSync(`public/${APPLE.file}`));
console.log('\n— 3. favicon.ico: contenitore multi-misura —');
check(`${ICO} esiste`, true, existsSync(`public/${ICO}`));
if (existsSync(`public/${ICO}`)) {
  const ico = leggi(ICO);
  check('intestazione ICO (riservato=0, tipo=1)', '0/1', `${u16le(ico, 0)}/${u16le(ico, 2)}`);
  check('numero di voci ICO', ICO_MISURE.length, u16le(ico, 4));
  for (let i = 0; i < ICO_MISURE.length; i += 1) {
    const base = 6 + i * 16;
    const lato = ico[base] || 256;
    const lunghezza = u32le(ico, base + 8);
    const offset = u32le(ico, base + 12);
    const misure = misurePngIn(ico.subarray(offset, offset + lunghezza));
    check(
      `voce ICO ${i} = PNG ${ICO_MISURE[i]}px`,
      { lato: ICO_MISURE[i], png: true },
      { lato, png: misure?.larghezza === lato && misure?.altezza === lato },
    );
  }
}

console.log('\n— 4. identità visiva: tessera azzurra + radar bianco —');
for (const misura of FAVICON_PNG) {
  const img = decodificaPng(leggi(`favicon-${misura}.png`));
  if (!img) {
    check(`favicon-${misura}.png decodificabile`, true, false);
    continue;
  }
  const colore = coloreDominante(img);
  const distanza =
    Math.abs(colore.r - AZZURRO.r) + Math.abs(colore.g - AZZURRO.g) + Math.abs(colore.b - AZZURRO.b);
  check(
    `favicon-${misura}.png: campo azzurro (rgb ${AZZURRO.r},${AZZURRO.g},${AZZURRO.b})`,
    true,
    distanza <= TOLLERANZA_AZZURRO * 3,
  );
  check(`favicon-${misura}.png: radar bianco presente (>2% di pixel chiari)`, true, quotaMarchio(img) > 0.02);
}
const grande = decodificaPng(leggi('favicon-256.png'));
if (grande) {
  const riquadro = riquadroOpachi(grande);
  check(
    'favicon-256.png a pieno formato (nessun bordo trasparente)',
    true,
    riquadro.sinistra <= 2 && riquadro.sopra <= 2 && riquadro.destra >= 253 && riquadro.sotto >= 253,
  );
  check('favicon-256.png: bianco pieno nel cuore del radar', true, quotaMarchio(grande, 200) > 0.002);
}
const apple = decodificaPng(leggi(APPLE.file));
check(
  `${APPLE.file} = ${APPLE.misura}×${APPLE.misura}`,
  true,
  apple?.larghezza === APPLE.misura && apple?.altezza === APPLE.misura,
);
if (apple) {
  let trasparenti = 0;
  for (let i = 3; i < apple.pixel.length; i += 4) if (apple.pixel[i] < 255) trasparenti += 1;
  check(`${APPLE.file} opaco (0 pixel trasparenti)`, 0, trasparenti);
}

console.log('\n— 5. public/: igiene e fonte ufficiale —');
const vociPublic = readdirSync('public', { withFileTypes: true })
  .filter((voce) => voce.isFile())
  .map((voce) => voce.name);
check('nessun asset della vecchia identità scura', [], VIETATI.filter((nome) => vociPublic.includes(nome)));
check(
  'nessun file in public/ oltre 1 MB',
  [],
  vociPublic.filter((nome) => statSync(`public/${nome}`).size > LIMITE_PUBLIC),
);
const sorgente = existsSync('public/logo.png') ? misurePngIn(leggi('logo.png')) : null;
check('public/logo.png (fonte ufficiale) = 882×212', true, sorgente?.larghezza === 882 && sorgente?.altezza === 212);
check(
  'set completo servito dalla radice',
  FAVICON_PNG.map((m) => `favicon-${m}.png`).concat(ICO, APPLE.file).sort(),
  FAVICON_PNG.map((m) => `favicon-${m}.png`)
    .filter((file) => existsSync(`public/${file}`))
    .concat(ICO, APPLE.file)
    .sort(),
);

console.log(errori === 0 ? '\n✅ FAVICON: nessun problema' : `\n❌ FAVICON: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;


