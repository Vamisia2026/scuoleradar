/**
 * TEST COMPLETO ARCHIVIO — verifica la CLASSIFICAZIONE RIGIDA dei layout:
 *  - moduli burocratici/rapidi → 1 pagina A4 (`.layout-compatto`);
 *  - documenti pedagogici/inclusivi (PEI, PDP, relazioni, certificazione
 *    delle competenze, piani personalizzati) → 2-4 pagine (`.layout-esteso`).
 * Ogni documento deve includere il BLOCCO FIRME UNIFICATO (Single Sign Box);
 * i documenti estesi devono avere anche il blocco firme esteso (GLO/team).
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

/** Documenti pedagogici/inclusivi: layout esteso con pagine minime garantite
 * (valori di riferimento; il minimo effettivo è letto dal marcatore data-min-pagine). */
const MIN_PAGINE: Record<string, number> = {
  pei: 15,
  pdp_bes: 18,
  pdp_dsa: 18,
  relazione_finale: 12,
  relazione_finale_inclusione: 6,
  piano_personalizzato_nai: 8,
  progetto_alfabetizzazione: 14,
  verbale_glo: 8,
  certificazione_competenze: 4,
  piano_personalizzato: 4,
};

let ok = 0;
const daRivedere: string[] = [];
for (const [tipo, es] of perTipo) {
  const doc = creaDocumentoLocale(es.nome, es.profilo, es.catalogoId);
  const pronto = costruisciDocumento(doc.title, doc.content_html);
  const unico = (pronto.html.match(/class="blocco-convalida-unico"/g) ?? []).length === 1;
  const firmeEstese = pronto.html.includes('firme-estese');
  const min = Math.max(
    MIN_PAGINE[tipo] ?? 1,
    Number(pronto.html.match(/data-min-pagine="(\d+)"/)?.[1] ?? 1),
  );
  const estesoAtteso = min > 1;
  const okTipo =
    (estesoAtteso
      ? pronto.layout === 'esteso' && pronto.pagineStimate >= min && firmeEstese
      : pronto.layout === 'compatto' && pronto.pagineStimate === 1) &&
    unico;
  if (okTipo) ok++;
  else daRivedere.push(`${tipo}: atteso=${estesoAtteso ? `esteso≥${min}` : 'compatto'} layout=${pronto.layout} pagine=${pronto.pagineStimate} unico=${unico} firmeEstese=${firmeEstese}`);
  writeFileSync(`${outDir}test-archivio-${tipo}.html`, pronto.html, 'utf8');
  console.log(
    `${tipo.padEnd(30)} | ${pronto.layout.padEnd(9)} | pagine: ${pronto.pagineStimate} | ${unico ? 'blocco unico OK' : 'blocco unico NO'} | ${estesoAtteso ? (firmeEstese ? `esteso ≥ ${min} pagine` : 'firme estese NO') : 'compatto 1 pagina'}`,
  );
}
console.log(`\nTipi totali: ${perTipo.size} | OK: ${ok} (compatto=1pg, esteso dossier ≥${Math.max(...Object.values(MIN_PAGINE))}pg)`);
if (daRivedere.length) console.log('DA RIVEDERE:\n' + daRivedere.join('\n'));
