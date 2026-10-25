#!/usr/bin/env python3
"""
Riconciliazione anagrafica Udine: elenco fornito ↔ master ministeriale.

NON scrive mai nel master. Produce un report CSV riga per riga con l'abbinamento
proposto, così la revisione umana decide cosa applicare.

Perché serve un passaggio di riconciliazione: nell'elenco fornito (67 scuole)
i CODICESCUOLA non corrispondono a quelle scuole nel file ministeriale 2026/27.
52 codici non esistono; dei 15 che esistono, 12 puntano a un istituto diverso
(es. `UDIS01700N` nel file è l'ISIS Bonaldo Stringher, non il Malignani, che è
`UDIS01600T`). Denominazioni, domini e comuni invece sono coerenti, quindi
l'abbinamento si costruisce su identità (nome + comune + dominio) e non sul
codice fornito. Provincia (UD) e regione (FVG) sono costanti e non si riportano.

Il report ricalcola l'evidenza a ogni esecuzione: se il master cambia (nuovo
export), `sitoAttualeMaster`, `dominioInUsoNelCsv` e `azioneProposta` si
aggiornano e un abbinamento diventato sbagliato si vede subito.

Uso:
    python riconcilia_anagrafica_ud.py
    python riconcilia_anagrafica_ud.py --master altro.json --out report.csv
"""

import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

# codice fornito | denominazione fornita | sito richiesto | testa d'istituto proposta
# (la testa d'istituto è il record con `codice == istitutoCodice`, non un plesso).
ELENCO = """
UDIC82000B|IC MICHELE GORTANI Comeglians|iccomeglians.edu.it|UDIC80900E
UDIC830002|IC CAMILLO BENSO CONTE DI CAVOUR Palazzolo Dello Stella|icpalazzolo.edu.it|UDIC85900G
UDIC81400A|IC JACOPO LINUSSIO - ANGELO MATIZ Paluzza|iclinussiomatiz.edu.it|UDIC81200A
UDIC827006|IC DANTE ALIGHIERI San Pietro Al Natisone|icsanpietroalnatisone.it|UDMM021017
UDIC83300D|IC MAJANO E FORGARIA Majano|icmajanoforgaria.edu.it|UDIC86000Q
UDIC831001|IC GIOSUÈ CARDUCCI Lignano Sabbiadoro|iclignano.edu.it|UDIC81600N
UDIC84600E|IC PAGNACCO - MARTIGNACCO Pagnacco|icpm.edu.it|UDIC81700D
UDIC834008|IC DIVISIONE JULIA Fagagna|icfagagna.edu.it|UDIC818009
UDIC848006|IC BASILIANO e SEDEGLIANO Sedegliano|icbasiliano-sedegliano.edu.it|UDIC819005
UDIC828002|IC GIOVANNI XXIII Tricesimo|ictricesimo.edu.it|UDIC820009
UDIC855009|IC DESTRA TORRE Aiello Del Friuli|icdestratorre.edu.it|UDIC86200B
UDIC82900X|IC CUORE DELLO STELLA Rivignano Teor|icrivignano.edu.it|UDIC85900G
UDIC81300E|IC VAL TAGLIAMENTO Ampezzo|icvaltagliamento.edu.it|UDIC82300R
UDIC82400E|IC ANTONIO COCEANI Pavia Di Udine|icpaviadiudine.edu.it|UDIC826008
UDIC82500A|IC Faedis|icfaedis.edu.it|UDIC827004
UDIC832007|IC Buja|icbuja.edu.it|UDIC86000Q
UDIC85200R|IC Tavagnacco|ictavagnacco.edu.it|UDIC82900Q
UDIC82300P|IC Tarcento|ictarcento.edu.it|UDIC83000X
UDIC826006|IC TINA MODOTTI Premariacco|icpremariacco.edu.it|UDIC83100Q
UDIC84700A|IC Gonars|icgonars.edu.it|UDIC83200G
UDIC856005|IC Palmanova|icpalmanova.edu.it|UDIC86200B
UDIC857001|IC PAOLO PETRICIG San Pietro Al Natisone|icpetricig.edu.it|UDIC834007
UDIC83800R|IC CECILIA DEGANUTTI Latisana|iclatisana.edu.it|UDIC835003
UDIC84100C|IC UNIVERSITA' CASTRENSE San Giorgio Di Nogaro|icuniversitacastrense.edu.it|UDIC83700P
UDIC83600L|IC LESTIZZA - TALMASSONS Lestizza|iclestizza-talmassons.edu.it|UDIC86100G
UDIC83500R|IC MORTEGLIANO - CASTIONS STRADA Mortegliano|icmorteglianocastionsdistrada.edu.it|UDIC86100G
UDIC85800R|IC I Udine|1icudine.edu.it|UDIC84100A
UDIC85900L|IC II Udine|2icudine.edu.it|UDIC842006
UDIC86000R|IC III Udine|3icudine.edu.it|UDIC85700X
UDIC86100L|IC IV Udine|4icudine.edu.it|UDIC843002
UDIC86200C|IC V Udine|5icudine.edu.it|UDIC84400T
UDIC863007|IC VI Udine|6icudine.edu.it|UDIC85800Q
UDIC81800D|IC Trasaghis|ictrasaghis.edu.it|UDIC84500N
UDIC844002|IC DON LORENZO MILANI Aquileia|icaquileia.edu.it|UDIC84600D
UDIC843006|IC Cervignano Del Friuli|iccervignanodelfriuli.edu.it|UDIC847009
UDIC85300L|IC Manzano|icmanzano.edu.it|UDIC848005
UDIC851001|IC Codroipo|iccodroipo.edu.it|UDIC849001
UDIC85400C|IC Cividale Del Friuli|iccividale.edu.it|UDIC851001
UDIC83700C|IC San Daniele Del Friuli|icsandanieledelfriuli.edu.it|UDIC85200R
UDIC819008|IC Gemona Del Friuli|icgemona.edu.it|UDIC85300L
UDIC821007|IC Tolmezzo|ictolmezzo.edu.it|UDIC85400C
UDIC822003|IC Pozzuolo Del Friuli|istitutocomprensivopozzuolodelfriuli.edu.it|UDIC855008
UDIC850005|IC Pasian Di Prato|icpasiandiprato.edu.it|UDIC856004
UDIS01600T|ISIS E. MATTEI Latisana|isislatisana.edu.it|UDIS00400G
UDIS007003|ISIS RAIMONDO D'ARONCO Gemona Del Friuli|daronco.edu.it|UDIS006007
UDIS014006|ISIS PAOLINO D'AQUILEIA Cividale Del Friuli|paolinodaquileia.edu.it|UDIS007003
UDIC815006|Istituto Omnicomprensivo I. BACHMANN Tarvisio|tarvisioscuole.it|UDIS00900P
UDIS00800V|ISIS JACOPO LINUSSIO Codroipo|linussio.edu.it|UDIS01100P
UDIS00900P|ISIS VINCENZO MANZINI San Daniele Del Friuli|isismanzini.edu.it|UDIS01200E
UDIS019009|ISIS ISIS DELLA BASSA FRIULANA Cervignano Del Friuli|isisdellabassafriulana.edu.it|UDIS01300A
UDIS00300Q|ISIS FERMO SOLARI Tolmezzo|isisfermosolari.edu.it|UDIS014006
UDIS01700N|ISIS ARTURO MALIGNANI Udine|malignani.ud.it|UDIS01600T
UDIS01800D|ISIS BONALDO STRINGHER Udine|stringher.it|UDIS01700N
UDIS00200A|ISIS MAGRINI-MARCHETTI Gemona Del Friuli|isismagrinimarchetti.edu.it|UDIS01800D
UDIS00400G|ISIS PASCHINI-LINUSSIO Tolmezzo|paschinilinussio.edu.it|UDIS019009
UDTD02000A|ISIS CECILIA DEGANUTTI Udine|itsdeganutti.edu.it|UDIS021009
UDMM100008|CPIA 1 UDINE Udine|cpiaudine.edu.it|UDMM098007
UDPC020007|Liceo Cl. JACOPO STELLINI Udine|stelliniudine.edu.it|UDPC010005
UDPM010009|Liceo CATERINA PERCOTO Udine|liceopercoto.edu.it|UDPM010009
UDPS010008|Liceo Sc. GIOVANNI MARINELLI Udine|liceomarinelli.edu.it|UDPS010008
UDPS02000E|Liceo Sc. NICCOLO' COPERNICO Udine|liceocopernico.edu.it|UDPS05000P
UDRI010001|IPSIA GIACOMO CECONI Udine|gceconi.eu|UDRI040009
UDSL010009|Liceo Art. GIOVANNI SELLO Udine|arteudine.edu.it|UDSD01000P
UDTD01000L|IT ANTONIO ZANON Udine|itzanon.edu.it|UDTD010004
UDTL01000B|ITG GIAN GIACOMO MARINONI Udine|itmarinoni.edu.it|UDTL01000E
UDVC01000C|Convitto Nazionale PAOLO DIACONO Cividale Del Friuli|cnpd.it|UDVC01000C
UDVE010001|Educandato COLLEGIO UCCELLIS Udine|educandatouccellis.edu.it|UDVE01000B
""".strip()


GENERICI = frozenset(
    "IC ISIS IIS IT ITG IPSIA LICEO ISTITUTO COMPRENSIVO OMNICOMPRENSIVO SUPERIORE "
    "SCUOLA STATALE NAZIONALE CONVITTO EDUCANDATO CPIA CL SC ART DI DEL DELLA DEI DEGLI".split()
)
COLONNE = (
    "numero",
    "codiceFornito",
    "denominazioneFornita",
    "sitoRichiesto",
    "codiceMasterProposto",
    "denominazioneMaster",
    "comuneMaster",
    "sitoAttualeMaster",
    "azioneProposta",
    "confidenza",
    "dominioInUsoNelCsv",
    "abbinamentoCondiviso",
    "note",
)


def testo(valore: object) -> str:
    if valore is None:
        return ""
    if valore is True:
        return "SI"
    if valore is False:
        return "NO"
    return str(valore)


def normalizza(valore: object) -> str:
    t = unicodedata.normalize("NFKD", testo(valore).upper())
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"[^A-Z0-9]+", " ", t).strip()


def dominio(valore: object) -> str:
    """Host ripulito: niente schema, `www.` ripetuto, path, porta."""
    t = testo(valore).strip().lower()
    t = re.sub(r"^[a-z]+:?//+", "", t).split("/")[0].split(":")[0]
    while t.startswith("www."):
        t = t[4:]
    return t


def famiglia(valore: object) -> str:
    """
    Dominio senza suffisso né punteggiatura: `icpm.edu.it`, `www.icpm.gov.it` e
    `icpm` collassano sulla stessa chiave; `iclestizza-talmassons.edu.it` no.
    """
    d = dominio(valore)
    d = re.sub(r"\.(edu|gov|istruzione)\.it$|\.it$|\.eu$|\.org$|\.com$", "", d)
    return re.sub(r"[^a-z0-9]", "", d)


def parole(valore: object) -> set[str]:
    return {p for p in normalizza(valore).split() if len(p) > 2 and p not in GENERICI}


def comune_dentro(nome: str, comune: object) -> bool:
    """La denominazione fornita termina (o contiene) il comune dell'istituto?"""
    c = normalizza(comune)
    return bool(c) and (" " + c) in (" " + normalizza(nome))


def carica_master(percorso: Path) -> tuple[dict[str, dict], dict[str, list[dict]]]:
    dati = json.loads(percorso.read_text(encoding="utf-8-sig"))
    elenco = dati.get("scuole") if isinstance(dati, dict) else dati
    per_codice = {str(r["codice"]): r for r in elenco}
    per_istituto: dict[str, list[dict]] = {}
    for rec in elenco:
        per_istituto.setdefault(str(rec.get("istitutoCodice") or rec["codice"]), []).append(rec)
    return per_codice, per_istituto


def valuta(riga: list[str], per_codice: dict, per_istituto: dict, condivisioni: dict[str, list[str]]) -> dict[str, str]:
    """Costruisce una riga di report: abbinamento proposto + evidenza ricalcolata."""
    codice, nome, sito, proposto = riga
    target = per_codice.get(proposto)
    fornito = per_codice.get(codice)
    base = {
        "codiceFornito": codice,
        "denominazioneFornita": nome,
        "sitoRichiesto": dominio(sito),
        "codiceMasterProposto": proposto,
    }
    if target is None:
        return {**base, "azioneProposta": "verifica manuale", "confidenza": "bassa",
                "note": f"codice proposto {proposto} assente dal master"}

    famiglia_richiesta = famiglia(sito)
    siti_istituto = {famiglia(r.get("sitoWeb")) for r in per_istituto.get(proposto, []) if r.get("sitoWeb")}
    in_uso = "SI" if famiglia_richiesta in siti_istituto else "NO"
    nome_coerente = (
        codice == proposto
        or famiglia_richiesta in siti_istituto
        or len(parole(nome) & parole(target.get("nome"))) >= 2
        or comune_dentro(nome, target.get("comune"))
    )
    condiviso = "SI" if len(condivisioni.get(proposto, [])) > 1 else "NO"

    if dominio(target.get("sitoWeb")) == dominio(sito):
        azione = "già allineato"
    else:
        azione = "aggiorna sitoWeb"

    if in_uso == "SI" or codice == proposto:
        confidenza = "alta"
    elif nome_coerente and condiviso == "NO":
        confidenza = "media"
    else:
        confidenza = "bassa"

    note = []
    if fornito is not None and codice != proposto:
        note.append(f"codice fornito = {fornito['nome']} ({fornito['comune']})")
    elif fornito is None:
        note.append("codice fornito assente dal master")
    if in_uso == "SI":
        note.append(f"dominio già in uso nell'istituto {proposto}")
    if condiviso == "SI":
        altri = [c for c in condivisioni[proposto] if c != codice]
        note.append(f"istituto condiviso con {', '.join(altri)}: scegliere un solo dominio")
    if not nome_coerente:
        note.append("denominazione non sovrapponibile: abbinamento da confermare")

    return {
        **base,
        "denominazioneMaster": testo(target.get("nome")),
        "comuneMaster": testo(target.get("comune")),
        "sitoAttualeMaster": dominio(target.get("sitoWeb")) or "(nessuno)",
        "azioneProposta": azione if confidenza != "bassa" else "verifica manuale",
        "confidenza": confidenza,
        "dominioInUsoNelCsv": in_uso,
        "abbinamentoCondiviso": condiviso,
        "note": "; ".join(note),
    }


def main(argv: list[str] | None = None) -> int:
    for flusso in (sys.stdout, sys.stderr):
        if hasattr(flusso, "reconfigure"):
            flusso.reconfigure(encoding="utf-8", errors="replace")
    base = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description="Report di riconciliazione anagrafica Udine (sola lettura).")
    parser.add_argument("--master", metavar="FILE", help="default: anagrafica_scuole_master.json")
    parser.add_argument("--out", metavar="FILE", help="default: anagrafica_ud_riconciliazione.csv")
    args = parser.parse_args(argv)

    percorso_master = Path(args.master) if args.master else base / "anagrafica_scuole_master.json"
    uscita = Path(args.out) if args.out else base / "anagrafica_ud_riconciliazione.csv"
    if not percorso_master.is_file():
        print(f"✗ master non trovato: {percorso_master}")
        return 1

    per_codice, per_istituto = carica_master(percorso_master)
    righe = [r.split("|") for r in ELENCO.splitlines() if r.strip()]
    condivisioni: dict[str, list[str]] = {}
    for riga in righe:
        condivisioni.setdefault(riga[3], []).append(riga[0])

    report = [valuta(riga, per_codice, per_istituto, condivisioni) for riga in righe]
    for numero, riga_report in enumerate(report, 1):
        riga_report["numero"] = str(numero)
    uscita.parent.mkdir(parents=True, exist_ok=True)
    with uscita.open("w", encoding="utf-8-sig", newline="") as fh:
        scrittore = csv.DictWriter(fh, fieldnames=COLONNE, delimiter=";", restval="")
        scrittore.writeheader()
        scrittore.writerows(report)

    confidenze = {c: sum(1 for r in report if r["confidenza"] == c) for c in ("alta", "media", "bassa")}
    azioni = {a: sum(1 for r in report if r["azioneProposta"] == a)
              for a in ("aggiorna sitoWeb", "già allineato", "verifica manuale")}
    print(f"Righe: {len(report)} · confidenza alta/media/bassa: "
          f"{confidenze['alta']}/{confidenze['media']}/{confidenze['bassa']}")
    print("Azioni proposte: " + " · ".join(f"{k} {v}" for k, v in azioni.items()))
    print(f"✓ {uscita}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

