/**
 * TEST COMPLETO ARCHIVIO — verifica che OGNI tipo di modulo presente nel
 * catalogo `moduli.ts` renda su 1 pagina A4 (`.layout-compatto`) con il
 * BLOCCO FIRME UNIFICATO (Single Sign Box).
 *
 * Esecuzione:
 *   npm run test:pdf:completo
 * Genera `scripts/out/test-archivio-<tipo>.html` per ogni tipo.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { macroAreeModulistica } from '../src/data/moduli';
import { creaDocumentoLocale } from '../src/modules/modulistica/creator/cacheService';
import { costruisciDocumento } from '../src/modules/modulistica/creator/pdfGenerator';

interface EsempioTipo {
  nome: string;
  profilo: Record<string, string>;
  catalogoId?: string;
}

// Un documento di esempio per ogni tipo presente nel catalogo.
const perTipo = new Map<string, EsempioTipo>();
const visita = (nodo: { documenti?: { nome: string; profilo: Record<string, string>; catalogoId?: string }[]; sotto?: unknown[] }) => {
  for (const doc of nodo.documenti ?? []) {
    const key = doc.profilo.tipo ?? 'generico';
    if (!perTipo.has(key)) perTipo.set(key, { nome: doc.nome, profilo: doc.profilo, catalogoId: doc.catalogoId });
  }
  for (const s of nodo.sotto ?? []) visita(s as never);
};
for (const m of macroAreeModulistica) for (const s of m.sotto) visita(s as never);

const outDir = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(outDir, { recursive: true });

/** Tipi che per design system sono VOLUTAMENTE a 2 pagine (es. PEI). */
const INTENZIONALI_2_PAGINE = new Set(['pei']);

let ok = 0;
const daRivedere: string[] = [];
for (const [tipo, es] of perTipo) {
  const doc = creaDocumentoLocale(es.nome, es.profilo, es.catalogoId);
  const pronto = costruisciDocumento(doc.title, doc.content_html);
  const unico = (pronto.html.match(/class="blocco-convalida-unico"/g) ?? []).length === 1;
  const unaPagina = pronto.layout === 'compatto' && pronto.pagineStimate === 1;
  const okTipo = unaPagina && unico;
  const intenzionale = INTENZIONALI_2_PAGINE.has(tipo);
  if (okTipo || intenzionale) ok++;
  else daRivedere.push(`${tipo}: layout=${pronto.layout} pagine=${pronto.pagineStimate} unico=${unico}`);
  writeFileSync(`${outDir}test-archivio-${tipo}.html`, pronto.html, 'utf8');
  console.log(
    `${tipo.padEnd(30)} | ${pronto.layout.padEnd(9)} | pagine: ${pronto.pagineStimate} | ${unico ? 'blocco unico OK' : 'blocco unico NO'}${intenzionale ? '  [2 pagine volute]' : ''}`,
  );
}
console.log(`\nTipi totali: ${perTipo.size} | OK (1 pagina + blocco unico o 2 pagine volute): ${ok}`);
if (daRivedere.length) console.log('DA RIVEDERE:\n' + daRivedere.join('\n'));
