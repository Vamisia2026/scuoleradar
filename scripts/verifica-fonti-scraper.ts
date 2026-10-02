/**
 * VERIFICA DAL VIVO delle fonti interpelli (rete) — Capoluoghi & hub.
 *
 * Ricontrolla ogni URL ATTIVA del registro (`src/scraper/fonti.ts`): stato HTTP,
 * titolo, quantità di segnali di reclutamento e — per gli hub — quali SEZIONI di
 * interpelli/avvisi il connettore scopre nella pagina. Serve a intercettare il
 * "drift" della PA (pagine spostate, portali migrati) invece di scoprirlo in
 * produzione con una bacheca vuota.
 *
 * ⚠️ I blocchi anti-bot (403/timeout/WAF) sono ATTESI e non sono un errore di
 * registro: la soglia di fallimento è al 20% delle fonti attive.
 *
 * Uso: npm run fonti:verifica        (non è in `npm test`: richiede la rete)
 */
import axios from 'axios';
import { fontiAttive, type FonteInterpelli } from '../src/scraper/fonti.ts';
import { capoluoghiScoperti, regioniCoperte, regioniScoperte, sintesiCopertura } from '../src/scraper/fontiCopertura.ts';
import { scopriSezioniReclutamento } from '../src/scraper/hub.ts';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

interface EsitoFonte {
  fonte: FonteInterpelli;
  stato: number | string;
  titolo: string;
  segnali: number;
  sezioni: string[];
}

async function prova(fonte: FonteInterpelli): Promise<EsitoFonte> {
  try {
    const res = await axios.get<string>(fonte.url, {
      timeout: 25_000,
      maxRedirects: 5,
      validateStatus: (s: number) => s < 500,
      responseType: 'text',
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'it-IT,it;q=0.9' },
    });
    const html = String(res.data ?? '');
    const titolo = (html.match(/<title[^>]*>([\s\S]{0,90}?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
    const segnali = (html.toLowerCase().match(/interpell|supplenz|reclutament|concors|avviso|bando/g) ?? []).length;
    return {
      fonte,
      stato: res.status,
      titolo,
      segnali,
      sezioni: fonte.tipo === 'hub-istituzionale' ? scopriSezioniReclutamento(html, fonte.url) : [],
    };
  } catch (err) {
    return { fonte, stato: `ERR ${(err as Error).message.slice(0, 60)}`, titolo: '', segnali: 0, sezioni: [] };
  }
}

async function main(): Promise<void> {
  const fonti = fontiAttive();
  console.log('━━ Verifica dal vivo delle fonti interpelli ━━');
  console.log(`• ${sintesiCopertura()}`);
  console.log(`• Regioni coperte: ${regioniCoperte(true).join(', ')}`);
  console.log(`• Regioni senza hub dedicato: ${regioniScoperte().join(', ') || 'nessuna'}`);
  console.log(`• Capoluoghi principali scoperti: ${capoluoghiScoperti().join(', ') || 'nessuno'}\n`);

  const esiti: EsitoFonte[] = [];
  for (const fonte of fonti) {
    const esito = await prova(fonte);
    esiti.push(esito);
    const stato = String(esito.stato).padEnd(6);
    console.log(`${stato} segnali:${String(esito.segnali).padEnd(4)} ${fonte.id}`);
    console.log(`       ${fonte.etichetta} → ${fonte.url}`);
    if (esito.titolo) console.log(`       titolo: ${esito.titolo.slice(0, 70)}`);
    if (fonte.tipo === 'hub-istituzionale') {
      console.log(
        `       sezioni scoperte: ${esito.sezioni.length > 0 ? esito.sezioni.join(' | ') : '— (nessuna sezione: si usa la pagina stessa)'}`,
      );
    }
  }

  const ok = esiti.filter((e) => e.stato === 200).length;
  const ko = esiti.length - ok;
  console.log(`\n• Fonti raggiungibili: ${ok}/${esiti.length} (non raggiungibili: ${ko})`);
  console.log(
    '• Nota: 403/timeout isolati sono blocchi anti-bot del server, non un errore di registro ' +
      '(i bandi strutturati restano accettati dal gate del link).',
  );
  const soglia = Math.ceil(esiti.length * 0.2);
  if (ko > soglia) {
    console.error(
      `❌ VERIFICA FONTI: ${ko} fonti non raggiungibili (soglia tollerata ${soglia}). ` +
        'Controllare gli URL in src/scraper/fontiRegistro.ts.',
    );
    process.exitCode = 1;
    return;
  }
  console.log(`✅ VERIFICA FONTI: registro coerente (${ko} fallimenti entro la soglia di ${soglia}).`);
}

void main();
