#!/usr/bin/env python3
"""
ScuoleRadar.it — ANAGRAFICA SCUOLE · integrazione e deduplica dei CSV ministeriali.

Legge i file ufficiali del Ministero dalla cartella `anagrafica_ministeriale/`,
li unisce usando `CODICESCUOLA` (codice meccanografico) come chiave primaria e
produce due artefatti:

  · `anagrafica_scuole_master.json`  → anagrafica integrata e pulita
  · `discrepancies_report.json`      → i record in CONFLITTO (stessa scuola,
                                       dati diversi), mai risolti in silenzio

Uso (dalla radice del progetto):

    python process_anagrafica.py                 # integra e confronta col master
    python process_anagrafica.py --dry-run       # analizza e stampa, non scrive
    python process_anagrafica.py --autpar        # include SCUANAAUTPAR (4° file)
    python process_anagrafica.py --confronta export_20252026.csv
    python process_anagrafica.py --strict        # exit 3 se ci sono discrepanze

Le regole di normalizzazione sono le STESSE di `src/lib/anagraficaCsv.ts`
(`campo`, `campoEmail`, `campoSito`, `chiaveCodiceScuola`): `Non Disponibile` e i
placeholder noti valgono "assente", le email sono in minuscolo, il sito è ridotto
al solo host. Così il JSON prodotto è leggibile dall'app senza una seconda
normalizzazione — e i confronti non segnalano come conflitto una differenza che è
solo di grafia.

Gerarchia delle fonti per i campi in disaccordo (vince la prima):
`SCUANAGRAFESTAT` > `SCUANAAUTSTAT` > `SCUANAGRAFEPAR` > `SCUANAAUTPAR`.
Il valore scartato NON si perde: finisce nel report con la sua fonte.

Solo libreria standard: nessuna dipendenza da installare.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------- convenzioni

# Prefissi ufficiali (come `PREFISSI_ANAGRAFICA` in `src/lib/anagraficaCsv.ts`).
PREFISSI = (
    "SCUANAGRAFESTAT",
    "SCUANAAUTSTAT",
    "SCUANAGRAFEPAR",
    "SCUANAAUTPAR",
)
# I tre file richiesti dall'integrazione; AUTPAR è un extra (opt-in).
PREFISSI_BASE = PREFISSI[:3]
PREFISSO_EXTRA = PREFISSI[3]

# Più alto = più autorevole quando due file dichiarano cose diverse.
PRECEDENZA = {
    "SCUANAGRAFESTAT": 4,
    "SCUANAAUTSTAT": 3,
    "SCUANAGRAFEPAR": 2,
    "SCUANAAUTPAR": 1,
}

# Valore ufficiale del MIM per "dato non pubblicato" + placeholder visti in giro
# (gli stessi di `scripts/import-schools-local.ts`).
NON_DISPONIBILE = re.compile(r"^non\s*disponibile$", re.IGNORECASE)
PLACEHOLDER = frozenset({"", "-", "--", "---", "ND", "N.D.", "N/D", "N.A.", "N/A", "..."})

# Codici provincia italiani: servono solo a validare il prefisso del codice
# meccanografico (`ENAA80501L` → `EN`); le grafie per esteso restano al nome.
PROVINCE = frozenset(
    "AG AL AN AO AP AQ AR AT AV BA BG BI BL BN BO BR BS BT BZ CA CB CE CH CL CN CO CR "
    "CS CT CZ EN FC FE FG FI FM FR GE GO GR IM IS KR LC LE LI LO LT LU MB MC ME MI MN "
    "MO MS MT NA NO NU OR PA PC PD PE PG PI PN PO PR PT PU PV PZ RA RC RE RG RI RM RN "
    "RO SA SI SO SP SR SS SU SV TA TE TN TO TP TR TS TV UD VA VB VC VE VI VR VT VV".split()
)

STATI_SI = frozenset({"SI", "S", "SÌ", "TRUE", "1"})
STATI_NO = frozenset({"NO", "N", "FALSE", "0"})

# Campo canonico → colonna ministeriale (i file hanno colonne diverse).
MAPPA_COLONNE = {
    "istitutoCodice": "CODICEISTITUTORIFERIMENTO",
    "istitutoNome": "DENOMINAZIONEISTITUTORIFERIMENTO",
    "nome": "DENOMINAZIONESCUOLA",
    "indirizzo": "INDIRIZZOSCUOLA",
    "cap": "CAPSCUOLA",
    "codiceComune": "CODICECOMUNESCUOLA",
    "comune": "DESCRIZIONECOMUNE",
    "provinciaNome": "PROVINCIA",
    "regione": "REGIONE",
    "areaGeografica": "AREAGEOGRAFICA",
    "tipo": "DESCRIZIONETIPOLOGIAGRADOISTRUZIONESCUOLA",
    "caratteristica": "DESCRIZIONECARATTERISTICASCUOLA",
    "email": "INDIRIZZOEMAILSCUOLA",
    "pec": "INDIRIZZOPECSCUOLA",
    "sitoWeb": "SITOWEBSCUOLA",
    "annoScolastico": "ANNOSCOLASTICO",
}

# Campi testuali confrontati ignorando accenti, punteggiatura e spazi: «S.M.S.
# "SALVATONI"» e «SMS SALVATONI» sono la stessa scuola, non un conflitto.
CAMPI_TESTUALI = frozenset(
    {"nome", "istitutoNome", "indirizzo", "comune", "provinciaNome", "regione",
     "areaGeografica", "tipo", "caratteristica"}
)

# ------------------------------------------------------------- normalizzatori


def campo(valore: str | None) -> str | None:
    """Campo CSV → valore utile: spazi compattati; assente/placeholder → None."""
    pulito = re.sub(r"\s+", " ", (valore or "")).strip()
    if not pulito or NON_DISPONIBILE.match(pulito) or pulito.upper() in PLACEHOLDER:
        return None
    return pulito


def campo_email(valore: str | None) -> str | None:
    """Email/PEC in minuscolo (come `campoEmail`)."""
    pulito = campo(valore)
    return pulito.lower() if pulito else None


def campo_sito(valore: str | None) -> str | None:
    """
    `SITOWEBSCUOLA` → solo HOST (`www.iccarducci.edu.it` → `iccarducci.edu.it`).

    Stessa tolleranza di `campoSito`: il MIM scrive anche lo schema senza i due
    punti (`https//icscuola.edu.it/`) e lo slash finale è quasi sempre presente.
    Un valore che non è un dominio vale None.
    """
    grezzo = campo(valore)
    if not grezzo:
        return None
    senza_schema = re.sub(r"^https?:?//", "", grezzo.lower())
    host = re.split(r"[/?#]", senza_schema)[0].rstrip(".")
    # `www.` RIPETUTO (`www.www.icsanremocalvino.it` esiste davvero nei file): si
    # tolgono tutte le occorrenze, così normalizzare un valore già normalizzato non
    # cambia nulla e il confronto con il master non inventa conflitti.
    host = re.sub(r"^(?:www\.)+", "", host)
    return host if re.match(r"^(?:[a-z0-9-]+\.)+[a-z]{2,}$", host) else None


def chiave_codice(valore: str | None) -> str | None:
    """
    `CODICESCUOLA` → chiave dell'indice.

    Permissiva di proposito (come `chiaveCodiceScuola`): i codici delle paritarie
    e delle autonomie (`UD1A036009`, `TB1E002003`) non seguono la convenzione MIM
    statale `XXYY12345Z`, e una validazione severa scarterebbe 11.000+ scuole.
    """
    pulito = re.sub(r"[^A-Z0-9]", "", (valore or "").upper())
    return pulito if 6 <= len(pulito) <= 16 else None


def chiave_testo(valore: str | None) -> str:
    """Chiave di confronto per i testi: maiuscole, senza accenti, solo alfanumerici."""
    senza_accenti = unicodedata.normalize("NFD", (valore or "").upper())
    senza_accenti = "".join(c for c in senza_accenti if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z0-9]", "", senza_accenti)


def campo_cap(valore: str | None) -> str | None:
    """
    CAP → 5 cifre. Excel e i tracciati vecchi mangiano gli zeri iniziali
    (`8038` → `08038`), quindi si riallinea; il resto (`.`, `-----`) è assente.
    """
    pulito = campo(valore)
    if not pulito:
        return None
    cifre = re.sub(r"\D", "", pulito)
    if not cifre:
        return None
    return cifre.zfill(5) if len(cifre) <= 5 else cifre


def campo_flag(valore: str | None) -> bool | None:
    """`SI`/`NO`/`ND` → True/False/None (None = la fonte non lo dichiara)."""
    pulito = (campo(valore) or "").upper()
    if pulito in STATI_SI:
        return True
    if pulito in STATI_NO:
        return False
    return None


def provincia_da_codice(codice: str | None) -> str | None:
    """Provincia dal prefisso del codice meccanografico (`ENAA80501L` → `EN`)."""
    if not codice or len(codice) < 2:
        return None
    prefisso = codice[:2]
    return prefisso if prefisso in PROVINCE else None


def uguali(campo_nome: str, primo: object, secondo: object) -> bool:
    """Due valori (già normalizzati) dicono la stessa cosa?"""
    if campo_nome in CAMPI_TESTUALI:
        return chiave_testo(str(primo)) == chiave_testo(str(secondo))
    if campo_nome == "cap":
        return campo_cap(str(primo)) == campo_cap(str(secondo))
    return str(primo).strip().upper() == str(secondo).strip().upper()


# ------------------------------------------------------------- lettura file


def rileva_delimitatore(prima_riga: str) -> str:
    """Separatore dell'intestazione: il MIM pubblica `,`, ma i vecchi export `;`."""
    return max((",", ";", "\t"), key=prima_riga.count)


def normalizza_campi(voce: dict[str, object], leggi) -> None:
    """
    Riempie i campi canonici di `voce` leggendo il grezzo con `leggi(campo, colonna)`.

    Unica sede delle regole di normalizzazione: la usano sia i CSV ministeriali sia
    un dataset esterno già integrato (`--confronta`), così il confronto avviene fra
    valori omogenei e non fra grafie diverse.
    """
    for campo_nome, colonna in MAPPA_COLONNE.items():
        grezzo = leggi(campo_nome, colonna)
        if campo_nome in ("email", "pec"):
            voce[campo_nome] = campo_email(grezzo)
        elif campo_nome == "sitoWeb":
            voce[campo_nome] = campo_sito(grezzo)
        elif campo_nome == "cap":
            voce[campo_nome] = campo_cap(grezzo)
        elif campo_nome == "istitutoCodice":
            voce[campo_nome] = chiave_codice(grezzo)
        else:
            voce[campo_nome] = campo(grezzo)
    voce["provinciaCodice"] = provincia_da_codice(str(voce["codice"]))
    voce["sedeDirettivo"] = campo_flag(leggi("sedeDirettivo", "INDICAZIONESEDEDIRETTIVO"))
    # La colonna mescola codici istituto e `Non Disponibile`: prima il sentinella,
    # poi la chiave — altrimenti «NONDISPONIBILE» passa la lunghezza 6–16 e diventa
    # un codice valido (bug visto sul campo, 51.000 righe).
    voce["sedeOmnicomprensivo"] = chiave_codice(
        campo(leggi("sedeOmnicomprensivo", "INDICAZIONESEDEOMNICOMPRENSIVO"))
    )
    voce["sedeScolastica"] = campo_flag(leggi("sedeScolastica", "SEDESCOLASTICA"))


def leggi_csv(percorso: Path) -> tuple[list[dict[str, object]], dict[str, object]]:
    """
    Un file ministeriale → (record canonici, statistiche di lettura).

    Le colonne si cercano per NOME: i file statali ne hanno 20, le paritarie 14,
    e la stessa informazione non è sempre nella stessa posizione.
    """
    testo = percorso.read_text(encoding="utf-8-sig", errors="replace")
    if not testo.strip():
        raise ValueError("file vuoto")
    delimitatore = rileva_delimitatore(testo.splitlines()[0])
    righe = [r for r in csv.reader(io.StringIO(testo, newline=""), delimiter=delimitatore) if r]
    if len(righe) < 2:
        raise ValueError("intestazione o righe dati mancanti")
    colonne = {nome.strip().upper(): i for i, nome in enumerate(righe[0])}
    paritaria = "PAR" in percorso.name.upper()

    record: list[dict[str, object]] = []
    scartate = 0
    for riga in righe[1:]:
        grezzi = {
            nome: (riga[indice] if indice < len(riga) else None) for nome, indice in colonne.items()
        }
        codice = chiave_codice(grezzi.get("CODICESCUOLA"))
        if not codice:
            scartate += 1
            continue
        voce: dict[str, object] = {"codice": codice}
        normalizza_campi(voce, lambda _campo, colonna: grezzi.get(colonna))
        voce["paritaria"] = paritaria
        voce["fonti"] = [percorso.name]
        record.append(voce)

    return record, {
        "file": percorso.name,
        "righe": len(record),
        "scartate": scartate,
        "separatore": delimitatore,
    }


# ------------------------------------------------------- scoperta dei file


def prefisso_di(nome_file: str) -> str:
    """Prefisso ministeriale del file (`SCUANAGRAFESTAT202627…` → `SCUANAGRAFESTAT`)."""
    maiuscolo = nome_file.upper()
    return next((p for p in PREFISSI if maiuscolo.startswith(p)), "")


def scopri_file(cartella: Path, prefissi: tuple[str, ...]) -> tuple[list[Path], list[str]]:
    """
    Un file per prefisso: il PIÙ RECENTE (la data dell'export è nel nome).

    Due export dello stesso tipo nella stessa cartella non si integrano fra loro:
    il più vecchio si confronta esplicitamente con `--confronta`, altrimenti la
    gerarchia delle fonti diventerebbe ambigua.
    """
    scelti: list[Path] = []
    ignorati: list[str] = []
    presenti = sorted(p for p in cartella.glob("*.csv") if p.is_file())
    for prefisso in prefissi:
        candidati = [p for p in presenti if p.name.upper().startswith(prefisso)]
        if not candidati:
            continue
        scelti.append(candidati[-1])
        ignorati.extend(p.name for p in candidati[:-1])
    return scelti, ignorati


def _testo(valore: object) -> str | None:
    """Valore di un dataset già integrato → testo (i flag booleani tornano `SI`/`NO`)."""
    if valore is None:
        return None
    if isinstance(valore, bool):
        return "SI" if valore else "NO"
    return str(valore)


def normalizza_esterno(rec: dict, etichetta: str) -> dict[str, object] | None:
    """Record di un dataset esterno (master o export) → record canonico."""
    codice = chiave_codice(_testo(rec.get("codice")) or _testo(rec.get("CODICESCUOLA")))
    if not codice:
        return None
    voce: dict[str, object] = {"codice": codice}
    normalizza_campi(voce, lambda campo_nome, colonna: _testo(rec.get(campo_nome, rec.get(colonna))))
    voce["paritaria"] = bool(rec.get("paritaria", False))
    fonti = rec.get("fonti")
    voce["fonti"] = [str(f) for f in fonti] if isinstance(fonti, list) else [etichetta]
    return voce


def leggi_esistente(percorso: Path) -> dict[str, dict[str, object]]:
    """
    Dataset già prodotto → indice per codice scuola.

    Accetta il master (JSON con `scuole`, oppure una lista) e un CSV: confrontare
    l'export nuovo con quello dell'anno prima è lo stesso problema, e la stessa
    normalizzazione evita di segnalare come conflitto una differenza di grafia.
    """
    etichetta = percorso.name
    if percorso.suffix.lower() == ".csv":
        record, _ = leggi_csv(percorso)
        return {str(r["codice"]): r for r in record}
    dati = json.loads(percorso.read_text(encoding="utf-8-sig"))
    elenco: object = dati
    if isinstance(dati, dict):
        elenco = next(
            (dati[k] for k in ("scuole", "records", "data", "anagrafica") if isinstance(dati.get(k), list)),
            [v for v in dati.values() if isinstance(v, dict)],
        )
    indice: dict[str, dict[str, object]] = {}
    for rec in elenco if isinstance(elenco, list) else []:
        if not isinstance(rec, dict):
            continue
        voce = normalizza_esterno(rec, etichetta)
        if voce:
            indice[str(voce["codice"])] = voce
    return indice


# ------------------------------------------------------------- integrazione

# Campi derivati o di tracciamento: non si confrontano mai fra fonti.
NON_CONFRONTABILI = frozenset({"codice", "fonti", "paritaria", "provinciaCodice"})


def integra(
    per_fonte: dict[str, list[dict[str, object]]],
) -> tuple[
    dict[str, dict[str, object]],
    dict[str, list[dict[str, object]]],
    list[dict[str, object]],
]:
    """
    Unisce i record delle fonti su `CODICESCUOLA` (chiave primaria).

    Per ogni campo vince la fonte più autorevole (`PRECEDENZA`) e si completa con
    le altre quando è vuoto: il file statale, per esempio, non dichiara il
    riferimento d'istituto delle paritarie e viceversa. Un valore DIVERSO su un
    campo già valorizzato è un conflitto: si tiene quello autorevole e lo scarto
    finisce nel report, mai nel silenzio.
    """
    scuole: dict[str, dict[str, object]] = {}
    titolari: dict[str, dict[str, str]] = {}
    conflitti: dict[str, list[dict[str, object]]] = {}
    duplicati: list[dict[str, object]] = []
    ordinate = sorted(per_fonte, key=lambda nome: (-PRECEDENZA.get(prefisso_di(nome), 0), nome))

    for nome_file in ordinate:
        for rec in per_fonte[nome_file]:
            codice = str(rec["codice"])
            corrente = scuole.get(codice)
            if corrente is None:
                scuole[codice] = dict(rec)
                titolari[codice] = {
                    campo_nome: nome_file for campo_nome, valore in rec.items() if valore is not None
                }
                continue
            if nome_file in corrente["fonti"]:
                duplicati.append({"codice": codice, "file": nome_file})
                continue
            corrente["fonti"] = [*corrente["fonti"], nome_file]
            for campo_nome, valore in rec.items():
                if campo_nome in NON_CONFRONTABILI or valore is None:
                    continue
                attuale = corrente.get(campo_nome)
                if attuale is None:
                    corrente[campo_nome] = valore
                    titolari[codice][campo_nome] = nome_file
                elif not uguali(campo_nome, attuale, valore):
                    conflitti.setdefault(codice, []).append(
                        _scontro(
                            campo_nome,
                            attuale,
                            titolari[codice].get(campo_nome, nome_file),
                            valore,
                            nome_file,
                            "fra_fonti",
                        )
                    )
    return scuole, conflitti, duplicati


def _scontro(
    campo_nome: str,
    mantenuto: object,
    fonte_mantenuta: str,
    scartato: object,
    fonte_scartata: str,
    tipo: str,
) -> dict[str, object]:
    """Voce del report: che campo, il valore tenuto, quello scartato e chi lo dichiara."""
    return {
        "tipo": tipo,
        "campo": campo_nome,
        "valoreMantenuto": mantenuto,
        "fonteMantenuto": fonte_mantenuta,
        "valoreScartato": scartato,
        "fonteScartato": fonte_scartata,
    }


def confronta(
    scuole: dict[str, dict[str, object]],
    esistenti: dict[str, dict[str, object]],
    etichetta: str,
    conflitti: dict[str, list[dict[str, object]]],
) -> list[str]:
    """
    Confronta l'integrazione con un dataset già esistente (master o export).

    Per la stessa scuola, un campo valorizzato in entrambi ma diverso è una
    discrepanza: si tiene il dato NUOVO (l'export ministeriale è la fonte
    aggiornata) e si registra quello vecchio con la sua provenienza. Restituisce i
    codici presenti solo nell'esistente: la scuola è sparita dall'export, non
    dalle "cose che sappiamo", quindi resta nel master.
    """
    solo_esistenti: list[str] = []
    for codice, precedente in esistenti.items():
        corrente = scuole.get(codice)
        if corrente is None:
            solo_esistenti.append(codice)
            continue
        for campo_nome, valore_vecchio in precedente.items():
            if campo_nome in NON_CONFRONTABILI or valore_vecchio is None:
                continue
            valore_nuovo = corrente.get(campo_nome)
            if valore_nuovo is None or uguali(campo_nome, valore_vecchio, valore_nuovo):
                continue
            conflitti.setdefault(codice, []).append(
                _scontro(campo_nome, valore_nuovo, "integrazione", valore_vecchio, etichetta, "con_esistente")
            )
    return solo_esistenti


# --------------------------------------------------------------- scrittura


def scrivi_master(percorso: Path, scuole: dict[str, dict[str, object]], meta: dict[str, object]) -> None:
    """
    Master JSON: una scuola per riga, ordinate per codice.

    Un `json.dumps` compatto su tutto l'oggetto produrrebbe una riga da decine di
    MB (illeggibile e con diff inutili): qui `meta` resta su una riga e ogni
    scuola è una riga, così un `git diff` dice esattamente quali codici cambiano.
    Scrittura su file temporaneo + sostituzione: un'interruzione non lascia un
    master troncato.
    """
    righe = [
        json.dumps(scuole[codice], ensure_ascii=False, separators=(",", ":"))
        for codice in sorted(scuole)
    ]
    testo = (
        '{"meta":' + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ',"scuole":[\n'
        + ",\n".join(righe)
        + "\n]}\n"
    )
    temporaneo = percorso.with_name(percorso.name + ".tmp")
    temporaneo.write_text(testo, encoding="utf-8")
    temporaneo.replace(percorso)


def costruisci_report(
    scuole: dict[str, dict[str, object]],
    conflitti: dict[str, list[dict[str, object]]],
    duplicati: list[dict[str, object]],
    solo_esistenti: list[str],
    meta: dict[str, object],
) -> dict[str, object]:
    """
    Report dei conflitti: una voce per scuola, con tutte le divergenze trovate.

    Il report si scrive SEMPRE, anche vuoto (`discrepanze: []`): chi legge non deve
    distinguere "nessun conflitto" da "il controllo non è stato eseguito".
    """
    voci = []
    for codice in sorted(conflitti):
        scuola = scuole.get(codice, {})
        voci.append(
            {
                "codiceScuola": codice,
                "denominazione": scuola.get("nome") or scuola.get("istitutoNome"),
                "comune": scuola.get("comune"),
                "provincia": scuola.get("provinciaNome"),
                "paritaria": scuola.get("paritaria"),
                "fonti": scuola.get("fonti", []),
                "conflitti": conflitti[codice],
            }
        )
    return {
        "meta": {
            **meta,
            "totaleScuoleConflitto": len(voci),
            "totaleCampiConflitto": sum(len(valori) for valori in conflitti.values()),
            "duplicatiNelloStessoFile": duplicati,
            "scuoleSoloInEsistente": sorted(solo_esistenti),
        },
        "discrepanze": voci,
    }


# --------------------------------------------------------------------- CLI


def leggi_argomenti(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="process_anagrafica.py",
        description="Integra e deduplica i CSV dell'anagrafica ministeriale su CODICESCUOLA.",
        epilog="Exit: 0 ok · 1 file illeggibile/mancante · 3 discrepanze trovate con --strict.",
    )
    parser.add_argument("--cartella", metavar="DIR", help="cartella dei CSV (default ./anagrafica_ministeriale)")
    parser.add_argument("--master", metavar="FILE", help="master JSON da leggere e riscrivere")
    parser.add_argument("--report", metavar="FILE", help="report dei conflitti da scrivere")
    parser.add_argument(
        "--confronta",
        action="append",
        metavar="FILE",
        help="dataset già esistente (.json o .csv) da confrontare; ripetibile",
    )
    parser.add_argument("--no-confronta", action="store_true", help="non confrontare col master esistente")
    parser.add_argument("--autpar", action="store_true", help="include anche SCUANAAUTPAR")
    parser.add_argument("--dry-run", action="store_true", help="analizza e stampa, nessuna scrittura")
    parser.add_argument("--strict", action="store_true", help="exit 3 se ci sono discrepanze")
    return parser.parse_args(argv)


def percorsi(args: argparse.Namespace) -> tuple[Path, Path, Path]:
    """Cartella dati e artefatti: default ancorati alla posizione dello script."""
    base = Path(__file__).resolve().parent
    ambiente = (os.environ.get("SCUOLERADAR_ANAGRAFICA_DIR") or "").strip()
    cartella = Path(args.cartella or ambiente or base / "anagrafica_ministeriale")
    master = Path(args.master) if args.master else base / "anagrafica_scuole_master.json"
    report = Path(args.report) if args.report else base / "discrepancies_report.json"
    return cartella, master, report


def esegui(args: argparse.Namespace) -> int:
    cartella, master, report = percorsi(args)
    if not cartella.is_dir():
        print(f"✗ Cartella non trovata: {cartella}")
        return 1

    prefissi = PREFISSI_BASE + ((PREFISSO_EXTRA,) if args.autpar else ())
    file_scoperti, ignorati = scopri_file(cartella, prefissi)
    if not file_scoperti:
        print(f"✗ Nessun CSV ministeriale in {cartella} (attesi: {', '.join(prefissi)})")
        return 1

    print(f"ANAGRAFICA — {len(file_scoperti)} file da {cartella}")
    per_fonte: dict[str, list[dict[str, object]]] = {}
    statistiche: list[dict[str, object]] = []
    for percorso in file_scoperti:
        try:
            record, stat = leggi_csv(percorso)
        except (OSError, ValueError, UnicodeError) as errore:
            print(f"✗ {percorso.name}: {errore}")
            return 1
        per_fonte[percorso.name] = record
        statistiche.append(stat)
        print(f"  · {percorso.name}: {stat['righe']} scuole, {stat['scartate']} scartate")
    for nome in ignorati:
        print(f"  · {nome}: ignorato (export superato dal più recente)")

    scuole, conflitti, duplicati = integra(per_fonte)
    print(f"  → integrate su CODICESCUOLA: {len(scuole)} scuole distinte")

    solo_esistenti: list[str] = []
    confrontato: list[str] = []
    if not args.no_confronta and master.is_file():
        esistenti = leggi_esistente(master)
        solo_esistenti = confronta(scuole, esistenti, master.name, conflitti)
        for codice in solo_esistenti:  # il master non perde una scuola che l'export non ha
            scuole[codice] = esistenti[codice]
        confrontato.append(master.name)
        print(f"  · confronto con {master.name}: {len(esistenti)} scuole, {len(solo_esistenti)} solo lì")
    for extra in args.confronta or []:
        percorso = Path(extra)
        if not percorso.is_file():
            print(f"  ! {extra}: non trovato, confronto saltato")
            continue
        confronta(scuole, leggi_esistente(percorso), percorso.name, conflitti)
        confrontato.append(percorso.name)
        print(f"  · confronto con {percorso.name}: fatto")

    anni = sorted(
        {str(r["annoScolastico"]) for elenco in per_fonte.values() for r in elenco if r.get("annoScolastico")}
    )
    meta: dict[str, object] = {
        "generatoIl": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "script": "process_anagrafica.py",
        "cartella": str(cartella),
        "annoScolastico": anni[0] if len(anni) == 1 else anni,
        "chiave": "CODICESCUOLA",
        "fileLetti": statistiche,
        "fileIgnorati": ignorati,
        "confrontatoCon": confrontato,
        "totaleScuole": len(scuole),
        "totaleCampiConflitto": sum(len(valori) for valori in conflitti.values()),
        "scuoleConConflitti": len(conflitti),
        "duplicatiInterni": len(duplicati),
        "scuoleSoloInEsistente": len(solo_esistenti),
    }

    if args.dry_run:
        print("\n[DRY-RUN] nessun file scritto.")
    else:
        scrivi_master(master, scuole, meta)
        dati_report = costruisci_report(scuole, conflitti, duplicati, solo_esistenti, meta)
        report.write_text(json.dumps(dati_report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n✓ {master.name} ({master.stat().st_size / 1_048_576:.1f} MB)")
        print(
            f"✓ {report.name}: {meta['scuoleConConflitti']} scuole in conflitto, "
            f"{meta['totaleCampiConflitto']} campi"
        )

    print(
        f"\nScuole: {len(scuole)} · conflitti: {meta['scuoleConConflitti']} scuole / "
        f"{meta['totaleCampiConflitto']} campi · duplicati interni: {len(duplicati)}"
    )
    if not conflitti:
        print("Nessun conflitto: né fra le fonti né con il dataset esistente.")
    if args.strict and conflitti:
        return 3
    return 0


def main(argv: list[str] | None = None) -> int:
    for flusso in (sys.stdout, sys.stderr):  # accenti e virgolette anche su console cp1252
        if hasattr(flusso, "reconfigure"):
            flusso.reconfigure(encoding="utf-8", errors="replace")
    return esegui(leggi_argomenti(argv))


if __name__ == "__main__":
    raise SystemExit(main())
