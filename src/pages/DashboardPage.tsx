/**
 * Dashboard · pagina Radar (`/dashboard/radar`).
 *
 * Contenitore: legge le opportunità dal contesto, applica il gate identitario
 * (Provincia / Ordine / Classe-Materia) e il filtro scadenze, limita la vetrina
 * per i visitatori non loggati e compone le sezioni estratte in `components/`
 * (banner bozza, vetrina ospiti, «Opportunità mappate»).
 * Il guscio della dashboard vive in `components/DashboardLayout`.
 */
import { useState } from 'react';
import { BenvenutoProRadar, PreferenzeRadar, RadarStatusToggle } from '@/departments/radar';
import { ProFeatureModal } from '@/components/ProFeatureModal';
import { useApp } from '@/contexts/AppContext';
import { BannerBozzaOnboarding } from './dashboard/components/BannerBozzaOnboarding';
import { ElencoOpportunita } from './dashboard/components/ElencoOpportunita';
import { VetrinaRadarOspiti } from './dashboard/components/VetrinaRadarOspiti';
import { vetrinaVisibile } from '@/lib/vetrinaBacheca';

export function DashboardPage() {
  const {
    user,
    interpelliFiltrati,
    preferenze,
    pianoStato,
    hasProAccess,
    openAuthModal,
    openRadarSetup,
    openRadarWizard,
  } = useApp();

  // Accesso PRO = entitlement UNICO del contesto (`piano` letto dal DB: 'pro' o
  // 'free_forever'; `pianoStato === 'pronto'` = piano confermato dal backend).
  // Non si ricalcola nulla da `abbonato`/`piano`: un PRO concesso dal DB (promo,
  // omaggio, codice beta, pannello admin) non deve mai ricadere su «Base».
  const feedBloccatoBase =
    Boolean(user) && Boolean(preferenze.onboarded) && pianoStato === 'pronto' && !hasProAccess;

  // Opportunità attive: pulite dalle scadute e dal gate identitario (regola UNICA in
  // `lib/vetrinaBacheca`, §26.119: la stessa che il feed usa per contare i posti
  // liberi), poi ordinate per compatibilità e scadenza.
  const opportunitaAttive = vetrinaVisibile(interpelliFiltrati)
    // PRIORITÀ: prima i match più forti col profilo (verde → arancio → rosso), poi
    // la scadenza più vicina. I suggerimenti EXTRA (60%, es. area sostegno fuori
    // dalle proprie classi) restano in bacheca ma finiscono in coda, mai in testa.
    .sort((a, b) => {
      const ca = a.compatibilita ?? 100;
      const cb = b.compatibilita ?? 100;
      if (cb !== ca) return cb - ca;
      const ta = a.dataScadenza ? new Date(a.dataScadenza).getTime() : Number.POSITIVE_INFINITY;
      const tb = b.dataScadenza ? new Date(b.dataScadenza).getTime() : Number.POSITIVE_INFINITY;
      return ta - tb;
    });

  // Accordion "Opportunità mappate": chiuso di default (console design) + modal paywall PRO.
  const [opportunitaAperte, setOpportunitaAperte] = useState(false);
  const [proFeatureAperto, setProFeatureAperto] = useState(false);

  // Per i visitatori non loggati mostriamo al massimo 3 opportunità (vetrina freemium).
  const listaOpportunita = user ? opportunitaAttive : opportunitaAttive.slice(0, 3);

  /** Click sull'accordion: Base onboarded → apre il paywall modal (mai l'elenco). */
  const toggleOpportunita = () => {
    if (feedBloccatoBase) {
      setProFeatureAperto(true);
      return;
    }
    setOpportunitaAperte((aperto) => !aperto);
  };

  // Onboarding iniziato (bozza salvata) ma non completato → banner di ripresa.
  const haBozzaOnboarding =
    !preferenze.onboarded &&
    (preferenze.ordini.length > 0 ||
      preferenze.classiCodici.length > 0 ||
      preferenze.materieId.length > 0 ||
      preferenze.materieCustom.length > 0 ||
      preferenze.provinceCodici.length > 0);

  return (
    <div className="space-y-3">
      {/* BENVENUTO PRO: una sola volta per utente con piano PRO confermato dal DB
          (congratulazioni + invito immediato ad attivare il Radar). */}
      {user && <BenvenutoProRadar />}

      {/* UNICO stato/upsell Radar: barra di controllo consolidata (titolo + tier + descrizione + toggle + CTA PRO) */}
      {user && <RadarStatusToggle titolo="Radar Scuole" />}

      {/* Onboarding incompleto: bozza avviata ma Radar non ancora attivato (riprendi dal passo salvato) */}
      {user && haBozzaOnboarding && <BannerBozzaOnboarding onRiprendi={openRadarWizard} />}

      {/* Vetrina Freemium: hero Radar per visitatori non loggati (copy essenziale) */}
      {!user && <VetrinaRadarOspiti onRegistrati={() => openAuthModal('registrazione')} />}

      {/* Preferenze Radar — impostazioni e filtri del profilo (bacheca unificata) */}
      {user && <PreferenzeRadar />}

      {/* Opportunità mappate — accordion console (chiuso di default; paywall modal per Base) */}
      <ElencoOpportunita
        lista={listaOpportunita}
        totale={opportunitaAttive.length}
        accordion={{ aperto: opportunitaAperte, onToggle: toggleOpportunita }}
        hasAccessoPro={hasProAccess}
        mostraInvitoProfilo={Boolean(user) && !preferenze.onboarded}
        onCompletaProfilo={openRadarSetup}
        filtri={{
          classiCodici: preferenze.classiCodici,
          provinceCodici: preferenze.provinceCodici,
        }}
      />

      <ProFeatureModal open={proFeatureAperto} onClose={() => setProFeatureAperto(false)} />

    </div>
  );
}

