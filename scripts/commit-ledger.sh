#!/usr/bin/env bash
# ============================================================
# ScuoleRadar.it — COMMIT del LEDGER anti-duplicato (scraper + digest).
#
# Perché uno script condiviso: `scraper.yml` e `digest.yml` girano negli STESSI
# minuti (15:00 UTC) e scrivono lo STESSO file `.scuoleradar/notifiche-ledger.json`.
# Con un commit+push "diretto" il secondo run perdeva le chiavi dell'altro (push
# rifiutato o file sovrascritto): le notifiche GIÀ consegnate risultavano non
# registrate e ripartivano nei giorni successivi — bug "notifiche ripetute a
# distanza di giorni" (es. gli avvisi del Liceo Monti).
#
# Qui il ledger del run viene UNITO a quello del branch remoto
# (`npm run ledger:unisci`, unione di chiavi: mai "vince l'ultimo") e committato
# sul remoto aggiornato, con RETRY se il push viene rifiutato.
#
# Variabili: GITHUB_REF_NAME (branch), RUNNER_TEMP (area temporanea del runner).
# ============================================================
set -uo pipefail

LEDGER=".scuoleradar/notifiche-ledger.json"
RAMO="${GITHUB_REF_NAME:-$(git rev-parse --abbrev-ref HEAD)}"
MSG="chore(notifiche): aggiorna il ledger anti-duplicato [skip ci]"
TMP="${RUNNER_TEMP:-/tmp}"
LEDGER_RUN="$TMP/ledger-run.json"
LEDGER_REMOTO="$TMP/ledger-remoto.json"

if [ ! -f "$LEDGER" ]; then
  echo "Nessun ledger da committare."
  exit 0
fi

# Il ledger prodotto da questo run (il reset del working tree non deve toccarlo).
cp "$LEDGER" "$LEDGER_RUN"

git config user.name "scuoleradar-bot"
git config user.email "bot@scuoleradar.it"

for tentativo in 1 2 3; do
  echo "— Tentativo $tentativo: allineo il ledger con origin/$RAMO —"
  git fetch --depth=1 origin "$RAMO" || true

  if git show "origin/$RAMO:$LEDGER" > "$LEDGER_REMOTO" 2>/dev/null; then
    echo "  · ledger remoto letto ($(wc -c < "$LEDGER_REMOTO") byte)"
  else
    echo '{"chiavi":[]}' > "$LEDGER_REMOTO"
    echo "  · nessun ledger sul remoto: si parte dal solo ledger del run"
  fi

  # UNIONE delle chiavi: le voci del run NON sovrascrivono quelle remote.
  npx tsx scripts/unione-ledger.ts "$LEDGER_RUN" "$LEDGER_REMOTO"

  git add "$LEDGER"
  if git diff --cached --quiet; then
    echo "Ledger già allineato al remoto: nessun commit."
    exit 0
  fi
  git commit -m "$MSG" || true

  if git push origin "HEAD:$RAMO"; then
    echo "✓ Ledger pubblicato su $RAMO."
    exit 0
  fi

  echo "::warning::Push del ledger rifiutato (run concorrente?): riprovo con l'unione aggiornata."
  # Il remoto è cambiato: si riparte dal suo stato e si riesegue l'unione.
  git reset --hard "origin/$RAMO" || true
  sleep 5
done

echo "::warning::Ledger non pubblicato dopo 3 tentativi: il ledger DB (notifications_log) resta la fonte primaria."
exit 0
