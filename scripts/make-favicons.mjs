/**
 * ScuoleRadar — Genera il set di FAVICON UFFICIALE dal logo originale.
 *
 * Fonte unica: `public/logo.png` (882×212) — la grafica originale azzurra/arancione/blu.
 * Da lì viene ritagliata SOLO la tessera quadrata (tile azzurra con il radar bianco),
 * mai il wordmark, e mai un asset temporaneo/scuro/compresso.
 *
 * Output (tutti in `public/`, serviti dalla radice del sito):
 *   favicon-16.png · favicon-32.png · favicon-48.png · favicon-256.png
 *   favicon.ico (contenitore multi-misura 16/32/48, payload PNG)
 *   apple-touch-icon.png (180×180, OPACO: iOS non applica lo sfondo nero)
 *
 * Uso:
 *   npm run favicon                          # rigenera e autoverifica (exit 1 se qualcosa non torna)
 *   node scripts/make-favicons.mjs --check   # solo verifica, non riscrive i file
 *
 * Nota: i colori NON vengono inventati — lo sfondo di `apple-touch-icon.png` è il
 * colore dominante campionato dai pixel della tessera originale.
 * Guardia di non-regressione sull'HTML: `npm run test:favicon`.
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';

const SORGENTE = 'public/logo.png';
const SOLO_VERIFICA = process.argv.includes('--check');

/** Misure (in px) del set ufficiale. */
const MISURE_PNG = [16, 32, 48];
const MISURA_GRANDE = 256;
const MISURA_APPLE = 180;
/** Soglie delle autoverifiche (differenza media per canale, 0–255). */
const SOGLIA_TESSERA = 1;
const SOGLIA_LOGO_INTERO = 15;

/** Errore bloccante: messaggio chiaro + exit code 1. */
function fallisci(messaggio) {
  console.error(`✗ ${messaggio}`);
  process.exit(1);
}

/** Differenza media per canale fra due buffer RGBA. */
function differenzaMedia(a, b) {
  if (a.length !== b.length) return Number.POSITIVE_INFINITY;
  let somma = 0;
  for (let i = 0; i < a.length; i += 1) somma += Math.abs(a[i] - b[i]);
  return somma / a.length;
}

/** Pixel grezzi RGBA a una data misura (per i confronti di provenienza). */
async function rgba(input, lato) {
  return sharp(input).resize(lato, lato, { fit: 'fill' }).ensureAlpha().raw().toBuffer();
}

/**
 * Ritaglia la tessera quadrata (marchio) dal logo originale.
 * Il logo è tessera + gap trasparente + wordmark: si prende il PRIMO blocco
 * contiguo di colonne opache, poi il bounding box verticale dello stesso blocco.
 */
async function estraiTessera(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const opaco = (x, y) => data[(y * width + x) * channels + 3] > 8;

  const colonnePiene = [];
  for (let x = 0; x < width; x += 1) {
    let piena = false;
    for (let y = 0; y < height && !piena; y += 1) piena = opaco(x, y);
    colonnePiene.push(piena);
  }

  const primoContenuto = colonnePiene.indexOf(true);
  if (primoContenuto < 0) fallisci(`${file}: nessun pixel opaco, impossibile estrarre la tessera`);
  const primoVuoto = colonnePiene.indexOf(false, primoContenuto);
  const fine = primoVuoto < 0 ? width : primoVuoto;
  const larghezza = fine - primoContenuto;

  let alto = height;
  let basso = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = primoContenuto; x < fine; x += 1) {
      if (opaco(x, y)) {
        if (y < alto) alto = y;
        if (y > basso) basso = y;
        break;
      }
    }
  }
  if (basso < alto) fallisci(`${file}: bounding box verticale non determinabile`);
  const altezza = basso - alto + 1;

  if (larghezza < 32 || altezza < 32) {
    fallisci(`${file}: tessera troppo piccola (${larghezza}×${altezza})`);
  }
  if (Math.abs(larghezza - altezza) > 4) {
    fallisci(
      `${file}: la tessera non è quadrata (${larghezza}×${altezza}) — ritaglio inaffidabile, ` +
        'verifica che il logo inizi con la tessera azzurra',
    );
  }

  const lato = Math.max(larghezza, altezza);
  const sinistra = Math.max(0, primoContenuto + Math.floor((larghezza - lato) / 2));
  const sopra = Math.max(0, alto + Math.floor((altezza - lato) / 2));
  const dl = Math.min(lato, width - sinistra, height - sopra);

  const quadrata = await sharp(file)
    .ensureAlpha()
    .extract({ left: sinistra, top: sopra, width: dl, height: dl })
    .png()
    .toBuffer();

  return { quadrata, lato: dl };
}
/** Colore dominante fra i pixel opachi (lo sfondo della tessera azzurra). */
async function coloreDominante(input) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) fallisci('canali RGBA inattesi nel campionamento del colore');
  const istogramma = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 250) continue;
    const chiave = `${data[i] >> 4}-${data[i + 1] >> 4}-${data[i + 2] >> 4}`;
    const voce = istogramma.get(chiave) ?? { n: 0, r: 0, g: 0, b: 0 };
    voce.n += 1;
    voce.r += data[i];
    voce.g += data[i + 1];
    voce.b += data[i + 2];
    istogramma.set(chiave, voce);
  }
  let migliore = null;
  for (const voce of istogramma.values()) {
    if (!migliore || voce.n > migliore.n) migliore = voce;
  }
  if (!migliore) fallisci('nessun pixel opaco: colore dominante non determinabile');
  return {
    r: Math.round(migliore.r / migliore.n),
    g: Math.round(migliore.g / migliore.n),
    b: Math.round(migliore.b / migliore.n),
  };
}

/** Costruisce un .ico multi-misura con payload PNG (formato standard Vista+). */
function costruisciIco(voci) {
  const testa = Buffer.alloc(6);
  testa.writeUInt16LE(0, 0); // riservato
  testa.writeUInt16LE(1, 2); // tipo 1 = icona
  testa.writeUInt16LE(voci.length, 4);

  let offset = 6 + 16 * voci.length;
  const intestazioni = [];
  for (const voce of voci) {
    const intestazione = Buffer.alloc(16);
    intestazione.writeUInt8(voce.lato >= 256 ? 0 : voce.lato, 0); // larghezza (0 = 256)
    intestazione.writeUInt8(voce.lato >= 256 ? 0 : voce.lato, 1); // altezza
    intestazione.writeUInt8(0, 2); // palette
    intestazione.writeUInt8(0, 3); // riservato
    intestazione.writeUInt16LE(1, 4); // piani di colore
    intestazione.writeUInt16LE(32, 6); // bit per pixel
    intestazione.writeUInt32LE(voce.dati.length, 8);
    intestazione.writeUInt32LE(offset, 12);
    offset += voce.dati.length;
    intestazioni.push(intestazione);
  }
  return Buffer.concat([testa, ...intestazioni, ...voci.map((v) => v.dati)]);
}

/** Legge larghezza/altezza da un PNG (chunk IHDR) senza decodificarlo. */
function misurePng(dati) {
  if (dati.length < 24 || dati.readUInt32BE(0) !== 0x89504e47) return null;
  return { larghezza: dati.readUInt32BE(16), altezza: dati.readUInt32BE(20) };
}

/** Verifica strutturale del contenitore ICO appena costruito. */
function verificaContenitoreIco(dati, misureAttese) {
  if (dati.readUInt16LE(0) !== 0 || dati.readUInt16LE(2) !== 1) return 'intestazione ICO non valida';
  if (dati.readUInt16LE(4) !== misureAttese.length) return 'numero di voci ICO errato';
  for (let i = 0; i < misureAttese.length; i += 1) {
    const base = 6 + i * 16;
    const lato = dati.readUInt8(base) || 256;
    if (lato !== misureAttese[i]) return `voce ICO ${i}: attesa ${misureAttese[i]}px, trovata ${lato}px`;
    const lunghezza = dati.readUInt32LE(base + 8);
    const offset = dati.readUInt32LE(base + 12);
    const misure = misurePng(dati.subarray(offset, offset + lunghezza));
    if (!misure || misure.larghezza !== lato || misure.altezza !== lato) {
      return `voce ICO ${lato}px: payload PNG non valido`;
    }
  }
  return null;
}
/* --------------------------------- main --------------------------------- */

const { quadrata, lato } = await estraiTessera(SORGENTE);
const sfondo = await coloreDominante(quadrata);
console.log(
  `Sorgente ${SORGENTE}: tessera ${lato}×${lato} px · sfondo dominante ` +
    `rgb(${sfondo.r}, ${sfondo.g}, ${sfondo.b})`,
);

/** PNG quadrato della tessera a una misura data (opaco = senza trasparenza). */
async function png(misura, { opaco = false } = {}) {
  let immagine = sharp(quadrata).resize(misura, misura, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha();
  if (opaco) immagine = immagine.flatten({ background: sfondo });
  return immagine.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

const generati = [];
for (const misura of MISURE_PNG) {
  generati.push({ lato: misura, file: `public/favicon-${misura}.png`, dati: await png(misura) });
}
generati.push({
  lato: MISURA_GRANDE,
  file: `public/favicon-${MISURA_GRANDE}.png`,
  dati: await png(MISURA_GRANDE),
});
generati.push({
  lato: MISURA_APPLE,
  file: 'public/apple-touch-icon.png',
  dati: await png(MISURA_APPLE, { opaco: true }),
});

if (!SOLO_VERIFICA) {
  for (const voce of generati) await writeFile(voce.file, voce.dati);
  await writeFile('public/favicon.ico', costruisciIco(generati.filter((v) => MISURE_PNG.includes(v.lato))));
}

/* ----------------------------- autoverifiche ----------------------------- */

let errori = 0;
const verifica = (descrizione, ok, dettaglio = '') => {
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${descrizione}${dettaglio ? ` — ${dettaglio}` : ''}`);
};

for (const voce of generati) {
  const dati = await readFile(voce.file);
  const atteso = voce.lato === MISURA_APPLE ? MISURA_APPLE : voce.lato;
  const misure = misurePng(dati);
  verifica(
    `${voce.file} = ${atteso}×${atteso}`,
    Boolean(misure) && misure.larghezza === atteso && misure.altezza === atteso,
    `${dati.length} byte`,
  );
  verifica(`${voce.file} leggero (<60 KB)`, dati.length < 60 * 1024);
}

const erroreIco = verificaContenitoreIco(await readFile('public/favicon.ico'), MISURE_PNG);
verifica('public/favicon.ico valido (16/32/48, payload PNG)', erroreIco === null, erroreIco ?? '');

// Provenienza: il file da 256 px deve essere la TESSERA, non il logo intero schiacciato.
const differenzaTessera = differenzaMedia(await rgba(quadrata, MISURA_GRANDE), await rgba('public/favicon-256.png', MISURA_GRANDE));
const differenzaLogo = differenzaMedia(await rgba(SORGENTE, MISURA_GRANDE), await rgba('public/favicon-256.png', MISURA_GRANDE));
verifica(
  'favicon-256.png derivata dalla tessera originale',
  differenzaTessera < SOGLIA_TESSERA,
  `Δ=${differenzaTessera.toFixed(2)} (soglia ${SOGLIA_TESSERA})`,
);
verifica(
  'favicon-256.png NON è il logo intero compresso',
  differenzaLogo > SOGLIA_LOGO_INTERO,
  `Δ=${differenzaLogo.toFixed(2)} (soglia ${SOGLIA_LOGO_INTERO})`,
);

// Apple touch icon opaco (senza trasparenza: niente sfondo nero su iOS).
const { data: pixelApple, info: infoApple } = await sharp('public/apple-touch-icon.png')
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
let trasparenti = 0;
for (let i = 3; i < pixelApple.length; i += 4) if (pixelApple[i] < 255) trasparenti += 1;
verifica(
  'apple-touch-icon.png opaco e 180×180',
  infoApple.width === MISURA_APPLE && infoApple.height === MISURA_APPLE && trasparenti === 0,
  `${trasparenti} pixel trasparenti`,
);

console.log(
  errori === 0
    ? `\n✅ Set favicon ufficiale ${SOLO_VERIFICA ? 'verificato (--check)' : 'generato e verificato'}.`
    : `\n❌ ${errori} verifica/e fallita/e.`,
);
if (errori > 0) process.exit(1);


