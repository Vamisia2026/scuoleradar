import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { supabase } from '@/lib/supabase';
import { mapInterpelloDBToInterpello, type InterpelloDB } from '@/lib/matchingEngine';
import type { Interpello } from '@/data/interpelli';
import { chiaveInterpelloDaParam } from '@/lib/interpelloRouting';
import { AvvisoAssente } from './components/AvvisoAssente';
import { ReindirizzamentoAllaFonte } from './components/ReindirizzamentoAllaFonte';
import { SchedaAvviso } from './components/SchedaAvviso';
import { COLONNE_INTERPELLI, daNotices, reindirizzaAllaFonte } from './helpers';

/**
 * Scheda pubblica di un avviso (`/interpello/:id`).
 *
 * È l'atterraggio dei DEEP LINK delle notifiche quando l'avviso non ha una fonte
 * esterna: prima del fix questa rotta non esisteva e il catch-all reindirizzava
 * l'utente sulla HOME (perdendo il contesto dell'avviso). La pagina:
 *  · risolve l'avviso per `id` (uuid) o `hash_id` (chiave usata dalle notifiche);
 *  · mostra la STESSA gerarchia strutturata di card ed email;
 *  · espone UN SOLO bottone verso la fonte ufficiale, con etichetta onesta
 *    (mai "Candidati" se punta a un Albo Pretorio o a una pagina di avviso);
 *  · se l'avviso non esiste più lo DICE con garbo, senza rimbalzare sulla Home.
 */
export function InterpelloDettaglioPage() {
  const { id } = useParams<{ id: string }>();
  const [stato, setStato] = useState<'caricamento' | 'trovato' | 'assente' | 'reindirizzamento'>(
    'caricamento',
  );
  const [interpello, setInterpello] = useState<Interpello | null>(null);

  useEffect(() => {
    let annullato = false;
    const chiave = chiaveInterpelloDaParam(id);
    const client = supabase;
    if (!chiave || !client) {
      setStato('assente');
      return;
    }
    const carica = async (): Promise<void> => {
      const { data } = await client
        .from('interpelli')
        .select(COLONNE_INTERPELLI)
        .eq(chiave.colonna, chiave.valore)
        .maybeSingle();
      if (annullato) return;
      if (data) {
        const trovato = mapInterpelloDBToInterpello(data as InterpelloDB);
        // LINK DIRETTO: chi arriva dal deep link di una notifica deve atterrare
        // IMMEDIATAMENTE sulla pagina istituzionale originale, mai su una scheda
        // interna con "Avviso non più disponibile".
        if (reindirizzaAllaFonte(trovato)) {
          setInterpello(trovato);
          setStato('reindirizzamento');
          return;
        }
        setInterpello(trovato);
        setStato('trovato');
        return;
      }
      // Fallback legacy: tabella `notices` (stessa chiave di ricerca).
      const { data: legacy } = await client
        .from('notices')
        .select('id,title,source_url,province,class_codes,expiration_date')
        .eq(chiave.colonna, chiave.valore)
        .maybeSingle();
      if (annullato) return;
      if (legacy) {
        const trovato = daNotices(legacy);
        if (reindirizzaAllaFonte(trovato)) {
          setInterpello(trovato);
          setStato('reindirizzamento');
          return;
        }
        setInterpello(trovato);
        setStato('trovato');
        return;
      }
      setStato('assente');
    };
    void carica();
    return () => {
      annullato = true;
    };
  }, [id]);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <Header />
      <main>
        <section aria-label="Dettaglio avviso" className="bg-gradient-to-b from-primary-50 to-white">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
            {stato === 'caricamento' && (
              <p className="text-sm text-primary-600">Caricamento dell&apos;avviso…</p>
            )}
            {stato === 'reindirizzamento' && interpello && (
              <ReindirizzamentoAllaFonte interpello={interpello} />
            )}
            {stato === 'assente' && <AvvisoAssente />}
            {stato === 'trovato' && interpello && <SchedaAvviso interpello={interpello} />}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
