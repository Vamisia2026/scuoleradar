/**
 * Preferenze Radar — pannello «Province» (dove cercare).
 *
 * Mostra le province selezionate, la ricerca per nome/sigla e il tetto del piano
 * corrente (Base 1 · PRO 4). Presentazione pura: la selezione arriva dal contenitore.
 */
import { MapPin } from 'lucide-react';
import { Accordion } from '@/components/Accordion';
import { province, type Provincia } from '@/data/province';
import { provinciaPrincipale } from '@/lib/provinceRadar';
import type { PianoLimits } from '@/lib/planLimits';
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
  /** Limiti del piano (per il copy Base/PRO). */
  limitiPiano: PianoLimits;
}

export function PannelloProvince({
  accordionAperti,
  toggleAccordion,
  provinceCodici,
  provinceSorted,
  toggleProvincia,
  onPromuoviPrincipale,
  maxProvince,
  limitiPiano,
}: PannelloProvinceProps) {
  /** Prima provincia selezionata = provincia di riferimento del Radar. */
  const principale = provinciaPrincipale(provinceCodici);
  return (
      <Accordion
        icona="📍"
        titolo="Dove vuoi cercare?"
        badge={provinceCodici.length ? `${provinceCodici.length} selezionate` : undefined}
        sommario={
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
        }
        aperto={!!accordionAperti.province}
        onToggle={() => toggleAccordion('province')}
      >
        <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-600">
          {limitiPiano.piano === 'pro'
            ? 'PRO: puoi monitorare fino a 4 province.'
            : `Piano Base: ${maxProvince} provincia monitorabile. Passa a PRO per arrivare a 4.`}
        </p>
        <p className="mb-3 rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs leading-relaxed text-accent-800">
          La prima provincia dell&apos;elenco è la <strong>principale</strong>: è la tua zona di
          riferimento. Tocca la ☆ su un&apos;altra provincia per promuoverla.
        </p>
        {provinceCodici.length > maxProvince && (
          <p className="mb-3 rounded-lg bg-primary-50 px-3 py-2 text-xs leading-relaxed text-primary-600">
            Le province marcate <strong>PRO</strong> restano salvate: con il piano Base il Radar ne
            usa {maxProvince}, e tornano automaticamente attive se riattivi il PRO. Nessuna scelta
            viene cancellata.
          </p>
        )}
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
        <p className="mt-3 text-xs text-primary-500">
          Le province scelte restano in cima come tag: tocca la ✕ per rimuoverle. Il Radar elimina la
          necessità di controllare manualmente decine di siti provinciali.
        </p>
      </Accordion>
  );
}
