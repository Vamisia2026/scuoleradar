import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, FolderOpen, Search, Sparkles } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import {
  macroAreeModulistica,
  ordineMacroAree,
  type DocumentoModulistica,
} from '@/data/moduli';
import { setPostLoginRedirect } from '@/lib/showroomRedirect';

/**
 * Showroom pubblico "/moduli" — pagina SEO della Modulistica.
 * Anteprima interattiva (categorie/titoli cercabili) senza login + CTA verso
 * /dashboard/moduli: utente autenticato → deep-link; ospite → AuthModal con
 * redirect post-login alla dashboard.
 */
export function ModuliShowroom() {
  const { user, openAuthModal } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [areaAttiva, setAreaAttiva] = useState<string>('Tutti');

  const TITOLO_SEO =
    'Tutti i moduli per la scuola che ti servono, senza cercarli ogni volta — ScuoleRadar';
  const DESCRIZIONE_SEO =
    'Oltre 1.000 moduli e modelli scolastici pronti all\u2019uso: supplenze, MAD, PEI, ' +
    'autocertificazioni, permessi e modulistica per docenti, ATA e famiglie. Cerca, ' +
    'anteprima e compila gratis con ScuoleRadar.';

  // SEO: title + meta description a ogni visita.
  useEffect(() => {
    document.title = TITOLO_SEO;
    const setMeta = (attr: 'name' | 'property', key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };
    setMeta('name', 'description', DESCRIZIONE_SEO);
    setMeta('property', 'og:title', TITOLO_SEO);
    setMeta('property', 'og:description', DESCRIZIONE_SEO);
  }, [TITOLO_SEO, DESCRIZIONE_SEO]);

  /** Appiattisce l'albero del catalogo in voci documento indicizzabili. */
  const catalogo = useMemo(() => {
    interface Voce {
      key: string;
      area: string;
      cartella: string[];
      doc: DocumentoModulistica;
    }
    const voci: Voce[] = [];
    for (const area of macroAreeModulistica) {
      const visita = (nodi: typeof area.sotto, cartella: string[]): void => {
        for (const nodo of nodi) {
          for (const doc of nodo.documenti ?? []) {
            voci.push({
              key: `${area.id}/${nodo.id}/${doc.id}`,
              area: area.nome,
              cartella: [...cartella, nodo.nome],
              doc,
            });
          }
          visita(nodo.sotto ?? [], [...cartella, nodo.nome]);
        }
      };
      visita(area.sotto, []);
    }
    return voci;
  }, []);

  const areeDisponibili = useMemo(
    () => ordineMacroAree.filter((nome) => catalogo.some((v) => v.area === nome)),
    [catalogo],
  );
  const totaleDocumenti = catalogo.length;

  const risultati = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return catalogo.filter((v) => {
      if (areaAttiva !== 'Tutti' && v.area !== areaAttiva) return false;
      if (!q) return true;
      const testo = `${v.area} ${v.cartella.join(' ')} ${v.doc.nome} ${v.doc.descrizione}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return testo.includes(q);
    });
  }, [catalogo, query, areaAttiva]);
  const visibili = risultati.slice(0, 36);
  const esubero = Math.max(risultati.length - visibili.length, 0);

  /** Conversion bridge verso il tool completo. */
  const apriStrumento = (): void => {
    if (user) {
      navigate('/dashboard/moduli');
      return;
    }
    setPostLoginRedirect('/dashboard/moduli');
    openAuthModal('registrazione');
  };

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-card">
        <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-primary-600 px-6 py-10 text-center sm:px-10 sm:py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent-200">
            <FileText className="h-3.5 w-3.5" />
            Moduli scolastici PDF gratuiti per docenti e ATA
          </span>
          <h1 className="mx-auto mt-4 max-w-4xl text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            Tutti i moduli per la scuola che ti servono, senza cercarli ogni volta.
          </h1>
          <p className="mx-auto mt-4 max-w-3xl text-lg font-semibold text-accent-300">
            Modulistica pronta all&apos;uso per chi vive la scuola ogni giorno.
          </p>
          <p className="mx-auto mt-3 max-w-3xl text-base leading-relaxed text-primary-100 sm:text-lg">
            ScuoleRadar raccoglie oltre {totaleDocumenti} modelli ufficiali e compilabili:
            supplenze e MAD, PEI e sostegno, certificati, permessi, mobilità, concorsi e molto
            altro. Cerchi il documento, lo apri, lo compili: niente più ore perse a cercare
            moduli sparsi tra i siti istituzionali.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              onClick={apriStrumento}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary-500 px-7 py-3.5 text-sm font-bold uppercase tracking-wide text-white shadow-soft transition hover:bg-secondary-600"
            >
              <Sparkles className="h-4 w-4" />
              Usa Moduli nella Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
            <a
              href="#anteprima"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Sfoglia l&apos;anteprima
            </a>
          </div>
        </div>

        <div className="grid gap-3 p-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-primary-50 p-4 text-center">
            <p className="text-2xl font-black text-primary-800">{areeDisponibili.length}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Aree tematiche</p>
          </div>
          <div className="rounded-2xl bg-primary-50 p-4 text-center">
            <p className="text-2xl font-black text-primary-800">{totaleDocumenti}+</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Documenti disponibili</p>
          </div>
          <div className="rounded-2xl bg-primary-50 p-4 text-center">
            <p className="text-2xl font-black text-primary-800">PDF · DOCX</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Compilabili e stampabili</p>
          </div>
        </div>
      </section>
      {/* Contenuto SEO: come funziona / per chi è */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-primary-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-bold text-primary-800">Come funziona</h2>
          <p className="mt-2 text-sm leading-relaxed text-primary-600">
            Selezioni la tua area (GPS, mobilità, sostegno, burocrazia, candidature…), trovi la
            pratica che ti serve e apri il modello giusto. Il documento viene generato come PDF o
            DOCX compilabile con i riferimenti normativi corretti, e puoi salvare i tuoi moduli
            preferiti per ritrovarli in un clic nella tua area personale.
          </p>
          <ul className="mt-4 space-y-2 text-sm text-primary-700">
            <li className="flex items-start gap-2">
              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
              Catalogo sempre aggiornato con i modelli più richiesti dal personale scolastico.
            </li>
            <li className="flex items-start gap-2">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
              Ricerca per parola chiave e filtro per area tematica, anche senza registrazione.
            </li>
            <li className="flex items-start gap-2">
              <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
              Ogni modulo è organizzato per pratica: supplenza, PEI, permessi, congedi e altro.
            </li>
          </ul>
        </div>
        <div className="rounded-3xl border border-primary-100 bg-white p-6 shadow-card">
          <h2 className="text-xl font-bold text-primary-800">Per chi è</h2>
          <p className="mt-2 text-sm leading-relaxed text-primary-600">
            Docenti e aspiranti docenti alle prese con supplenze, GPS e MAD; personale ATA che deve
            gestire permessi, assenze e pratiche amministrative; famiglie e studenti che hanno
            bisogno di una delega, di un&apos;autocertificazione o di un modello per la scuola.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-primary-600">
            Trovi il documento, controlli che sia quello giusto dalla descrizione e lo apri nel tool
            completo: qui puoi compilarlo, scaricarlo e stamparlo in pochi secondi.
          </p>
        </div>
      </section>
      {/* Anteprima interattiva del catalogo */}
      <section
        id="anteprima"
        className="scroll-mt-6 rounded-3xl border border-primary-100 bg-white p-5 shadow-card sm:p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-primary-800">Anteprima del catalogo</h2>
            <p className="mt-1 text-sm text-primary-600">
              Esplora categorie e titoli: apri lo strumento completo per scaricare il modulo.
            </p>
          </div>
          <span className="rounded-full bg-accent-50 px-3 py-1 text-xs font-bold text-accent-700">
            {risultati.length} {risultati.length === 1 ? 'documento trovato' : 'documenti trovati'}
          </span>
        </div>

        <div className="relative mt-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca un modulo (es. MAD, PEI, autocertificazione, permesso)…"
            aria-label="Cerca un modulo nell'anteprima del catalogo"
            className="input w-full py-3 pl-12"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filtra per area tematica">
          {['Tutti', ...areeDisponibili].map((area) => {
            const selezionata = areaAttiva === area;
            return (
              <button
                key={area}
                type="button"
                onClick={() => setAreaAttiva(area)}
                aria-pressed={selezionata}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selezionata
                    ? 'bg-primary-500 text-white shadow-soft'
                    : 'border border-primary-200 bg-white text-primary-600 hover:bg-primary-50'
                }`}
              >
                {area}
              </button>
            );
          })}
        </div>

        <ul className="mt-5 divide-y divide-primary-100 border-t border-primary-100">
          {visibili.map((v) => (
            <li key={v.key}>
              <button
                type="button"
                onClick={apriStrumento}
                className="group flex w-full items-start gap-3 px-1 py-3 text-left transition hover:bg-primary-50/60"
              >
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600 transition group-hover:bg-primary-500 group-hover:text-white">
                  <FileText className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold uppercase tracking-wide text-primary-400">
                    {v.area}
                    {v.cartella.length > 0 ? ` · ${v.cartella.join(' · ')}` : ''}
                  </span>
                  <span className="block text-sm font-bold text-primary-800">{v.doc.nome}</span>
                  {v.doc.descrizione && (
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-primary-500">
                      {v.doc.descrizione}
                    </span>
                  )}
                </span>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary-300 transition group-hover:translate-x-0.5 group-hover:text-primary-600" />
              </button>
            </li>
          ))}
        </ul>

        {visibili.length === 0 && (
          <p className="rounded-xl border border-dashed border-primary-200 p-6 text-center text-sm text-primary-400">
            Nessun documento corrisponde alla ricerca. Prova con un&apos;altra parola chiave o apri
            lo strumento completo per esplorare tutto il catalogo.
          </p>
        )}
        {esubero > 0 && (
          <p className="mt-3 text-center text-xs text-primary-400">
            … e altri {esubero} {esubero === 1 ? 'documento' : 'documenti'}. Apri lo strumento per
            vedere tutto.
          </p>
        )}
      </section>
      {/* CTA finale */}
      <section className="rounded-3xl bg-primary-50 p-8 text-center">
        <h2 className="text-2xl font-bold text-primary-800">Pronto a compilare il tuo modulo?</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-primary-600">
          Apri lo strumento completo nella dashboard: cerca per pratica, genera il documento giusto
          e scaricalo in PDF o DOCX, anche durante il mese di prova PRO.
        </p>
        <button
          type="button"
          onClick={apriStrumento}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-7 py-3.5 text-sm font-bold text-white shadow-soft transition hover:bg-primary-600"
        >
          {user ? 'Apri lo Strumento Completo' : 'Registrati e Apri lo Strumento'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </section>

      {/* Structured data per i motori di ricerca */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'Modulistica ScuoleRadar',
            url: 'https://www.scuoleradar.it/moduli',
            applicationCategory: 'EducationalApplication',
            operatingSystem: 'Any',
            description: DESCRIZIONE_SEO,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
          }),
        }}
      />
    </div>
  );
}
