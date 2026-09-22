/**
 * Dipartimento Admin · tab Utenti — colonne della tabella ed etichette di riga.
 *
 * Fonte unica della tabella utenti: definizione delle colonne (con default di
 * visibilità) e formattatori puri usati sia dalla tabella sia dal dettaglio.
 * Estratti da `AdminTabs.tsx` senza modifiche di comportamento.
 */
import type { AdminUtente } from '../../types';

export type IdColonna =
  | 'id'
  | 'nome'
  | 'genere'
  | 'eta'
  | 'email'
  | 'telegram'
  | 'telefono'
  | 'province'
  | 'piano'
  | 'login'
  | 'azioni';
export const COLONNE: { id: IdColonna; label: string; def: boolean }[] = [
  { id: 'id', label: 'User ID', def: true },
  { id: 'nome', label: 'Nome & Cognome', def: true },
  { id: 'genere', label: 'Genere', def: true },
  { id: 'eta', label: 'Età', def: true },
  { id: 'email', label: 'Email', def: true },
  { id: 'telegram', label: 'Telegram', def: true },
  { id: 'telefono', label: 'Phone', def: true },
  { id: 'province', label: 'Provincia', def: true },
  { id: 'piano', label: 'Piano', def: true },
  { id: 'login', label: 'Login', def: false },
  { id: 'azioni', label: 'Azioni', def: true },
];

export function scaricaCsv(righe: AdminUtente[], nomeFile = 'utenti_admin.csv'): void {
  const headers = ['id', 'nome', 'cognome', 'genere', 'eta', 'email', 'piano', 'province', 'telegram', 'registrato_il'];
  const campi = (u: AdminUtente) => [
    u.id,
    u.nome ?? '',
    u.cognome ?? '',
    u.genere === 'M' ? 'Uomo' : u.genere === 'F' ? 'Donna' : '',
    u.eta ?? '',
    u.email,
    u.piano ?? 'base',
    (u.province_interesse ?? u.province_attive ?? []).join('|'),
    u.telegram_chat_id ?? '',
    u.created_at ?? '',
  ];
  const testo = [headers.join(';'), ...righe.map((u) => campi(u).map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
  const blob = new Blob(['\uFEFF' + testo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
}

export function loginType(u: AdminUtente): string {
  const lt = u.login_type?.trim();
  if (lt) return lt.toUpperCase();
  if (u.email) return 'GOOGLE';
  return '—';
}

export function telefono(u: AdminUtente): string {
  const tel = u.telefono?.trim();
  return tel || '—';
}

/** Badge Genere: M → Uomo, F → Donna, altrimenti —. */
export function badgeGenere(u: AdminUtente): string {
  if (u.genere === 'M') return 'Uomo';
  if (u.genere === 'F') return 'Donna';
  return '—';
}

/** Handle/ID Telegram: preferisce l'username (@…), poi chat ID, poi eventuale colonna legacy `telegram`. */
export function testoTelegram(u: AdminUtente): string {
  const username = u.telegram_username?.trim();
  if (username) return username.startsWith('@') ? username : `@${username}`;
  const chat = u.telegram_chat_id?.trim();
  if (chat) return chat;
  const legacy = u.telegram?.trim();
  return legacy || '';
}

/**
 * Filtra l'elenco utenti per ricerca libera, piano e provincia.
 * Funzione PURA (nessuno stato, nessun accesso al backend): la usa `TabUtenti`
 * dentro una `useMemo`, così i criteri di filtro restano testabili a parte.
 */
export function filtraUtenti(
  utenti: AdminUtente[],
  ricerca: string,
  filtroPiano: string,
  filtroProvincia: string,
): AdminUtente[] {
  const q = ricerca.trim().toLowerCase();
  const prov = filtroProvincia.trim().toUpperCase();
  return utenti.filter((u) => {
    if (q) {
      const testo = `${u.id} ${u.email} ${u.nome ?? ''} ${u.cognome ?? ''}`.toLowerCase();
      if (!testo.includes(q)) return false;
    }
    if (filtroPiano && (u.piano ?? 'base') !== filtroPiano) return false;
    if (prov) {
      const province = u.province_interesse ?? u.province_attive ?? [];
      if (!province.some((p) => p.toUpperCase() === prov)) return false;
    }
    return true;
  });
}

/**
 * Testo corrente di una cella modificabile della tabella utenti (nome, cognome,
 * telegram, telefono, province). Pura: usata per l'editing inline e dal dettaglio.
 */
export function testoCell(u: AdminUtente, campo: string): string {
  if (campo === 'nome') return u.nome ?? '';
  if (campo === 'cognome') return u.cognome ?? '';
  if (campo === 'telegram') return testoTelegram(u);
  if (campo === 'telefono') return telefono(u);
  if (campo === 'province') return (u.province_interesse ?? u.province_attive ?? []).join(', ');
  return '';
}
