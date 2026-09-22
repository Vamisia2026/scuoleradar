/**
 * Dashboard · guscio comune delle pagine riservate (`/dashboard/*`).
 *
 * Monta Header, barra dei dipartimenti, il boundary di dipartimento attorno
 * all'`<Outlet />` e il Footer. Il nome leggibile del dipartimento attivo (dal
 * segmento di rotta) alimenta titolo e fallback del boundary: se una sezione va
 * in errore, il guscio e le altre tab restano perfettamente usabili.
 *
 * Le tab sono filtrate dalle FEATURE FLAGS (`useFeatureFlags`): un dipartimento
 * in `off` (o in `test` per i non admin) non compare nella barra e riceve il
 * badge «TEST» quando è visibile solo all'admin.
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { DepartmentErrorBoundary } from '@/components/DepartmentErrorBoundary';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { DashboardNav, type TabNav } from './DashboardNav';

/**
 * Nomi leggibili dei dipartimenti montati in dashboard: servono alla fallback
 * dell'Error Boundary che isola l'`<Outlet />`. Se una sezione va in errore,
 * il guscio della dashboard (header, tab, footer) resta perfettamente usabile
 * e l'utente può passare a un altro dipartimento con un click.
 */
const DIPARTIMENTI_DASHBOARD: Record<string, string> = {
  radar: 'Radar Scuole',
  cv: 'Crea CV',
  'calcolatore-cfu': 'Calcolatore CFU',
  'assistente-ai': 'Assistente Sindacalista Virtuale',
  moduli: 'Modulistica',
  purefocus: 'PureFocus',
  profilo: 'Profilo',
  invita: 'Invita un Collega',
};

/**
 * Tab della dashboard: una per dipartimento, nell'ordine di `DIPARTIMENTI`.
 * `📄 Crea CV` esiste ma con default `off` (ex «feature in incubazione»): si
 * accende dal pannello Admin/DEV. L'Assistente AI resta fuori dalle tab.
 */
const TAB_DASHBOARD: TabNav[] = [
  { to: '/dashboard/radar', label: '📡 Radar Scuole', end: true, modulo: 'radar' },
  { to: '/dashboard/calcolatore-cfu', label: '🎓 Calcolatore CFU', modulo: 'cfu' },
  { to: '/dashboard/moduli', label: '📁 Modulistica', modulo: 'modulistica' },
  { to: '/dashboard/purefocus', label: '🧘 Pure Focus', modulo: 'purefocus' },
  { to: '/dashboard/invita', label: '🎁 Invita un Collega', accent: true, modulo: 'referral' },
  { to: '/dashboard/cv', label: '📄 Crea CV', modulo: 'cv_builder' },
];

export function DashboardLayout() {
  const location = useLocation();
  const { visibile, stato } = useFeatureFlags();
  /** Segmento di rotta dopo `/dashboard/` (es. "radar", "moduli", "calcolatore-cfu"). */
  const segmento = location.pathname.replace(/^\/dashboard\/?/, '').split('/')[0];
  const dipartimentoCorrente = DIPARTIMENTI_DASHBOARD[segmento] ?? 'Dashboard';

  const tabs = TAB_DASHBOARD.filter((t) => visibile(t.modulo)).map((t) =>
    stato(t.modulo) === 'test' ? { ...t, badge: 'TEST' } : t,
  );

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50">
      <Header />
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
        <DashboardNav tabs={tabs} />
        <main className="mt-3 min-w-0">
          {/* Isolamento di dipartimento: un errore resta confinato alla sezione
              attiva, la barra delle tab e gli altri dipartimenti continuano a
              funzionare. La `key` resetta la fallback al cambio di rotta. */}
          <DepartmentErrorBoundary
            key={location.pathname}
            dipartimento={dipartimentoCorrente}
            titolo={`Il dipartimento ${dipartimentoCorrente} ha incontrato un problema`}
            messaggio="La sezione non è disponibile in questo momento. Dal menu qui sopra puoi aprire un altro servizio di ScuoleRadar e riprovare più tardi."
          >
            <Outlet />
          </DepartmentErrorBoundary>
        </main>
      </div>
      <Footer />
    </div>
  );
}
