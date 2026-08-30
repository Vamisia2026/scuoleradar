import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Riporta la finestra in cima a ogni cambio di rotta (SPA).
 * Va montato DENTRO il BrowserRouter (usa `useLocation`): qualsiasi
 * navigazione (navbar, CTA, link interni) resetta lo scroll a (0,0).
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
