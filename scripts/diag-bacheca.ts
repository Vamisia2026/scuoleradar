/**
 * ScuoleRadar.it — DIAGNOSI DELLA BACHECA DI UNA PROVINCIA (§26.111 · §26.119).
 *
 * Perché esiste: «l'utente di Asti vede cinque opportunità?» non si risponde a
 * occhio. Questo script rifà in Node, sul database VERO, lo stesso percorso del
 * feed (`src/contexts/app/useInterpelliFeed.ts`):
 *
 *   1. pool di ZONA — province scelte + entro il raggio dei 60 km
 *      (`provinceDiRicerca`), letto dal Matching Engine (`getFeedInterpelli`);
 *   2. BACHECA del profilo (`bachecaInterpelli`): porte d'ingresso §26.63, voto a
 *      due livelli, cap dei riempitivi e paracadute «5» (§26.106);
 *   3. sotto il minimo, query LARGA (stesse classi, nessun vincolo geografico) e
 *      integrazione provincia → regione → Italia (`integraAmbiti`, §26.111);
 *   4. filtro e ordine della pagina (`DashboardPage`): solo avvisi attivi, con i
 *      campi identitari, voto decrescente e scadenza crescente.
 *
 * Stampa i conti di ogni stadio e le righe che l'utente vedrebbe davvero. Nessuna
 * scrittura: solo letture.
 *
 * Uso:
 *   npx tsx scripts/diag-bacheca.ts --provincia=AT
 *   npx tsx scripts/diag-bacheca.ts --provincia=AT --classi=A-22,A-12 --minimo=5
 *   npx tsx scripts/diag-bacheca.ts --provincia=AT --senza-classi   # ultima spiaggia
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import type { Interpello } from '../src/data/interpelli.ts';
import type { OrdineScuola } from '../src/data/ordiniMaterie.ts';
import { province } from '../src/data/province.ts';
import {
  integraAmbiti,
  provinceDellaRegione,
  regioneDi,
  type AmbitoBacheca,
} from '../src/lib/ambitoBacheca.ts';
import { bachecaInterpelli } from '../src/lib/bachecaInterpelli.ts';
import { getFeedInterpelli } from '../src/lib/matchingEngine.ts';
import { normalizzaProvincia, provinceDiRicerca } from '../src/lib/prossimitaGeografica.ts';
import { MINIMO_BACHECA } from '../src/lib/riempitivi.ts';
import { eOpportunitaConScadenza } from '../src/lib/scadenza.ts';
import {
  campiMancantiVetrina,
  rigaVetrinaCompleta,
  vetrinaVisibile,
} from '../src/lib/vetrinaBacheca.ts';

dotenv.config();

const RIGHE_FEED = 1_000;
/** Profilo della diagnosi: tutti gli ordini (il vincolo lo fanno classi e provincia). */
const ORDINI: OrdineScuola[] = [
  'infanzia',
  'primaria',
  'secondaria1',
  'secondaria2',
  'cpia',
  'serali',
  'pon',
  'ata',
];

const argomento = (nome: string): string | undefined =>
  process.argv.find((a) => a.startsWith(`--${nome}=`))?.slice(nome.length + 3);

const CODICE = normalizzaProvincia(argomento('provincia') ?? 'AT');
const MINIMO = Number(argomento('minimo') ?? MINIMO_BACHECA);
const SENZA_CLASSI = process.argv.includes('--senza-classi');

const client = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const nomeProvincia = (codice: string): string =>
  province.find((p) => p.codice === codice)?.nome ?? codice;

/** Classi più frequenti nel pool di zona: profilo di prova REALISTICO, mai inventato. */
function classiDalPool(pool: readonly Interpello[]): string[] {
  const conteggio = new Map<string, number>();
  for (const riga of pool) {
    for (const codice of riga.classiCodes ?? []) {
      const c = codice.trim().toUpperCase();
      if (!c || c === 'GENERALE') continue;
      conteggio.set(c, (conteggio.get(c) ?? 0) + 1);
    }
  }
  return [...conteggio.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([codice]) => codice);
}

/** Filtro e ordine della pagina (`DashboardPage`): vetrina visibile, voto, scadenza. */
function vetrinaDiPagina(lista: readonly Interpello[]): Interpello[] {
  return vetrinaVisibile(lista)
    .sort((a, b) => {
      const ca = a.compatibilita ?? 100;
      const cb = b.compatibilita ?? 100;
      if (cb !== ca) return cb - ca;
      const ta = a.dataScadenza ? new Date(a.dataScadenza).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dataScadenza ? new Date(b.dataScadenza).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
}

async function main(): Promise<void> {
  const regione = regioneDi(CODICE);
  const zona = provinceDiRicerca([CODICE]);
  console.log(`\n=== BACHECA DI ${nomeProvincia(CODICE)} (${CODICE}) ===`);
  console.log(
    `• Regione: ${regione ?? 'n/d'} · zona cercata (raggio 60 km): ${zona.join(', ') || 'n/d'}`,
  );
  console.log(`• Minimo di vetrina: ${MINIMO} · classi: ${argomento('classi') ?? 'derivate dal pool'}`);

  // 0. Radar attivo in Italia: il metro della promessa «mai zero».
  const oggi = new Date().toISOString().slice(0, 10);
  const { count: attiviItalia } = await client
    .from('interpelli')
    .select('*', { count: 'exact', head: true })
    .gte('expiration_date', oggi);
  const { count: righeZona } = await client
    .from('interpelli')
    .select('*', { count: 'exact', head: true })
    .in('province', zona)
    .gte('expiration_date', oggi);
  console.log('\n— 0. Radar attivo —');
  console.log(`• Avvisi ATTIVI in Italia: ${attiviItalia ?? 0}`);
  console.log(`• Avvisi attivi nella ZONA (${zona.join(', ')}): ${righeZona ?? 0}`);

  // 1. Pool di zona senza filtro classi: serve a derivare un profilo realistico.
  const poolZona = (await getFeedInterpelli(client, { province: zona, limit: RIGHE_FEED })) ?? [];
  const candidabiliZona = poolZona.filter((i) => eOpportunitaConScadenza(i.dataScadenza));
  const classi = (argomento('classi') ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  const classiProfilo = classi.length > 0 ? classi : classiDalPool(poolZona);
  console.log(
    `• Pool di zona senza filtro classi: ${poolZona.length} righe, ${candidabiliZona.length} entro l'orizzonte dei 15 giorni`,
  );
  console.log(`• Classi del profilo di prova: ${classiProfilo.join(', ') || 'nessuna'}`);


  // 2. Feed della bacheca: stessi criteri dell'hook (zona + classi del piano).
  const feedZona =
    (await getFeedInterpelli(client, { province: zona, classi: classiProfilo, limit: RIGHE_FEED })) ?? [];
  const bacheca = bachecaInterpelli(feedZona, {
    ordini: ORDINI,
    classi: classiProfilo,
    province: [CODICE],
    favoriteSchools: [],
    ignoredSchools: [],
  });
  console.log(`\n— 1. Bacheca di ZONA (${feedZona.length} righe lette) —`);
  console.log(
    `• In bacheca: ${bacheca.lista.length} · senza scadenza: ${bacheca.senzaScadenza} · ` +
      `contorno: ${bacheca.righeNonOpportunita} · blacklist: ${bacheca.esclusiBlacklist} · ` +
      `riempitivi esclusi: ${bacheca.riempitiviEsclusi} · nascosti: ${bacheca.riempitiviNascosti} · ` +
      `ripieghi: ${bacheca.ripieghiInBacheca}`,
  );

  // 3. Integrazione fuori zona: query larga SOLO sotto il minimo (§26.111), contato
  // sulle righe VISIBILI (§26.119) — è ciò che fa il feed.
  const visibili = vetrinaVisibile(bacheca.lista);
  const scartateDalGate = bacheca.lista.length - visibili.length;
  const motiviGate = new Map<string, number>();
  for (const riga of bacheca.lista) {
    for (const campo of campiMancantiVetrina(riga)) {
      motiviGate.set(campo, (motiviGate.get(campo) ?? 0) + 1);
    }
  }
  console.log(
    `• VISIBILI in pagina: ${visibili.length} (scartate dal gate identitario: ${scartateDalGate}` +
      `${motiviGate.size > 0 ? ` — ${[...motiviGate.entries()].map(([c, n]) => `${c}: ${n}`).join(' · ')}` : ''})`,
  );

  let finale: (Interpello & { ambito?: AmbitoBacheca | null })[] = visibili;
  if (visibili.length < MINIMO) {
    const larga =
      (await getFeedInterpelli(client, {
        ...(SENZA_CLASSI ? {} : { classi: classiProfilo }),
        limit: RIGHE_FEED,
      })) ?? [];
    const inBacheca = new Set(bacheca.lista.map((i) => i.id));
    const fuori = larga.filter(
      (i) =>
        !inBacheca.has(i.id) &&
        eOpportunitaConScadenza(i.dataScadenza) &&
        rigaVetrinaCompleta(i),
    );
    const perimetro = provinceDellaRegione([CODICE]);
    const regionali = fuori.filter((i) => perimetro.has(normalizzaProvincia(i.provinciaCodice)));
    const nazionali = fuori.filter((i) => !perimetro.has(normalizzaProvincia(i.provinciaCodice)));
    const esito = integraAmbiti(visibili, { regionali, nazionali }, { minimo: MINIMO });
    finale = esito.lista.map((i) =>
      i.ambito === 'provincia' ? i : { ...i, compatibilita: 0, ripiego: false },
    );
    console.log(`\n— 2. Integrazione fuori zona (query larga ${SENZA_CLASSI ? 'SENZA' : 'con'} classi) —`);
    console.log(
      `• Righe lette: ${larga.length} · candidabili fuori bacheca: ${fuori.length} · ` +
        `regione: ${regionali.length} · Italia: ${nazionali.length}`,
    );
    console.log(
      `• Aggiunte: ${esito.aggiunti} (regione ${esito.daRegione} · Italia ${esito.daNazionale}) · motivo: ${esito.motivo}`,
    );
  }


  // 4. Cosa vede l'utente: filtro e ordine della pagina.
  const vetrina = vetrinaDiPagina(finale);
  console.log(`\n— 3. VETRINA («Opportunità mappate»): ${vetrina.length} righe —`);
  if (vetrina.length === 0) {
    console.log('  ⚠ bacheca VUOTA: nessuna riga ha passato i gate.');
  }
  vetrina.forEach((riga, indice) => {
    const ambito = riga.ambito && riga.ambito !== 'provincia' ? ` · ambito ${riga.ambito}` : '';
    console.log(
      `  ${indice + 1}. [${riga.dataScadenza}] ${riga.provinciaCodice} · ${riga.istituto.slice(0, 46)}` +
        ` · voto ${riga.compatibilita}%${ambito}`,
    );
    console.log(`     ${riga.titolo.slice(0, 110)}`);
  });

  const abbastanza = vetrina.length >= MINIMO;
  console.log(
    `\n${abbastanza ? '✅' : '⚠️'} Vetrina ${vetrina.length}/${MINIMO}` +
      ` — avvisi attivi in Italia: ${attiviItalia ?? 0}` +
      `${vetrina.length === 0 && (attiviItalia ?? 0) > 0 ? ' → PROMESSA VIOLATA: pagina vuota con Radar non vuoto' : ''}`,
  );
  process.exitCode = abbastanza ? 0 : 1;
}

main().catch((err) => {
  console.error('✗ Diagnosi bacheca fallita:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
