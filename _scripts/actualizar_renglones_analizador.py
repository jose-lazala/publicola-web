"""Prepara el cruce de procesos abiertos y familias UNSPSC desde la DGCP."""

import csv
import io
import json
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


BASE = "https://datosabiertos.dgcp.gob.do/api-dgcp/v1/"
ZONA = ZoneInfo("America/Santo_Domingo")
SALIDA = Path(__file__).resolve().parents[1] / "analizador" / "datos" / "renglones.json"


def consultar(ruta, parametros):
    url = BASE + ruta + "?" + urlencode(parametros)
    solicitud = Request(url, headers={
        "User-Agent": "Publicola (+https://publicola.com.do/contacto/)",
        "Origin": "https://publicola.com.do",
        "Accept": "text/csv" if ruta.startswith("tablas/") else "application/json",
    })
    return urlopen(solicitud, timeout=40)


def fecha_local(iso):
    if not isinstance(iso, str) or len(iso) < 19:
        return None
    try:
        # Las fechas del SECP representan la hora dominicana publicada.
        return datetime.fromisoformat(iso[:19]).replace(tzinfo=ZONA)
    except ValueError:
        return None


def procesos_abiertos(ahora):
    abiertos = defaultdict(set)
    page = 1
    while True:
        parametros = {"estado": "Proceso publicado", "limit": 1000}
        if page > 1:
            parametros["page"] = page
        with consultar("procesos", parametros) as respuesta:
            datos = json.load(respuesta)
        if datos.get("code") != 200 or datos.get("hasError") or datos.get("page") != page:
            raise ValueError("La DGCP no devolvió la página esperada")
        for proceso in datos["payload"]["content"] or ():
            publicada = fecha_local(proceso.get("fecha_publicacion"))
            cierre = fecha_local(proceso.get("fecha_fin_recepcion_ofertas"))
            if (publicada and cierre and publicada <= ahora < cierre
                    and proceso.get("estado_proceso") == "Proceso publicado" and proceso.get("codigo_proceso")):
                abiertos[(publicada.year, 1 + int(publicada.month > 6))].add(proceso["codigo_proceso"])
        if page >= (datos.get("pages") or 1):
            return abiertos
        page += 1


def renglones(entrada):
    (anio, semestre), codigos = entrada
    familias = defaultdict(set)
    with consultar("tablas/procesos/articulos", {"año": anio, "semestre": semestre, "Type": "csv"}) as archivo:
        with io.TextIOWrapper(archivo, encoding="utf-8-sig", errors="replace", newline="") as texto:
            tabla = csv.DictReader(texto)
            if not {"CODIGO_PROCESO", "FAMILIA_UNSPSC"}.issubset(tabla.fieldnames or ()):
                raise ValueError("La tabla de renglones llegó sin el código de proceso o la familia UNSPSC")
            for fila in tabla:
                codigo = fila["CODIGO_PROCESO"]
                if codigo not in codigos:
                    continue
                familia = (fila["FAMILIA_UNSPSC"] or "").strip()
                if re.fullmatch(r"[0-9]{4}0000", familia):
                    familias[codigo].add(familia[:4])
    return familias


def renglones_del_proceso(codigo):
    familias = set()
    page = 1
    try:
        while True:
            with consultar("procesos/articulos", {"proceso": codigo, "page": page, "limit": 1000}) as respuesta:
                datos = json.load(respuesta)
            if datos.get("code") != 200 or datos.get("hasError") or datos.get("page") != page:
                return codigo, None
            for fila in datos["payload"]["content"] or ():
                familia = str(fila.get("familia_unspsc", ""))
                if fila.get("codigo_proceso") == codigo and re.fullmatch(r"[0-9]{4}0000", familia):
                    familias.add(familia[:4])
            if page >= (datos.get("pages") or 1):
                return codigo, familias
            page += 1
    except (OSError, ValueError, KeyError):
        return codigo, None


def principal():
    ahora = datetime.now(ZONA)
    abiertos = procesos_abiertos(ahora)
    procesos = set().union(*abiertos.values())
    indice = {}
    with ThreadPoolExecutor(max_workers=3) as tareas:
        for lote in tareas.map(renglones, abiertos.items()):
            for codigo, familias in lote.items():
                indice.setdefault(codigo, set()).update(familias)
        if procesos and len(indice) / len(procesos) < 0.75:
            raise ValueError("La descarga no cubre los renglones de suficientes procesos abiertos")
        for codigo, familias in tareas.map(renglones_del_proceso, sorted(procesos - indice.keys())):
            if familias is not None:
                indice[codigo] = familias
    salida = {
        "corte": ahora.isoformat(timespec="seconds"),
        "familias": {proceso: sorted(familias) for proceso, familias in indice.items()},
    }
    temporal = SALIDA.with_suffix(".tmp")
    temporal.write_text(json.dumps(salida, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")
    temporal.replace(SALIDA)
    print(json.dumps({"abiertos": len(procesos), "verificados": len(indice), "corte": salida["corte"]}))


if __name__ == "__main__":
    principal()
