import { useEffect, useMemo, useState } from 'react';
import { SeoMeta } from './SeoMeta';
import { prossimeVacanze } from '../vacanzeScolastiche';
import { TestataEditoriale } from './hero/TestataEditoriale';
import { WidgetScadenze } from './hero/WidgetScadenze';

/**
 * Copy editoriale ufficiale della pagina Notizie (nuova edizione).
 * Linguaggio diretto, zero marketing: il blog è un filtro sulle fonti.
 */
export const SOTTOTITOLO_NOTIZIE =
  'Controlliamo noi, perché tu non perda tempo. Solo notizie reali e scadenze, dal MIM e dalla Gazzetta Ufficiale.';

/**
 * Slogan della pagina Notizie: compare sotto il sottotitolo, sopra i badge
 * di fiducia, in carattere display regolare (non corsivo).
 */
export const SLOGAN_NOTIZIE =
  'Quando vuoi sapere cosa succede di importante, vieni qui!';

/**
 * Hero editoriale del Dipartimento Notizie (stile "Daily Planet"):
 * masthead serif con righe doppie, sottotitolo + slogan, e a destra il
 * widget Scadenze con il revolver orizzontale delle 10 prossime scadenze
 * operative e il conto alla rovescia per le vacanze in basso.
 */
export interface NotizieHeroProps {
  /** Voci del menu categorie (es. 'Tutte', 'GPS', 'Mobilità'…). */
  categorie?: string[];
  /** Conteggio articoli per categoria (chiavi = nomi categoria). */
  conteggi?: Record<string, number>;
  /** Categoria attiva (default 'Tutte'). */
  categoria?: string;
  /** Callback quando l'admin/cliente cambia categoria. */
  onCategoriaChange?: (categoria: string) => void;
}

export function NotizieHero({
  categorie = [],
  conteggi = {},
  categoria = 'Tutte',
  onCategoriaChange,
}: NotizieHeroProps = {}) {
  const [oggi, setOggi] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  // Aggiornamento automatico alla mezzanotte: quando una scadenza passa,
  // il widget passa subito alla successiva senza ricaricare la pagina.
  useEffect(() => {
    const timer = setInterval(() => {
      setOggi((prev) => {
        const ora = new Date();
        ora.setHours(0, 0, 0, 0);
        return ora.getTime() === prev.getTime() ? prev : ora;
      });
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  // Conto alla rovescia per le vacanze (in estate il box mostra solo la scadenza).
  const contoVacanze = useMemo(() => prossimeVacanze(oggi), [oggi]);

  return (
    <>
      <SeoMeta
        titolo="Notizie e scadenze ufficiali per la scuola"
        descrizione={SOTTOTITOLO_NOTIZIE}
        urlCanonica="/notizie"
      />
      <section
        aria-label="Rassegna stampa di notizie e scadenze per la scuola"
        className="bg-gradient-to-b from-primary-50 to-white"
      >
        <div className="mx-auto max-w-7xl px-4 pb-6 pt-3 sm:px-6 sm:pb-8 sm:pt-4">
          <div className="grid w-full max-w-full grid-cols-1 gap-x-8 gap-y-6 overflow-x-hidden lg:grid-cols-12">
            {/* Colonna sinistra — masthead editoriale */}
            <TestataEditoriale
              sottotitolo={SOTTOTITOLO_NOTIZIE}
              slogan={SLOGAN_NOTIZIE}
              categorie={categorie}
              categoria={categoria}
              conteggi={conteggi}
              onCategoriaChange={onCategoriaChange}
            />

            {/* Colonna destra — widget Scadenze: revolver (2/3) + countdown (1/3) */}
            <WidgetScadenze contoVacanze={contoVacanze} />
          </div>
        </div>
      </section>
    </>
  );
}
