/**
 * Preferenze Radar — tutte le impostazioni e i filtri del profilo, spostati
 * sotto Radar Scuole (bacheca unificata). Include: Ordini e Tipologie di Scuola,
 * Classi di Concorso, Materie e Competenze, Province ("Dove vuoi cercare?"), Filtri
 * Avanzati Scuole, Canali di Notifica e Telegram.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useApp, type Preferenze } from '@/contexts/AppContext';
import { supabase } from '@/lib/supabase';
import { classiConcorso } from '@/data/classiConcorso';
import type { OrdineScuola } from '@/data/ordiniMaterie';
import { province } from '@/data/province';
import { pianoLimits } from '@/lib/planLimits';
import { normalizzaClasse, normalizzaClassi } from '@/lib/matchingEngine';
import { promuoviProvinciaPrincipale } from '@/lib/provinceRadar';
import {
  cercaCompetenzeParole,
  classeCorrispondeAQuery,
  separaParoleChiave,
  type SuggerimentoSelezione
} from '@/lib/ricercaSelezioniRadar';
import { PannelloCanali } from './preferenze/PannelloCanali';
import { PannelloClassi } from './preferenze/PannelloClassi';
import { PannelloFiltriScuole } from './preferenze/PannelloFiltriScuole';
import { PannelloMaterie } from './preferenze/PannelloMaterie';
import { PannelloOrdini } from './preferenze/PannelloOrdini';
import { PannelloProvince } from './preferenze/PannelloProvince';

export function PreferenzeRadar() {
  const { preferenze, setPreferenze, salvaProfilo, piano, hasProAccess, pianoStato, interpelliFiltrati } = useApp();

  // Limiti del piano corrente (Base: 1 provincia / 2 classi · PRO: 4/4).
  const limitiPiano = pianoLimits(piano, hasProAccess, pianoStato === 'pronto');
  const maxProvince = limitiPiano.maxProvince;
  const maxClassiConcorso = limitiPiano.maxClassiConcorso;

  const [ordini, setOrdini] = useState<OrdineScuola[]>(preferenze.ordini);
  const [classiCodici, setClassiCodici] = useState<string[]>(
    normalizzaClassi(preferenze.classiCodici),
  );
  const [materieId, setMaterieId] = useState<string[]>(preferenze.materieId);
  const [materieCustom, setMaterieCustom] = useState<string[]>(preferenze.materieCustom);
  
  // AREA SOSTEGNO: SEMPRE inclusa — non è più una preferenza dell'utente e non
  // esiste alcuna uscita. Il valore è costante e viene riallineato a `true` a
  // ogni salvataggio (guarigione delle righe storiche con `sostegno = false`).
  const sostegno = true;
  const [provinceCodici, setProvinceCodici] = useState<string[]>(preferenze.provinceCodici);
  const [telegramUsername, setTelegramUsername] = useState(preferenze.telegramUsername);
  const [telegramChatIdInput, setTelegramChatIdInput] = useState(preferenze.telegramChatId ?? '');

  const [telegramDeepLink, setTelegramDeepLink] = useState('https://t.me/ScuoleRadar_bot');
  useEffect(() => {
    if (!supabase) return;
    let attivo = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (attivo && data.user) {
          setTelegramDeepLink(`https://t.me/ScuoleRadar_bot?start=${data.user.id}`);
        }
      })
      .catch(() => undefined);
    return () => {
      attivo = false;
    };
  }, []);

  const [emailNotifica, setEmailNotifica] = useState(preferenze.emailNotifica);
  const [favoriteSchools, setFavoriteSchools] = useState<string[]>(preferenze.favoriteSchools);
  const [ignoredSchools, setIgnoredSchools] = useState<string[]>(preferenze.ignoredSchools);
  const [favoriteScuolaInput, setFavoriteScuolaInput] = useState('');
  const [ignoredScuolaInput, setIgnoredScuolaInput] = useState('');

  const [queryClasse, setQueryClasse] = useState('');
  const [materiaFilter, setMateriaFilter] = useState('');
  const [querySelezioni, setQuerySelezioni] = useState('');
  const [statoSalvataggio, setStatoSalvataggio] = useState<'idle' | 'salvataggio' | 'salvato'>('idle');
  const primaEsecuzione = useRef(true);

  const [accordionAperti, setAccordionAperti] = useState<Record<string, boolean>>({
    ordini: false,
    classi: false,
    materie: false,
    province: false,
    filtri: false,
    canali: false,
  });
  const toggleAccordion = (chiave: string) => 
    setAccordionAperti((prev) => ({ ...prev, [chiave]: !prev[chiave] }));

  const provinceSorted = useMemo(() => [...province].sort((a, b) => a.nome.localeCompare(b.nome)), []);
  const scuoleConosciute = useMemo(
    () => [...new Set(interpelliFiltrati.map((i) => i.istituto).filter(Boolean))],
    [interpelliFiltrati],
  );
  const classiFiltrate = useMemo(() => {
    let list = classiConcorso;
    if (materiaFilter) list = list.filter((c) => c.materie.includes(materiaFilter));
    if (queryClasse.trim()) {
      // TOLLERANZA DI FORMATO: `a19` ≡ `A19` ≡ `A-19` ≡ `a-19` ≡ `  a 19  `
      // (una sola regola, condivisa con wizard e onboarding).
      list = list.filter((c) => classeCorrispondeAQuery(c, queryClasse));
    }
    return list;
  }, [queryClasse, materiaFilter]);

  const labelClasse = (codice: string): string => {
    const canonico = normalizzaClasse(codice);
    const d = classiConcorso.find((c) => c.codice === canonico)?.denominazione ?? '';
    return d ? `${canonico} · ${d.length > 44 ? `${d.slice(0, 42)}…` : d}` : canonico;
  };

  const toggleOrdine = (id: OrdineScuola) => 
    setOrdini((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));

  const toggleClasse = (codice: string) => {
    const canonico = normalizzaClasse(codice);
    if (!canonico) return;
    const attuale = normalizzaClassi(classiCodici);
    if (attuale.includes(canonico)) {
      setClassiCodici(attuale.filter((c) => c !== canonico));
      return;
    }
    if (attuale.length >= maxClassiConcorso) return;
    setClassiCodici([...attuale, canonico]);
  };

  const toggleMateria = (id: string) => 
    setMaterieId((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const aggiungiCompetenzaSuggerita = (materiaId: string) => 
    setMaterieId((prev) => (prev.includes(materiaId) ? prev : [...prev, materiaId]));

  // COLONNA DI DESTRA (competenze e parole chiave): NESSUNA classe di concorso
  // negli esiti — le classi si scelgono nel campo dedicato a sinistra («Classi di
  // concorso»), così i due campi restano nettamente separati e non mostrano gli
  // stessi risultati. Stesso motore del wizard, un solo punto di verità.
  const gruppiSelezioni = useMemo(
    () => cercaCompetenzeParole(querySelezioni, { classiCodici, materieId, materieCustom }),
    [querySelezioni, classiCodici, materieId, materieCustom],
  );

  const scegliSelezione = (suggerimento: SuggerimentoSelezione) => {
    if (suggerimento.tipo === 'classe') {
      toggleClasse(suggerimento.chiave);
      return;
    }
    if (suggerimento.tipo === 'competenza') {
      aggiungiCompetenzaSuggerita(suggerimento.chiave);
      return;
    }
    aggiungiParolaChiave(suggerimento.chiave);
  };

  const aggiungiParolaChiave = (testo: string) => {
    setQuerySelezioni('');
    const nuove = separaParoleChiave(testo).filter(
      (voce) => !materieCustom.some((m) => m.toLowerCase() === voce.toLowerCase()),
    );
    if (nuove.length === 0) return;
    setMaterieCustom((prev) => [...prev, ...nuove]);
  };

  const removeCustomMateria = (m: string) => setMaterieCustom((prev) => prev.filter((x) => x !== m));

  const toggleProvincia = (codice: string) => {
    if (provinceCodici.includes(codice)) {
      setProvinceCodici((prev) => prev.filter((c) => c !== codice));
      return;
    }
    if (provinceCodici.length >= maxProvince) return;
    setProvinceCodici((prev) => [...prev, codice]);
  };

  const promuoviPrincipale = (codice: string) => 
    setProvinceCodici((prev) => promuoviProvinciaPrincipale(prev, codice));

  const addFavoriteScuola = () => {
    const val = favoriteScuolaInput.trim();
    if (!val) return;
    if (!favoriteSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setFavoriteSchools((prev) => [...prev, val]);
    }
    setFavoriteScuolaInput('');
  };

  const removeFavoriteScuola = (s: string) => setFavoriteSchools((prev) => prev.filter((x) => x !== s));

  const addIgnoredScuola = () => {
    const val = ignoredScuolaInput.trim();
    if (!val) return;
    if (!ignoredSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      setIgnoredSchools((prev) => [...prev, val]);
    }
    setIgnoredScuolaInput('');
  };

  const removeIgnoredScuola = (s: string) => setIgnoredSchools((prev) => prev.filter((x) => x !== s));

  useEffect(() => {
    if (pianoStato !== 'pronto') return;
    setClassiCodici((prev) => prev.length > maxClassiConcorso ? prev.slice(0, maxClassiConcorso) : prev);
    setProvinceCodici((prev) => prev.length > maxProvince ? prev.slice(0, maxProvince) : prev);
  }, [pianoStato, maxProvince, maxClassiConcorso]);

  useEffect(() => {
    if (primaEsecuzione.current) {
      primaEsecuzione.current = false;
      return;
    }
    const modifiche: Preferenze = {
      ordini,
      classiCodici,
      materieId,
      materieCustom,
      provinceCodici,
      telegramUsername: telegramUsername.trim(),
      telegramChatId: telegramChatIdInput.trim(),
      emailNotifica: emailNotifica.trim(),
      onboarded: preferenze.onboarded,
      favoriteSchools,
      ignoredSchools,
      sostegno,
    };
    setStatoSalvataggio('salvataggio');
    const timeout = setTimeout(() => {
      setPreferenze(modifiche);
      void salvaProfilo(modifiche).then(() => {
        setStatoSalvataggio('salvato');
        setTimeout(() => setStatoSalvataggio('idle'), 2500);
      });
    }, 500);
    return () => clearTimeout(timeout);
  }, [
    ordini,
    classiCodici,
    materieId,
    materieCustom,
    provinceCodici,
    telegramUsername,
    telegramChatIdInput,
    emailNotifica,
    favoriteSchools,
    ignoredSchools,
    sostegno,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Le tue preferenze Radar</h1>
        {statoSalvataggio === 'salvataggio' ? (
          <span className="flex items-center text-sm text-slate-500">
            <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvataggio in corso...
          </span>
        ) : statoSalvataggio === 'salvato' ? (
          <span className="flex items-center text-sm text-emerald-600 font-medium">
            <Check className="w-4 h-4 mr-1" /> Salvato ✓
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:items-start">
        <PannelloOrdini
          accordionAperti={accordionAperti}
          toggleAccordion={toggleAccordion}
          ordini={ordini}
          toggleOrdine={toggleOrdine}
        />

        <PannelloClassi
          accordionAperti={accordionAperti}
          toggleAccordion={toggleAccordion}
          classiCodici={classiCodici}
          classiFiltrate={classiFiltrate}
          labelClasse={labelClasse}
          materiaFilter={materiaFilter}
          setMateriaFilter={setMateriaFilter}
          queryClasse={queryClasse}
          setQueryClasse={setQueryClasse}
          maxClassiConcorso={maxClassiConcorso}
          toggleClasse={toggleClasse}
          limitiPiano={limitiPiano}
        />

        <PannelloMaterie
          accordionAperti={accordionAperti}
          toggleAccordion={toggleAccordion}
          materieId={materieId}
          materieCustom={materieCustom}
          querySelezioni={querySelezioni}
          setQuerySelezioni={setQuerySelezioni}
          gruppiSelezioni={gruppiSelezioni}
          onScegliSelezione={scegliSelezione}
          onParolaChiave={aggiungiParolaChiave}
          removeCustomMateria={removeCustomMateria}
          toggleMateria={toggleMateria}
          aggiungiCompetenzaSuggerita={aggiungiCompetenzaSuggerita}
        />

        <PannelloProvince
          accordionAperti={accordionAperti}
          toggleAccordion={toggleAccordion}
          provinceCodici={provinceCodici}
          provinceSorted={provinceSorted}
          toggleProvincia={toggleProvincia}
          onPromuoviPrincipale={promuoviPrincipale}
          maxProvince={maxProvince}
        />

        <PannelloFiltriScuole
          accordionAperti={accordionAperti}
          toggleAccordion={toggleAccordion}
          favoriteSchools={favoriteSchools}
          favoriteScuolaInput={favoriteScuolaInput}
          setFavoriteScuolaInput={setFavoriteScuolaInput}
          addFavoriteScuola={addFavoriteScuola}
          removeFavoriteScuola={removeFavoriteScuola}
          ignoredSchools={ignoredSchools}
          ignoredScuolaInput={ignoredScuolaInput}
          setIgnoredScuolaInput={setIgnoredScuolaInput}
          addIgnoredScuola={addIgnoredScuola}
          removeIgnoredScuola={removeIgnoredScuola}
          scuoleConosciute={scuoleConosciute}
        />

        <PannelloCanali
          accordionAperti={accordionAperti}
          toggleAccordion={toggleAccordion}
          preferenze={preferenze}
          telegramDeepLink={telegramDeepLink}
          telegramUsername={telegramUsername}
          setTelegramUsername={setTelegramUsername}
          telegramChatIdInput={telegramChatIdInput}
          setTelegramChatIdInput={setTelegramChatIdInput}
          emailNotifica={emailNotifica}
          setEmailNotifica={setEmailNotifica}
        />
      </div>
    </div>
  );
}