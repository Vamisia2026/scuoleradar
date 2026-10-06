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
import { ambitoScuola, suggerimentiScuole } from '@/lib/filtriScuole';
import { provinceSuggerite, scuolePresentabili } from '@/lib/scuolePresentabili';
import { provinceDiRicerca } from '@/lib/prossimitaGeografica';
import { promuoviProvinciaPrincipale } from '@/lib/provinceRadar';
import { modificheDaSalvare } from '@/lib/preferenzeGuardia';
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

/**
 * Campi del pannello in forma CONFRONTABILE (guardia di persistenza).
 * È il sottoinsieme di `Preferenze` che l'utente modifica da qui: gli altri
 * (genere, età, provincia di residenza, `onboarded`) non hanno controlli in
 * questa schermata e non devono mai entrare in un payload di autosave.
 */
interface FotoCampi {
  ordini: OrdineScuola[];
  classiCodici: string[];
  materieId: string[];
  materieCustom: string[];
  provinceCodici: string[];
  telegramUsername: string;
  telegramChatId: string;
  emailNotifica: string;
  favoriteSchools: string[];
  ignoredSchools: string[];
}

/**
 * Campo del pannello che l'utente può modificare: sono le chiavi della guardia
 * di persistenza (`toccatiRef`), quindi l'unico insieme di nomi ammesso nel
 * salvataggio.
 */
type CampoToccabile = keyof FotoCampi;

/**
 * Fotografia confrontabile dei campi del pannello: la usano sia l'idratazione
 * dal profilo (lato lettura) sia la costruzione del payload di autosave (lato
 * scrittura). Filtra il rumore di formato (classi nel formato canonico, `trim`
 * dei testi), così il confronto tra «ciò che l'utente ha scelto» e «ciò che è
 * già salvato» (`modificheDaSalvare`) non produce differenze inesistenti.
 */
function fotoCampi(f: FotoCampi): FotoCampi {
  return {
    ordini: f.ordini,
    classiCodici: normalizzaClassi(f.classiCodici),
    materieId: f.materieId,
    materieCustom: f.materieCustom,
    provinceCodici: f.provinceCodici,
    telegramUsername: (f.telegramUsername ?? '').trim(),
    telegramChatId: (f.telegramChatId ?? '').trim(),
    emailNotifica: (f.emailNotifica ?? '').trim(),
    favoriteSchools: f.favoriteSchools,
    ignoredSchools: f.ignoredSchools,
  };
}

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

  /**
   * GUARDIA DI PERSISTENZA (stato): `toccatiRef` elenca i campi su cui l'utente è
   * intervenuto da QUESTA schermata. È una registrazione ESPLICITA — fatta
   * dall'handler nell'istante del tocco (`segnaToccato`), non dedotta a
   * posteriori confrontando fotografie prese in passaggi diversi — così
   * l'arrivo del profilo (o di un refresh) non può mai essere scambiato per una
   * modifica dell'utente.
   *
   * Solo i campi elencati qui entrano nell'autosave: classi, province,
   * competenze/parole chiave e scuole restano quelle già salvate finché l'utente
   * non le cambia davvero. Cambiano quindi SOLO per un'azione esplicita
   * dell'utente (o dell'admin), mai per un caricamento o un default.
   */
  const toccatiRef = useRef<Set<CampoToccabile>>(new Set());

  /** Registra che l'utente ha modificato `campo`: senza questo, nulla da salvare. */
  const segnaToccato = (campo: CampoToccabile) => {
    toccatiRef.current.add(campo);
  };

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
  /**
   * MODALITÀ 4 + 5 (§26.62, §26.65) — AMBITO PROVINCIALE delle due liste scuole.
   * Le province da cercare sono quelle scelte PIÙ quelle entro 60 km
   * (`provinceDiRicerca`, lo stesso perimetro della bacheca).
   *
   * §26.65 — i suggerimenti non sono «le stringhe che compaiono nel feed»: sono
   * gli ISTITUTI PRESENTABILI (`scuolePresentabili`, il gate §26.59), così il
   * campo scuola non propone mai una voce di menu, una materia o un dump di
   * codici. Le province del selettore accanto al campo si deducono da QUEI
   * suggerimenti: non si può scegliere una provincia vuota.
   */
  const scuoleAmbiente = useMemo(() => {
    const provinceRicerca = provinceDiRicerca(provinceCodici);
    const note = scuolePresentabili(interpelliFiltrati);
    const suggerimenti = suggerimentiScuole(note, provinceRicerca);
    return {
      provinceNomi: provinceRicerca.map((c) => province.find((p) => p.codice === c)?.nome ?? c),
      suggerimenti,
      provinceSuggerite: provinceSuggerite(suggerimenti),
      verificaAmbito: (nome: string) => ambitoScuola(note, provinceRicerca, nome),
    };
  }, [provinceCodici, interpelliFiltrati]);
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

  // Ogni handler dell'utente marca il proprio campo (`segnaToccato`) insieme alla
  // modifica: è il permesso di scrittura per l'autosave. Le uscite anticipate
  // (tetto raggiunto, testo vuoto, valore già presente) non cambiano nulla,
  // quindi non marcano e non producono alcun salvataggio.
  const toggleOrdine = (id: OrdineScuola) => {
    segnaToccato('ordini');
    setOrdini((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]));
  };

  const toggleClasse = (codice: string) => {
    const canonico = normalizzaClasse(codice);
    if (!canonico) return;
    const attuale = normalizzaClassi(classiCodici);
    if (attuale.includes(canonico)) {
      segnaToccato('classiCodici');
      setClassiCodici(attuale.filter((c) => c !== canonico));
      return;
    }
    if (attuale.length >= maxClassiConcorso) return;
    segnaToccato('classiCodici');
    setClassiCodici([...attuale, canonico]);
  };

  const toggleMateria = (id: string) => {
    segnaToccato('materieId');
    setMaterieId((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  };

  const aggiungiCompetenzaSuggerita = (materiaId: string) => {
    segnaToccato('materieId');
    setMaterieId((prev) => (prev.includes(materiaId) ? prev : [...prev, materiaId]));
  };

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
    segnaToccato('materieCustom');
    setMaterieCustom((prev) => [...prev, ...nuove]);
  };

  const removeCustomMateria = (m: string) => {
    segnaToccato('materieCustom');
    setMaterieCustom((prev) => prev.filter((x) => x !== m));
  };

  const toggleProvincia = (codice: string) => {
    if (provinceCodici.includes(codice)) {
      segnaToccato('provinceCodici');
      setProvinceCodici((prev) => prev.filter((c) => c !== codice));
      return;
    }
    if (provinceCodici.length >= maxProvince) return;
    segnaToccato('provinceCodici');
    setProvinceCodici((prev) => [...prev, codice]);
  };

  const promuoviPrincipale = (codice: string) => {
    segnaToccato('provinceCodici');
    setProvinceCodici((prev) => promuoviProvinciaPrincipale(prev, codice));
  };

  const addFavoriteScuola = () => {
    const val = favoriteScuolaInput.trim();
    if (!val) return;
    if (!favoriteSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      segnaToccato('favoriteSchools');
      setFavoriteSchools((prev) => [...prev, val]);
    }
    setFavoriteScuolaInput('');
  };

  const removeFavoriteScuola = (s: string) => {
    segnaToccato('favoriteSchools');
    setFavoriteSchools((prev) => prev.filter((x) => x !== s));
  };

  const addIgnoredScuola = () => {
    const val = ignoredScuolaInput.trim();
    if (!val) return;
    if (!ignoredSchools.some((s) => s.toLowerCase() === val.toLowerCase())) {
      segnaToccato('ignoredSchools');
      setIgnoredSchools((prev) => [...prev, val]);
    }
    setIgnoredScuolaInput('');
  };

  const removeIgnoredScuola = (s: string) => {
    segnaToccato('ignoredSchools');
    setIgnoredSchools((prev) => prev.filter((x) => x !== s));
  };

  /**
   * CANALI DI NOTIFICA — stesse regole del resto del pannello: passare da questi
   * setter è ciò che rende il campo scrivibile dall'autosave. Il testo che
   * l'utente svuota resta un azzeramento VOLUTO (il campo è marcato al primo
   * carattere digitato), mentre un valore vuoto mai toccato non cancella nulla.
   */
  const cambiaTelegramUsername = (valore: string) => {
    segnaToccato('telegramUsername');
    setTelegramUsername(valore);
  };

  const cambiaTelegramChatId = (valore: string) => {
    segnaToccato('telegramChatId');
    setTelegramChatIdInput(valore);
  };

  const cambiaEmailNotifica = (valore: string) => {
    segnaToccato('emailNotifica');
    setEmailNotifica(valore);
  };

  /**
   * IDRATAZIONE DEL PROFILO — guardia di persistenza, lato LETTURA.
   *
   * Il profilo non è disponibile al primo render: `preferenze` di contesto è la
   * fonte della verità (localStorage all'avvio, poi la riga `profiles` quando la
   * risposta arriva). Ogni nuovo arrivo riallinea i campi locali che l'utente NON
   * ha ancora toccato: i pannelli mostrano i dati veri e nessun campo resta
   * fermo su un valore vecchio.
   *
   * I campi GIÀ TOCCATI (`toccatiRef`, registrati dall'handler dell'utente) sono
   * esclusi: nessun caricamento, refresh o risposta in ritardo può sovrascrivere
   * o svuotare una scelta appena fatta. Questa è l'unica scrittura automatica
   * dello stato locale della schermata.
   */
  useEffect(() => {
    const idratate = fotoCampi(preferenze);
    const toccati = toccatiRef.current;
    if (!toccati.has('ordini')) setOrdini(idratate.ordini);
    if (!toccati.has('classiCodici')) setClassiCodici(idratate.classiCodici);
    if (!toccati.has('materieId')) setMaterieId(idratate.materieId);
    if (!toccati.has('materieCustom')) setMaterieCustom(idratate.materieCustom);
    if (!toccati.has('provinceCodici')) setProvinceCodici(idratate.provinceCodici);
    if (!toccati.has('telegramUsername')) setTelegramUsername(idratate.telegramUsername);
    if (!toccati.has('telegramChatId')) setTelegramChatIdInput(idratate.telegramChatId);
    if (!toccati.has('emailNotifica')) setEmailNotifica(idratate.emailNotifica);
    if (!toccati.has('favoriteSchools')) setFavoriteSchools(idratate.favoriteSchools);
    if (!toccati.has('ignoredSchools')) setIgnoredSchools(idratate.ignoredSchools);
  }, [preferenze]);

  /**
   * TETTI DEL PIANO — qui NON si tronca nulla (regola di prodotto §26.5 di
   * `docs/SYSTEM_HANDOVER.md`: «i tetti limitano l'USO, non distruggono i dati»).
   * Una selezione oltre il tetto resta SALVATA e viene segnalata «oltre il piano»
   * nel pannello; i tetti del piano confermato si applicano al momento dell'uso
   * (`limitaSelezione` nel feed del Radar) e l'avviso all'utente vive in
   * `usePreferenzeUtente`. Troncare qui sarebbe un azzeramento AUTOMATICO delle
   * preferenze: un downgrade a Base deve produrre avvisi in meno, non distruggere
   * le classi e le province scelte durante la prova PRO.
   */

  useEffect(() => {
    /**
     * GUARDIA DI PERSISTENZA, lato SCRITTURA: nel payload entrano SOLO i campi
     * elencati in `toccatiRef` (quelli su cui l'utente è intervenuto in questa
     * sessione) e solo se il valore locale differisce da quello già salvato
     * (`modificheDaSalvare`).
     *
     * Il resto del payload è il contesto così com'è: `salvaProfilo` riscrive
     * l'intera riga `profiles`, quindi ogni campo NON toccato viene riscritto con
     * il suo valore reale — mai con un default vuoto. Un secondo avvio, un refresh
     * o un profilo non ancora arrivato non possono più cancellare classi,
     * province, competenze/parole chiave o scuole: senza campi toccati non parte
     * alcun salvataggio. Una preferenza cambia solo per un'azione esplicita
     * dell'utente (o dell'admin).
     */
    // Il profilo deve essere stato LETTO (dal DB o dalla modalità demo): finché
    // `pianoStato` è 'loading' lo stato locale non è ancora idratato, quindi
    // nessuna scrittura. La guardia (`useGuardiaPiano`) esce dal caricamento al
    // massimo dopo 10 s, così nessuno resta senza salvataggio.
    if (pianoStato !== 'pronto') return;
    const locale = fotoCampi({
      ordini,
      classiCodici,
      materieId,
      materieCustom,
      provinceCodici,
      telegramUsername,
      telegramChatId: telegramChatIdInput,
      emailNotifica,
      favoriteSchools,
      ignoredSchools,
    });
    const modifiche = modificheDaSalvare<Preferenze>(toccatiRef.current, locale, preferenze);
    // Niente campi toccati (o valori identici a quelli già salvati) → nessuna
    // scrittura: il profilo e i refresh non scrivono nulla e le preferenze
    // salvate restano intatte, senza alcun ciclo di autosave.
    if (Object.keys(modifiche).length === 0) return;
    const daSalvare: Preferenze = {
      ...preferenze,
      ...modifiche,
      onboarded: preferenze.onboarded,
      sostegno,
    };
    setStatoSalvataggio('salvataggio');
    const timeout = setTimeout(() => {
      setPreferenze(daSalvare);
      void salvaProfilo(daSalvare).then(() => {
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
    pianoStato,
    preferenze,
    setPreferenze,
    salvaProfilo,
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
          scuoleConosciute={scuoleAmbiente.suggerimenti}
          provinceSuggerite={scuoleAmbiente.provinceSuggerite}
          provinceSeguite={scuoleAmbiente.provinceNomi}
          verificaAmbito={scuoleAmbiente.verificaAmbito}
        />

        <PannelloCanali
          accordionAperti={accordionAperti}
          toggleAccordion={toggleAccordion}
          preferenze={preferenze}
          telegramDeepLink={telegramDeepLink}
          telegramUsername={telegramUsername}
          setTelegramUsername={cambiaTelegramUsername}
          telegramChatIdInput={telegramChatIdInput}
          setTelegramChatIdInput={cambiaTelegramChatId}
          emailNotifica={emailNotifica}
          setEmailNotifica={cambiaEmailNotifica}
        />
      </div>
    </div>
  );
}