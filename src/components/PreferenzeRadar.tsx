/**
 * ScuoleRadar.it — Componente Preferenze Radar
 * Gestione delle preferenze utente (province seguite, notifiche e filtri).
 */

import React, { useState, useEffect } from 'react';
import { province } from '../data/province';

interface PreferenzeRadarProps {
  onSalva?: (provinceSelezionate: string[]) => void;
}

export default function PreferenzeRadar({ onSalva }: PreferenzeRadarProps) {
  const [selezionate, setSelezionate] = useState<string[]>([]);
  const [salvato, setSalvato] = useState(false);

  useEffect(() => {
    // Caricamento iniziale da localStorage se disponibile
    const salvate = localStorage.getItem('scuoleradar_province_preferite');
    if (salvate) {
      try {
        setSelezionate(JSON.parse(salvate));
      } catch {
        // Ignora errori di parsing
      }
    }
  }, []);

  const toggleProvincia = (sigla: string) => {
    const aggiornate = selezionate.includes(sigla)
      ? selezionate.filter((s) => s !== sigla)
      : [...selezionate, sigla];
    setSelezionate(aggiornate);
  };

  const handleSalva = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('scuoleradar_province_preferite', JSON.stringify(selezionate));
    setSalvato(true);
    if (onSalva) onSalva(selezionate);
    setTimeout(() => setSalvato(false), 2500);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-bold text-slate-800 mb-2">Preferenze Bacheca Radar</h2>
      <p className="text-sm text-slate-600 mb-6">
        Seleziona le province di tuo interesse per filtrare rapidamente gli interpelli attivi nella tua zona.
      </p>

      <form onSubmit={handleSalva}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-64 overflow-y-auto p-2 border border-slate-100 rounded-lg mb-6 bg-slate-50">
          {province.map((p) => {
            const attiva = selezionate.includes(p.codice);
            return (
              <button
                key={p.codice}
                type="button"
                onClick={() => toggleProvincia(p.codice)}
                className={`flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors ${
                  attiva
                    ? 'bg-blue-600 text-white font-medium shadow-sm'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{p.nome}</span>
                <span className="text-xs uppercase opacity-75">{p.codice}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Province selezionate: <strong>{selezionate.length}</strong>
          </span>
          <button
            type="submit"
            className="px-5 py-2 bg-slate-900 text-white font-medium text-sm rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            {salvato ? 'Salvato!' : 'Salva preferenze'}
          </button>
        </div>
      </form>
    </div>
  );
}