/**
 * Campo "Provincia di residenza" (dato demografico di base).
 *
 * Select NATIVA: il dataset ha ~100 voci e la select è navigabile da tastiera e
 * screen reader senza logica custom. Riutilizzata dal form di registrazione
 * (`AuthModal`) e dal mini-onboarding anagrafico (`DatiProfiloModal`).
 * Il valore salvato è il CODICE provincia ('AT', 'RM'), lo stesso formato di
 * `profiles.province_attive`: nessuna conversione a valle.
 */
import { useMemo } from 'react';
import { province } from '@/data/province';

export function CampoProvincia({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (codice: string) => void;
  id?: string;
}) {
  const elenco = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="input">
      <option value="">Non specificata</option>
      {elenco.map((p) => (
        <option key={p.codice} value={p.codice}>
          {p.nome} ({p.codice})
        </option>
      ))}
    </select>
  );
}
