/**
 * Guardia di PERSISTENZA delle preferenze utente (modulo puro, condiviso).
 *
 * Perché esiste. Le preferenze del Radar (classi di concorso, province, ordini,
 * competenze/tag) arrivano da DUE sorgenti — la copia locale del dispositivo
 * (`localStorage`) e la riga `profiles` su Supabase — e vengono scritte da più
 * punti (wizard, Preferenze Radar, `salvaProfilo`). Senza una regola unica, una
 * lettura lenta (o una pagina aperta prima che il profilo sia arrivato) finiva
 * per salvare `[]`/`null` SOPRA dati esistenti: le preferenze dell'utente
 * sparivano da sole, senza che nessuno le avesse cancellate.
 *
 * REGOLA UNICA (due lati, stessa idea):
 *
 *  1. IN LETTURA — il caricamento IDRATA, non svuota. Un valore assente nel
 *     profilo (`null`, `undefined`, `[]`, `''`) significa «nessun dato nel DB»,
 *     NON «cancella quello locale»: `idrataDaProfilo` tiene il valore locale.
 *
 *  2. IN SCRITTURA — si salva SOLO ciò che l'utente ha davvero toccato in questa
 *     sessione (`modificheDaSalvare`, con `toccati` ESPLICITO: la UI registra i
 *     campi su cui l'utente è intervenuto, non li deduce a posteriori
 *     confrontando fotografie che possono essere di passaggi diversi). I campi
 *     mai toccati non entrano nel payload, quindi restano intatti campo per
 *     campo: un autosave non può scrivere un default vuoto sopra una scelta
 *     dell'utente.
 *
 * Conseguenza: una preferenza può cambiare SOLO per un'azione esplicita
 * dell'utente (o dell'admin), mai per un caricamento, un refresh o un default.
 */

/**
 * true se il valore contiene una scelta REALE: array non vuoto, stringa non
 * vuota. `null`, `undefined`, `[]` e `' '` non sono scelte.
 */
export function haContenuto(valore: unknown): boolean {
  if (Array.isArray(valore)) return valore.length > 0;
  if (typeof valore === 'string') return valore.trim().length > 0;
  return valore !== null && valore !== undefined;
}

/**
 * Valore del profilo se ne ha davvero uno, altrimenti il valore locale.
 * `null`/`undefined`/array vuoto NON cancellano mai il valore locale.
 */
export function idrataDaProfilo<T>(daProfilo: readonly T[] | null | undefined, locale: T[]): T[] {
  return daProfilo && haContenuto(daProfilo) ? [...daProfilo] : locale;
}

/**
 * Uguaglianza per i tipi che compongono le preferenze (stringhe, array di
 * stringhe, booleani, numeri): confronto stabile e deterministico, usato per
 * capire se un campo è cambiato rispetto all'idratazione.
 */
export function preferenzeUguali(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/**
 * MODIFICHE DA SALVARE — il payload di autosave ridotto all'osso.
 *
 * `toccati` è l'elenco dei campi su cui l'utente è intervenuto in QUESTA sessione
 * (registrato dalla UI al momento dell'azione): un campo che non compare
 * nell'elenco non entra mai nel salvataggio. Di quei campi si scrive il valore
 * locale solo se differisce da quello già salvato nel contesto — così un
 * salvataggio non riscrive valori identici (niente riscritture inutili, niente
 * cicli di autosave) e, soprattutto, i campi mai toccati non possono
 * sovrascrivere i dati esistenti.
 *
 * Restituisce un oggetto VUOTO quando non c'è nulla da salvare: il chiamante
 * controlla `Object.keys(...).length === 0` e non effettua alcuna scrittura.
 *
 * Il parametro generico è il tipo delle preferenze del chiamante
 * (`modificheDaSalvare<Preferenze>(...)`), così il risultato si può spargere in
 * un payload completo senza cast a mano.
 */
export function modificheDaSalvare<P extends object>(
  toccati: Iterable<string>,
  locale: object,
  salvate: object,
): Partial<P> {
  const valori = locale as unknown as Record<string, unknown>;
  const attuali = salvate as unknown as Record<string, unknown>;
  const modifiche: Record<string, unknown> = {};
  for (const campo of toccati) {
    if (!(campo in valori)) continue;
    if (preferenzeUguali(valori[campo], attuali[campo])) continue;
    modifiche[campo] = valori[campo];
  }
  return modifiche as Partial<P>;
}

