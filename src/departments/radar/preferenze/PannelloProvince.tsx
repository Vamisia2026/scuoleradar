/**
 * Preferenze Radar — pannello «Province» (dove cercare).
 *
 * Mostra le province selezionate e la ricerca per nome/sigla. Presentazione pura:
 * la selezione arriva dal contenitore.
 *
 * §26.150 — SOTTO LE PILLOLE C'È IL PERIMETRO, NON UN TESTO DECORATIVO. Il pannello resta
 * asciutto (una riga di `text-[11px]`), ma quella riga è necessaria: è l'unico posto in cui
 * l'utente può capire perché togliere una provincia non fa scendere le opportunità. La frase
 * arriva da `lib/perimetroRicerca` — la stessa funzione che il feed usa per la query — e
 * nomina le province entro i 60 km con i chilometri dal capoluogo principale.
 */
import { MapPin } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { province, type Provincia } from '@/data/province';
import { frasePerimetro, perimetroRicerca } from '@/lib/perimetroRicerca';
import { limitaSelezione } from '@/lib/planLimits';
import { provinciaPrincipale } from '@/lib/provinceRadar';
import { ProvinciaPill } from '../components/ProvinciaPill';

interface PannelloProvinceProps {
  /** Mappa di apertura degli accordion (chiave → stato). */
  accordionAperti: Record<string, boolean>;
  /** Apre/chiude un accordion per chiave. */
  toggleAccordion: (chiave: string) => void;
  /** Codici delle province selezionate. */
  provinceCodici: string[];
  /** Elenco province già ordinato per nome. */
  provinceSorted: Provincia[];
  /** Aggiunge/rimuove una provincia dalla selezione. */
  toggleProvincia: (codice: string) => void;
  /** Promuove una provincia di contorno a provincia PRINCIPALE (prima della lista). */
  onPromuoviPrincipale: (codice: string) => void;
  /** Tetto di province del piano corrente. */
  maxProvince: number;
}

export function PannelloProvince({
  accordionAperti,
  toggleAccordion,
  provinceCodici,
  provinceSorted,
  toggleProvincia,
  onPromuoviPrincipale,
  maxProvince,
}: PannelloProvinceProps) {
  /** Prima provincia selezionata = provincia di riferimento del Radar. */
  const principale = provinciaPrincipale(provinceCodici);
  /**
   * §26.150 — IL PERIMETRO, DETTO DOVE SI SCEGLIE. Deselezionare non restringe la ricerca come
   * ci si aspetta: il raggio dei 60 km parte dalla PRINCIPALE e riammette le vicine (Asti →
   * Alessandria 32 km, Torino 46 km, Vercelli 51 km). Qui la frase si aggiorna a ogni clic,
   * con i nomi e i chilometri: l'utente vede il perimetro che sta costruendo invece di
   * scoprirlo da un conteggio che non scende. Le province oltre il tetto del piano restano
   * salvate ma non attive: entrano nella frase solo quelle davvero in uso.
   */
  const perimetro = perimetroRicerca(limitaSelezione(provinceCodici, maxProvince));
  return (
      <Accordion
        icona="📍"
        titolo="Dove vuoi cercare?"
        badge={provinceCodici.length ? `${provinceCodici.length} selezionate` : undefined}
        sommario={
          <>
            <div className="flex flex-wrap gap-1.5">
              {provinceCodici.length === 0 ? (
                <span className="text-xs text-primary-400">
                  Nessuna provincia selezionata: aggiungila dal menu qui sotto.
                </span>
              ) : (
                provinceCodici.map((c, indice) => (
                  <ProvinciaPill
                    key={c}
                    nome={province.find((p) => p.codice === c)?.nome ?? c}
                    codice={c}
                    principale={c === principale}
                    inAttesa={indice >= maxProvince}
                    onRimuovi={() => toggleProvincia(c)}
                    onPromuovi={() => onPromuoviPrincipale(c)}
                  />
                ))
              )}
            </div>
            {provinceCodici.length > 0 && (
              <p className="mt-2 text-[11px] leading-relaxed text-primary-500">
                {frasePerimetro(perimetro)}
              </p>
            )}
          </>
        }
        aperto={!!accordionAperti.province}
        onToggle={() => toggleAccordion('province')}
      >
        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-primary-700">
            <MapPin className="h-4 w-4 text-primary-500" />
            Aggiungi una provincia
          </span>
          <select
            value=""
            disabled={provinceCodici.length >= maxProvince}
            onChange={(e) => {
              const valore = e.target.value;
              if (valore) toggleProvincia(valore);
            }}
            aria-label="Aggiungi una provincia"
            className="input"
          >
            <option value="">
              {provinceCodici.length >= maxProvince
                ? 'Limite province raggiunto'
                : 'Scegli una provincia…'}
            </option>
            {provinceSorted
              .filter((p) => !provinceCodici.includes(p.codice))
              .map((p) => (
                <option key={p.codice} value={p.codice}>
                  {p.nome} ({p.codice})
                </option>
              ))}
          </select>
        </label>
      </Accordion>
  );
}
