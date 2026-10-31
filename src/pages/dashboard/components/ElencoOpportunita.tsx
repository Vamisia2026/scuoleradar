/**
 * Dashboard · «Opportunità mappate» (accordion console con le card avviso).
 *
 * Tre stati: invito a completare il profilo (utente loggato senza preferenze),
 * coda vuota con le etichette dei filtri del profilo, elenco delle card con il
 * badge della scadenza. Il badge NON ha una palette propria: usa
 * `lib/scadenzaSemaforo.stileScadenza` (rosso < 24h · arancio 24–72h · verde in
 * corso · ardesia per scaduto/assente/fuori finestra, §26.89). Per gli utenti
 * Base l'accordion resta bloccato: badge «🔒 PRO» e click che apre la vetrina.
 *
 * UNA SOLA TINTA PER RIGA (§26.120). La riga dell'accordion dichiara il MATCH col
 * colore condiviso di `lib/compatibilita.stileMatch` — verde #1FA055 (≥ 80),
 * giallo #E2B33C (70-79), neutro < 70 — e una riga entrata dal paracadute «5
 * osso-da-mordere» mostra l'etichetta trasparente «Opportunità di ripiego nel DB».
 * La SCADENZA non viene più ripetuta qui: la dichiara la card, con il semaforo
 * unico dell'applicazione. Prima questa riga sommava un secondo badge a tinta
 * piena — rosso quando mancavano 24 ore — sopra una card che mostrava già il
 * proprio: due codifiche di colore per la stessa card, e l'impressione che tutto
 * stesse per scadere.
 *
 * Presentazione pura: dati, stato di apertura e azioni arrivano dal contenitore.
 */
import { SlidersHorizontal } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { InterpelloCard } from '@/components/InterpelloCard';
import { ETICHETTA_AMBITO, descrizioneAmbito } from '@/lib/ambitoBacheca';
import { stileMatch } from '@/lib/compatibilita';
import { classeByCodice } from '@/data/classiConcorso';
import { province } from '@/data/province';
import type { Interpello } from '@/data/interpelli';

interface ElencoOpportunitaProps {
  /** Opportunità da mostrare (già filtrate, ordinate e limitate al piano). */
  lista: Interpello[];
  /** Totale delle opportunità attive (badge dell'accordion). */
  totale: number;
  /** Stato dell'accordion (console chiusa di default). */
  accordion: { aperto: boolean; onToggle: () => void };
  /** Accesso PRO: abilita elenco e conteggio, altrimenti badge di blocco. */
  hasAccessoPro: boolean;
  /** true quando l'utente è loggato ma non ha ancora configurato il profilo. */
  mostraInvitoProfilo: boolean;
  /** Apre la configurazione del profilo (CTA «Completa il profilo»). */
  onCompletaProfilo: () => void;
  /** Filtri del profilo, per le etichette dello stato vuoto. */
  filtri: { classiCodici: string[]; provinceCodici: string[] };
}

export function ElencoOpportunita({
  lista,
  totale,
  accordion,
  hasAccessoPro,
  mostraInvitoProfilo,
  onCompletaProfilo,
  filtri,
}: ElencoOpportunitaProps) {
  const { classiCodici, provinceCodici } = filtri;
  const { aperto, onToggle } = accordion;

  // Etichette per lo stato vuoto del Radar (dalle preferenze dell'utente).
  const classeEtichetta = classiCodici
    .map((c) => classeByCodice(c)?.denominazione ?? c)
    .filter(Boolean)
    .join(', ');
  const provinciaEtichetta = provinceCodici
    .map((c) => province.find((p) => p.codice === c)?.nome ?? c)
    .filter(Boolean)
    .join(', ');

  // Righe fuori dalla propria provincia (§26.111): la vetrina le dichiara in testa
  // all'elenco, così l'integrazione regionale/nazionale non è mai silenziosa.
  const fuoriAmbito = lista.filter(
    (i) => i.ambito === 'regione' || i.ambito === 'nazionale',
  ).length;

  return (
      <Accordion
        icona="📡"
        titolo="Opportunità mappate"
        badge={
          hasAccessoPro
            ? `${totale} ${
                totale === 1 ? 'opportunità attiva' : 'opportunità attive'
              }`
            : '🔒 PRO'
        }
        aperto={aperto}
        onToggle={onToggle}
      >
        {mostraInvitoProfilo ? (
          <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-center">
            <p className="text-sm text-primary-600">
              Configura prima il tuo profilo: il Radar potrà mostrarti le opportunità che ti
              riguardano davvero.
            </p>
            <button
              type="button"
              onClick={onCompletaProfilo}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Completa il profilo
            </button>
          </div>
        ) : totale === 0 ? (
          <div className="rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-center text-sm text-primary-600">
            Nessuna nuova opportunità attiva al momento
            {classeEtichetta ? ` per ${classeEtichetta}` : ''}
            {provinciaEtichetta ? ` in ${provinciaEtichetta}` : ''}.
          </div>
        ) : (
          <div className="animate-fade-in space-y-3">
            {fuoriAmbito > 0 && (
              <p className="rounded-xl border border-primary-100 bg-primary-50 px-3 py-2 text-[11px] leading-relaxed text-primary-600">
                Le {fuoriAmbito}{' '}
                {fuoriAmbito === 1 ? 'opportunità segnalata' : 'opportunità segnalate'} come «
                {ETICHETTA_AMBITO.regione}» o «{ETICHETTA_AMBITO.nazionale}» arrivano da fuori
                dalla tua provincia: la tua zona ha meno di 5 opportunità attive, quindi il Radar
                allarga la ricerca — e lo dichiara, invece di lasciare la pagina vuota.
              </p>
            )}
            {lista.map((i) => {
              // COLOR CODING DEL MATCH (§26.106 · §26.120): UNA sola tinta per riga,
              // verde ≥ 80 · giallo 70-79 · neutra < 70 (< 70 = riga di ripiego, si
              // dichiara con l'etichetta trasparente, non con un allarme).
              const match = stileMatch(i.compatibilita, { ripiego: i.ripiego === true });
              // AMBITO (§26.111): una riga fuori provincia dichiara il suo ambito al posto
              // del voto — non è stata valutata sul profilo, quindi non ha un punteggio.
              const ambito =
                i.ambito === 'regione' || i.ambito === 'nazionale' ? i.ambito : null;
              return (
                <div
                  key={i.id}
                  className="overflow-hidden rounded-2xl border border-primary-100 bg-white shadow-card"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-primary-100 px-3 py-1.5">
                    {ambito ? (
                      <span
                        title={descrizioneAmbito(ambito)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-600"
                      >
                        <span aria-hidden className="inline-block h-2 w-2 rounded-full bg-primary-400" />
                        {ETICHETTA_AMBITO[ambito]}
                      </span>
                    ) : (
                      <span
                        title={match.descrizione}
                        className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary-500"
                      >
                        <span aria-hidden className={`inline-block h-2 w-2 rounded-full ${match.className}`} />
                        {match.etichetta} · {match.punteggio}%
                      </span>
                    )}
                  </div>
                  <InterpelloCard interpello={i} />
                </div>
              );
            })}
          </div>
        )}
      </Accordion>
  );
}
