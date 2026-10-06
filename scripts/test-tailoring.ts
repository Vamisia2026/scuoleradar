/**
 * Verifica il TAILORING DEL RECAPITO (§26.68, direttiva 06/10/2026): un'interpellanza
 * genuina non si perde per un'anagrafica incompleta.
 *
 *  1. `risolviContattoAvviso` — gerarchia delle fonti (fonte → anagrafica → storico →
 *     convenzione MIM), normalizzazione, PEC da qualunque fonte, `daRevisionare`
 *     onesto quando NESSUNA fonte produce un recapito;
 *  2. `indiceStoricoContatti` / `contattoDaStorico` — il «database interno»: vince la
 *     riga più recente, il nome vale solo se univoco (o univoco nella provincia),
 *     nessuna email inventata;
 *  3. `patchDaStorico` — mai sovrascritture (contratto identico all'anagrafica);
 *  4. `applicaTailoring` — cosa entra nella riga all'inserimento e cosa si conta;
 *  5. il CONTRATTO di prodotto: senza recapito l'avviso resta inviabile col link
 *     diretto (§26.68) — la riga da revisionare non viene mai scartata.
 *
 * Uso: npm run test:tailoring
 */
import { avvisoInviabile, avvisoSenzaRecapito } from '../src/lib/alertInterpello.ts';
import { risolviContattoAvviso } from '../src/lib/tailoringContatti.ts';
import {
  contattoDaStorico,
  indiceStoricoContatti,
  patchDaStorico,
  REGISTRO_STORICO_VUOTO,
  type RigaStorico,
} from '../src/scraper/storicoContatti.ts';
import {
  applicaTailoring,
  azzeraRiepilogoTailoring,
  impostaStoricoContatti,
  riepilogoTailoring,
} from '../src/scraper/tailoringInterpelli.ts';

let errori = 0;
function check(nome: string, atteso: unknown, ottenuto: unknown): void {
  const ok = JSON.stringify(atteso) === JSON.stringify(ottenuto);
  if (!ok) errori += 1;
  console.log(`${ok ? '✓' : '✗'} ${nome}: atteso=${JSON.stringify(atteso)} ottenuto=${JSON.stringify(ottenuto)}`);
}

console.log('— Gerarchia delle fonti del tailoring —');
check(
  'email della fonte vince su tutto (normalizzata)',
  { email: 'a.b@istruzione.it', provenienza: 'fonte', daRevisionare: false },
  (() => {
    const e = risolviContattoAvviso({
      emailFonte: '  A.B@Istruzione.IT ',
      anagrafica: { email: 'x@y.it' },
      storico: { email: 'z@w.it' },
      convenzione: { email: 'c@d.it' },
    });
    return { email: e.email, provenienza: e.provenienza, daRevisionare: e.daRevisionare };
  })(),
);
check(
  'senza email della fonte vince il registro ufficiale (SCUANAGRAFE)',
  'anagrafica',
  risolviContattoAvviso({ anagrafica: { email: 'PEO@Scuola.IT' }, storico: { email: 'z@w.it' } }).provenienza,
);
check(
  'senza anagrafica vince lo storico interno',
  { email: 'segreteria@gigli.edu.it', provenienza: 'storico' },
  (() => {
    const e = risolviContattoAvviso({
      storico: { email: 'SEGRETERIA@Gigli.EDU.IT' },
      convenzione: { email: 'c@d.it' },
    });
    return { email: e.email, provenienza: e.provenienza };
  })(),
);
check(
  'ultima fonte: convenzione MIM sul codice',
  'convenzione',
  risolviContattoAvviso({ convenzione: { email: 'bsis02900x@istruzione.it' } }).provenienza,
);
check(
  'email malformata → si scende alla fonte successiva (mai indirizzi inventati)',
  { email: 'bsis02900x@istruzione.it', provenienza: 'convenzione' },
  (() => {
    const e = risolviContattoAvviso({
      emailFonte: 'scrivi alla segreteria',
      convenzione: { email: 'bsis02900x@istruzione.it' },
    });
    return { email: e.email, provenienza: e.provenienza };
  })(),
);
check(
  'nessuna fonte → daRevisionare (nessun recapito inventato)',
  { email: null, pec: null, provenienza: 'nessuna', daRevisionare: true },
  risolviContattoAvviso({ emailFonte: '', anagrafica: null, storico: null, convenzione: { email: 'niente' } }),
);
check(
  'la PEC si prende da qualunque fonte la dichiari',
  'bsis02900x@pec.istruzione.it',
  risolviContattoAvviso({
    emailFonte: 'segreteria@gigli.edu.it',
    anagrafica: { pec: 'BSIS02900X@PEC.Istruzione.IT' },
  }).pec,
);

console.log('\n— Storico interno: indice e matching —');
const storico: RigaStorico[] = [
  { school_code: 'BSIS02900X', school_name: "I.I.S. 'L. Gigli'", province: 'BS', contact_email: 'nuova@gigli.edu.it', school_pec: 'bsis02900x@pec.istruzione.it' },
  { school_code: 'BSIS02900X', school_name: "I.I.S. 'L. Gigli'", province: 'BS', contact_email: 'vecchia@gigli.edu.it' },
  { school_code: 'MNIC81800E', school_name: 'I.C. Castiglione 1', province: 'MN', contact_email: 'mnic81800e@istruzione.it' },
  { school_code: 'MIAA11101E', school_name: 'I.C. Manzoni', province: 'MI', contact_email: 'manzoni.mi@istruzione.it' },
  { school_code: 'BGAA99901X', school_name: 'I.C. Manzoni', province: 'BG', contact_email: 'manzoni.bg@istruzione.it' },
  { school_code: null, school_name: 'Scuola Senza Recapito', province: 'TO', contact_email: null },
];
const registro = indiceStoricoContatti(storico);
check('righe indicizzate (solo quelle con recapito)', 5, registro.righe);
check('storico disponibile', true, registro.disponibile);
check('codici meccanografici indicizzati', 4, registro.perCodice.size);
check('vince la riga più RECENTE', 'nuova@gigli.edu.it', contattoDaStorico(registro, { school_code: 'bsis02900x' })?.email);
check('codice in minuscolo/spazi → stessa scuola', 'mnic81800e@istruzione.it', contattoDaStorico(registro, { school_code: ' mnic81800e ' })?.email);
check(
  'nome univoco (senza codice) → recuperate email e PEC',
  { email: 'nuova@gigli.edu.it', pec: 'bsis02900x@pec.istruzione.it' },
  contattoDaStorico(registro, { school_name: "I.I.S. 'L. Gigli'" }),
);
check('nome ambiguo SENZA provincia → null (mai indovinare)', null, contattoDaStorico(registro, { school_name: 'I.C. Manzoni' }));
check('nome ambiguo CON provincia → la scuola giusta', 'manzoni.bg@istruzione.it', contattoDaStorico(registro, { school_name: 'I.C. Manzoni', province: 'BG' })?.email);
check('stesso nome nella STESSA provincia → una sola voce (la più recente)', 1, registro.perNome.get('IISLGIGLI')?.length ?? 0);
check('stesso nome in province DIVERSE → due voci (ambiguo senza provincia)', 2, registro.perNome.get('ICMANZONI')?.length ?? 0);
check('nome troppo corto → null', null, contattoDaStorico(registro, { school_name: 'IC' }));
check('scuola mai vista → null', null, contattoDaStorico(registro, { school_code: 'TOIC84700B' }));
check('storico VUOTO (DB non leggibile) → nessun appiglio', null, contattoDaStorico(REGISTRO_STORICO_VUOTO, { school_code: 'BSIS02900X' }));

console.log('\n— Patch dallo storico: mai sovrascritture —');
check(
  'riga senza recapito → patch con email e PEC',
  { contact_email: 'nuova@gigli.edu.it', school_pec: 'bsis02900x@pec.istruzione.it' },
  patchDaStorico(registro, { school_code: 'BSIS02900X', school_name: "I.I.S. 'L. Gigli'", contact_email: null }),
);
check('riga con recapito → nessuna patch', null, patchDaStorico(registro, { school_code: 'BSIS02900X', contact_email: 'gia@li.it' }));
check(
  'riga con PEC ma senza email → la patch porta solo la email',
  { contact_email: 'nuova@gigli.edu.it' },
  patchDaStorico(registro, { school_code: 'BSIS02900X', contact_email: '', school_pec: 'x@pec.istruzione.it' }),
);
check('nessun match → nessuna patch', null, patchDaStorico(registro, { school_code: 'ZZZZ000000', contact_email: null }));

console.log('\n— Tailoring all\'inserimento (`applicaTailoring`) —');
impostaStoricoContatti(registro);
azzeraRiepilogoTailoring();
const riga1 = applicaTailoring({
  hashId: 'h1',
  title: 'Interpello supplenza A-022',
  schoolCode: null,
  schoolName: "I.I.S. 'L. Gigli'",
  province: 'BS',
  classCodes: ['A-022'],
  contactEmail: null,
  schoolPec: null,
} as never);
check('recuperato dallo storico interno', 'nuova@gigli.edu.it', riga1.contactEmail);
check('PEC osservata riportata sulla riga', 'bsis02900x@pec.istruzione.it', riga1.schoolPec);
const riga2 = applicaTailoring({
  hashId: 'h2',
  title: 'Interpello supplenza A-022',
  schoolCode: 'ASTF01000X',
  schoolName: 'Liceo Augusto Monti',
  province: 'AT',
  classCodes: ['A-022'],
  contactEmail: null,
  schoolPec: null,
} as never);
check('recuperato dalla convenzione MIM sul codice', 'astf01000x@istruzione.it', riga2.contactEmail);
const riga3 = applicaTailoring({
  hashId: 'h3',
  title: 'Interpello supplenza A-022',
  schoolCode: null,
  schoolName: null,
  province: 'AT',
  classCodes: ['A-022'],
  contactEmail: 'fonte@scuola.edu.it',
  schoolPec: null,
} as never);
check('riga già risolta a monte → intatta', 'fonte@scuola.edu.it', riga3.contactEmail);
const riga4 = applicaTailoring({
  hashId: 'h4',
  title: 'Avviso di reclutamento senza scuola, codice e recapito',
  schoolCode: null,
  schoolName: 'Istituto Sconosciuto',
  province: 'AT',
  classCodes: ['A-022'],
  contactEmail: null,
  schoolPec: null,
} as never);
check('nessun appiglio → la riga RESTA com\'è (mai scartata)', 'Avviso di reclutamento senza scuola, codice e recapito', riga4.title);
const riepilogo = riepilogoTailoring();
check('recuperati (storico + convenzione)', 2, riepilogo.recuperati);
check('di cui dallo storico interno', 1, riepilogo.daStorico);
check('di cui dalla convenzione MIM', 1, riepilogo.daConvenzione);
check('righe da revisione interna', 1, riepilogo.daRevisionare);
check('esempio da revisionare riportato (istituto + titolo)', 1, riepilogo.esempi.length);
check('storico del run dichiarato', 5, riepilogo.storicoRighe);

console.log('\n— Contratto di prodotto (§26.68): il recapito non blocca l\'invio —');
check(
  'avviso con link diretto e SENZA recapito → inviabile',
  true,
  avvisoInviabile({ link: 'https://www.usp-asti.gov.it/interpelli/avviso-a022', email: riga4.contactEmail }),
);
check(
  'la mancanza di recapito resta MISURATA (avvertenza, non blocco)',
  'recapito di candidatura mancante',
  avvisoSenzaRecapito({ email: riga4.contactEmail }),
);
check(
  'avviso SENZA link diretto → resta scartato (fonte non verificabile)',
  false,
  avvisoInviabile({ link: 'https://www.scuolainterpelli.it/interpelli-lombardia/', email: 'a@b.it' }),
);

console.log(errori === 0 ? '\n✅ TAILORING: nessun problema' : `\n❌ TAILORING: ${errori} errore/i`);
process.exitCode = errori === 0 ? 0 : 1;

