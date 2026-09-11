/**
 * DIAGNOSTICA — Struttura HTML del post giornaliero scuolainterpelli.it
 * Serve a progettare l'estrazione multi-regione (provincia + classi per voce)
 * e a verificare quali endpoint regionali esistono (HTTP 200).
 *
 * Uso: npx tsx scripts/diag-fonti.ts
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { estraiProvincia } from '../src/scraper/parser.ts';

const POST = 'https://www.scuolainterpelli.it/interpelli-scuola-9-settembre-2026-2/';

async function main(): Promise<void> {
  const { data: html } = await axios.get<string>(POST, { timeout: 20_000 });
  console.log(`HTML size: ${html.length}`);
  for (const chiave of ['VISUALIZZA INTERPELLI', 'BERGAMO', 'A040']) {
    const lower = html.toLowerCase();
    const k = chiave.toLowerCase();
    const pos: number[] = [];
    let i = lower.indexOf(k);
    while (i !== -1 && pos.length < 2) {
      pos.push(i);
      i = lower.indexOf(k, i + 1);
    }
    console.log(`\n### "${chiave}": ${pos.length} (primi contesti)`);
    for (const p of pos) {
      console.log('--------------------------------------');
      console.log(html.slice(Math.max(0, p - 420), p + 180).replace(/\s+/g, ' '));
    }
  }
}

void main();

