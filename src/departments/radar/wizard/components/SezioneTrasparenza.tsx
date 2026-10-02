/**
 * Wizard Radar — PASSO 4 · blocco «Cosa fa il tuo Radar, in chiaro» (trasparenza).
 *
 * È il rovescio esatto del copy competitivo: nessuna promessa di vantaggio sui
 * colleghi, nessuna urgenza. Dichiara con i DATI REALI scelti dall'utente che cosa
 * cerca il Radar (province, classi di concorso, competenze e parole chiave) e che
 * cosa gli arriva: avviso Telegram nell'istante in cui la scuola lo pubblica, UNA
 * sola email al giorno, al massimo `MAX_INVII_OPPORTUNITA` volte la stessa
 * opportunità in giorni diversi, sempre con il link all'annuncio ufficiale.
 *
 * Presentazione pura: codici e id arrivano dal passo (che li riceve dal
 * contenitore); le etichette leggibili si risolvono qui dai cataloghi condivisi,
 * come fanno gli altri passi del wizard. Nessun dato in chiaro nel sorgente: il
 * riepilogo è sempre quello dell'utente, non un esempio.
 */
import { MapPin, Search, ShieldCheck } from 'lucide-react';
import { etichettaClasseMateria } from '@/data/classiConcorso';
import { materie } from '@/data/ordiniMaterie';
import { province } from '@/data/province';
import { MAX_INVII_OPPORTUNITA } from '@/lib/frequenzaNotifiche';

/** Etichette elencate per riga: oltre, si riassume con «e N altre». */
const MAX_ETICHETTE = 4;

interface SezioneTrasparenzaProps {
  selezione: {
    /** Codici provincia scelti al Passo 1. */
    provinceCodici: string[];
    /** Codici classe di concorso scelti al Passo 3. */
    classiCodici: string[];
    /** Competenze e laboratori extra scelti dai tag del Passo 3. */
    materieId: string[];
    /** Parole chiave libere scritte dall'utente nel Passo 3. */
    materieCustom: string[];
  };
}

/** Etichette leggibili: oltre `MAX_ETICHETTE` si conta il resto invece di elencarlo. */
function elenco(etichette: string[]): string {
  if (etichette.length <= MAX_ETICHETTE) return etichette.join(', ');
  const restanti = etichette.length - MAX_ETICHETTE;
  return `${etichette.slice(0, MAX_ETICHETTE).join(', ')} e ${restanti} ${restanti === 1 ? 'altra' : 'altre'}`;
}

/** «1 provincia» / «3 province»: il numero resta leggibile, senza parentesi. */
function conteggio(quanti: number, singolare: string, plurale: string): string {
  return `${quanti} ${quanti === 1 ? singolare : plurale}`;
}

export function SezioneTrasparenza({ selezione }: SezioneTrasparenzaProps) {
  const nomiProvince = selezione.provinceCodici.map(
    (codice) => province.find((p) => p.codice === codice)?.nome ?? codice,
  );
  /** Etichetta canonica `CODICE - Denominazione`, la stessa usata da notifiche e schede. */
  const nomiClassi = selezione.classiCodici.map((codice) => etichettaClasseMateria(codice));
  const nomiMaterie = [
    ...selezione.materieId.map((id) => materie.find((m) => m.id === id)?.nome ?? id),
    ...selezione.materieCustom,
  ];

  return (
    <section className="mt-2.5 rounded-xl border border-primary-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-sm font-bold text-primary-800">
        <ShieldCheck className="h-4 w-4 text-primary-600" />
        Cosa fa il tuo Radar, in chiaro
      </p>

      {/*
        Le righe del riepilogo compaiono sempre: se il profilo è ancora incompleto
        il blocco lo dice, invece di sparire (l'utente deve sapere che cosa manca
        perché la ricerca parta). I dati sono quelli reali, mai un esempio.
      */}
      <ul className="mt-1 space-y-1 text-xs leading-relaxed text-primary-600">
        <li className="flex gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" />
          <span>
            <strong className="font-semibold text-primary-800">Dove cerca:</strong>{' '}
            {nomiProvince.length === 0 && nomiClassi.length === 0 ? (
              <>
                mancano i due dati che accendono la ricerca — scegli almeno una provincia e una
                classe di concorso nei passi precedenti.
              </>
            ) : (
              <>
                {nomiProvince.length > 0 && (
                  <>
                    {conteggio(nomiProvince.length, 'provincia', 'province')} —{' '}
                    {elenco(nomiProvince)}
                  </>
                )}
                {nomiProvince.length > 0 && nomiClassi.length > 0 && '. '}
                {nomiClassi.length > 0 && (
                  <>
                    {conteggio(nomiClassi.length, 'classe di concorso', 'classi di concorso')} —{' '}
                    {elenco(nomiClassi)}
                  </>
                )}
              </>
            )}
          </span>
        </li>
        {nomiMaterie.length > 0 && (
          <li className="flex gap-1.5">
            <Search className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" />
            <span>
              <strong className="font-semibold text-primary-800">Competenze e parole chiave:</strong>{' '}
              {elenco(nomiMaterie)}
            </span>
          </li>
        )}
        <li className="flex gap-1.5">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" />
          <span>
            <strong className="font-semibold text-primary-800">Quante volte ti scriviamo:</strong>{' '}
            l&apos;avviso su Telegram nell&apos;istante in cui la scuola lo pubblica; per email una
            sola consegna al giorno, e solo se ci sono opportunità nuove. La stessa opportunità
            torna al massimo {MAX_INVII_OPPORTUNITA} volte, in giorni diversi, e ogni segnalazione
            porta il link all&apos;annuncio ufficiale della scuola.
          </span>
        </li>
      </ul>

      <p className="mt-2 border-t border-primary-100 pt-2 text-[11px] leading-relaxed text-primary-500">
        Province, classi, competenze e canali si cambiano quando vuoi dal tuo profilo: il Radar usa
        sempre le impostazioni che trovi lì.
      </p>
    </section>
  );
}
