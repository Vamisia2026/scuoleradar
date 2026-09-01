/**
 * VALIDAZIONE MODULISTICA — verifica di coerenza di layout, contenuti,
 * branding e paginazione dei moduli generati localmente
 * (`creaDocumentoLocale` + `costruisciDocumento`).
 *
 * Include:
 *  - struttura guidata delle 4 Dimensioni ICF (D.I. 182/2020) nella
 *    Relazione Finale Inclusione (PEI/PDP) + proposte di transizione
 *    con fabbisogno ore (art. 10 D.Lgs. 66/2017);
 *  - PSP Alunni NAI compattato per Assi/Macro-Aree (niente ripetizione
 *    per materia atomica), griglia QCER A0-B1 con ore settimanali L2 e
 *    riferimenti normativi integrati (Linee Guida 2014, D.Lgs. 62/2017
 *    art. 10, D.M. 27/12/2012);
 *  - layout rigido (esteso/compatto) e nessuna pagina di vuoto grafico
 *    (pagine stimate entro il range [min, max]);
 *  - branding "ScuoleRadar.it" (nessun refuso "ScuolaRadar").
 *
 * Esecuzione:
 *   npx tsx --tsconfig tsconfig.app.json scripts/_validate-modulistica.ts
 */
import { macroAreeModulistica } from '../src/data/moduli';
import { creaDocumentoLocale } from '../src/modules/modulistica/creator/cacheService';
import { costruisciDocumento } from '../src/modules/modulistica/creator/pdfGenerator';

interface Attese {
  minPagine?: number;
  maxPagine?: number;
  contiene?: string[];
  nonContiene?: string[];
}

const ATTESE: Record<string, Attese> = {
  delega_famiglia: {
    contiene: ['Delega al ritiro dell\u2019alunno/a da parte di terzi maggiorenni'],
    nonContiene: ['172/2017', 'Accesso agli atti'],
  },
  sostegno: {
    contiene: [
      "Verbale di Accertamento dell'Handicap (L. 104/92 art. 3 c. 1 o c. 3)",
      'Profilo di Funzionamento / Diagnosi Funzionale / Relazione Specialistica',
      "Copia documento d'identità del richiedente",
    ],
  },
  relazione_finale_inclusione: {
    minPagine: 6,
    maxPagine: 10,
    contiene: [
      'Punti di forza osservati',
      'Principali barriere riscontrate e facilitatori utilizzati',
      'Livello di raggiungimento degli obiettivi previsti nel PEI/PDP',
      'Fabbisogno ore di sostegno consigliato (art. 10 D.Lgs. 66/2017)',
      'Strategie inclusive da proseguire',
      'Riferimenti normativi e tutela legale',
    ],
  },
  piano_personalizzato_nai: {
    minPagine: 8,
    maxPagine: 12,
    contiene: [
      "Livello d'ingresso (QCER A0-B1)",
      'Ore settimanali laboratorio italiano L2 / mediazione',
      'Area Linguistico-Espressiva (Italiano L2, Lingue Straniere)',
      'Area Scientifico-Matematica e Tecnologica',
      'Area Storico-Sociale ed Espressiva (Storia, Geografia, Arte, Musica, Ed. Fisica)',
      'Linee Guida Ministeriali per l\u2019accoglienza e l\u2019integrazione degli alunni stranieri (2014)',
      'D.Lgs. 62/2017 (Art. 10',
      'D.M. 27/12/2012 (Bisogni Educativi Speciali)',
    ],
  },
};

/** Documenti pedagogici/inclusivi forzati al layout esteso (con pagine minime). */
const PEDAGOGICI = new Set([
  'pei',
  'pdp_bes',
  'pdp_dsa',
  'relazione_finale',
  'relazione_finale_inclusione',
  'certificazione_competenze',
  'piano_personalizzato',
  'piano_personalizzato_nai',
  'progetto_alfabetizzazione',
  'verbale_glo',
]);

// Raccoglie un documento di esempio per ogni tipo presente nel catalogo.
interface EsempioTipo {
  nome: string;
  profilo: Record<string, string>;
  catalogoId?: string;
}
const perTipo = new Map<string, EsempioTipo>();
const visita = (nodo: {
  documenti?: { nome: string; profilo: Record<string, string>; catalogoId?: string }[];
  sotto?: unknown[];
}) => {
  for (const doc of nodo.documenti ?? []) {
    const key = doc.profilo.tipo ?? 'generico';
    if (!perTipo.has(key)) perTipo.set(key, { nome: doc.nome, profilo: doc.profilo, catalogoId: doc.catalogoId });
  }
  for (const s of nodo.sotto ?? []) visita(s as never);
};
for (const m of macroAreeModulistica) for (const s of m.sotto) visita(s as never);

let ok = 0;
const errori: string[] = [];
for (const [tipo, es] of perTipo) {
  const doc = creaDocumentoLocale(es.nome, es.profilo, es.catalogoId);
  const pronto = costruisciDocumento(doc.title, doc.content_html);
  const html = pronto.html;
  const problemi: string[] = [];

  // Verifiche universali di resa e branding.
  if (!html.includes('<!doctype html>')) problemi.push('manca <!doctype html>');
  if (!html.includes('ScuoleRadar.it')) problemi.push('branding ScuoleRadar.it mancante');
  if (html.includes('ScuolaRadar')) problemi.push('refuso "ScuolaRadar" (senza e)');
  if (html.includes('${')) problemi.push('template ${ non risolto');
  if (html.includes('undefined')) problemi.push('"undefined" nell\u2019output');
  if (html.includes('NaN')) problemi.push('NaN nell\u2019output');
  if ((html.match(/<h2[^>]*><\/h2>/g) ?? []).length > 0) problemi.push('h2 vuoti');

  // Layout rigido + paginazione compatta (nessun vuoto grafico).
  const attese = ATTESE[tipo];
  const min = attese?.minPagine ?? Number(html.match(/data-min-pagine="(\d+)"/)?.[1] ?? 1);
  const estesoAtteso = PEDAGOGICI.has(tipo) || min > 1;
  if (estesoAtteso) {
    if (pronto.layout !== 'esteso') problemi.push(`layout=${pronto.layout} (atteso esteso)`);
    if (pronto.pagineStimate < min) problemi.push(`pagine=${pronto.pagineStimate} < min ${min}`);
  } else if (pronto.layout !== 'compatto') {
    problemi.push(`layout=${pronto.layout} (atteso compatto)`);
  }
  if (attese?.maxPagine !== undefined && pronto.pagineStimate > attese.maxPagine) {
    problemi.push(`pagine=${pronto.pagineStimate} > max ${attese.maxPagine} (vuoto grafico)`);
  }

  // Verifiche specifiche per tipo.
  for (const segno of attese?.contiene ?? []) {
    if (!html.includes(segno)) problemi.push(`manca: ${segno}`);
  }
  for (const segno of attese?.nonContiene ?? []) {
    if (html.includes(segno)) problemi.push(`da rimuovere per questo ordine: ${segno}`);
  }

  if (problemi.length) errori.push(`${tipo}: ${problemi.join(' | ')}`);
  else ok++;
  console.log(
    `${tipo.padEnd(32)} | ${pronto.layout.padEnd(9)} | pagine: ${String(pronto.pagineStimate).padEnd(3)} | ${
      problemi.length ? '✗ ' + problemi.join(' · ') : 'OK'
    }`,
  );
}

console.log(`\nTipi totali: ${perTipo.size} | OK: ${ok}`);

// Test dedicato: PEI Scuola dell'Infanzia — 5 Campi di Esperienza
// (Indicazioni Nazionali), nessuna disciplina, dossier di 12-15 pagine.
{
  const doc = creaDocumentoLocale('PEI Infanzia', { tipo: 'pei', ordine: 'infanzia' });
  const pronto = costruisciDocumento(doc.title, doc.content_html);
  const html = pronto.html;
  const problemi: string[] = [];
  for (const segno of [
    'Il sé e l\u2019altro',
    'Il corpo e il movimento',
    'Immagini, suoni, colori',
    'I discorsi e le parole',
    'La conoscenza del mondo',
    'Campi di Esperienza',
    'Indicazioni Nazionali per il Curricolo (2012)',
  ]) {
    if (!html.includes(segno)) problemi.push(`manca: ${segno}`);
  }
  for (const segno of ['Matematica', 'Scienze', 'Storia', 'Geografia', 'Italiano']) {
    if (html.includes(segno)) problemi.push(`da rimuovere: ${segno}`);
  }
  if (pronto.layout !== 'esteso') problemi.push(`layout=${pronto.layout} (atteso esteso)`);
  if (pronto.pagineStimate < 12 || pronto.pagineStimate > 15) {
    problemi.push(`pagine=${pronto.pagineStimate} (attese 12-15)`);
  }
  if (problemi.length) errori.push(`pei (infanzia): ${problemi.join(' | ')}`);
  else ok++;
  console.log(
    `${'pei (infanzia)'.padEnd(32)} | ${pronto.layout.padEnd(9)} | pagine: ${String(pronto.pagineStimate).padEnd(3)} | ${
      problemi.length ? '✗ ' + problemi.join(' · ') : 'OK'
    }`,
  );
}

if (errori.length) {
  console.log('ERRORE:\n' + errori.join('\n'));
  process.exit(1);
}
console.log('VALIDAZIONE COMPLETATA CON SUCCESSO');
