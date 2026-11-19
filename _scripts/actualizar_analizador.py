"""Actualiza los índices públicos del analizador con las descargas oficiales."""

import csv
import hashlib
import io
import json
import os
import re
import tempfile
import unicodedata
from contextlib import contextmanager
from datetime import date, datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.request import Request, urlopen
from zipfile import ZipFile
from zoneinfo import ZoneInfo


DGII = "https://dgii.gov.do/app/WebApps/Consultas/RNC/DGII_RNC.zip"
MICM = (
    "https://www.micm.gob.do/transparencias/datos-abiertos/MIPYMES_Cert/"
    "Mipymes%20certificadas,%20MICM,%202019%20-%202026.csv"
)
SALIDA = Path(__file__).resolve().parents[1] / "analizador" / "datos"
PARTES = 64
RNC = re.compile(r"[0-9]{9}\Z")
ZONA = ZoneInfo("America/Santo_Domingo")
ESTADOS = {
    "ACTIVO": "Activo",
    "SUSPENDIDO": "Suspendido",
    "CESE TEMPORAL": "Cese temporal",
    "DADO DE BAJA": "Dado de baja",
    "INACTIVO": "Inactivo",
}


@contextmanager
def descargar(url):
    solicitud = Request(
        url, headers={"User-Agent": "Publicola Diagnóstico (+https://publicola.com.do/contacto/)"}
    )
    with urlopen(solicitud, timeout=22) as respuesta, tempfile.TemporaryFile() as archivo:
        if respuesta.geturl().split("/")[2] != url.split("/")[2]:
            raise ValueError("La descarga cambió de origen")
        fecha = respuesta.headers.get("Last-Modified")
        total = 0
        while bloque := respuesta.read(256 * 1024):
            total += len(bloque)
            if total > 80 * 1024 * 1024:
                raise ValueError("La descarga supera el tamaño esperado")
            archivo.write(bloque)
        archivo.seek(0)
        yield archivo, fecha


def indice_dgii(partes):
    with descargar(DGII) as (archivo, fecha), ZipFile(archivo) as zip_dgii:
        if not fecha:
            raise ValueError("La publicación de la DGII llegó sin fecha")
        textos = [item for item in zip_dgii.infolist() if Path(item.filename).suffix.lower() == ".txt"]
        if len(textos) != 1:
            raise ValueError("No se pudo identificar el archivo TXT de la DGII")
        miembro = textos[0]
        if miembro.file_size > 256 * 1024 * 1024:
            raise ValueError("El padrón de la DGII supera el tamaño esperado")
        with zip_dgii.open(miembro) as recurso, io.TextIOWrapper(recurso, encoding="latin-1") as lineas:
            for linea in lineas:
                campos = linea.rstrip("\r\n").split("|")
                if len(campos) != 11 or not RNC.fullmatch(campos[0]):
                    continue
                rnc = campos[0]
                estado = " ".join(campos[9].upper().split())
                if not estado or len(estado) > 50:
                    continue
                parte = partes[int(rnc) % PARTES]["dgii"]
                valor = ESTADOS.get(estado, estado.capitalize())
                if rnc in parte and parte[rnc] != valor:
                    parte[rnc] = "Por confirmar"
                else:
                    parte[rnc] = valor
    return parsedate_to_datetime(fecha).astimezone(ZONA).date().isoformat()


def fecha_micm(valor):
    dia, mes, anio = valor.strip().split("/")
    if len(anio) != 4:
        raise ValueError("Fecha MICM sin año completo")
    return date(int(anio), int(mes), int(dia))


def indice_micm(partes, hoy):
    ultimo = date.min
    with descargar(MICM) as (archivo, _):
        muestra = archivo.read(8192)
        try:
            muestra = muestra.decode("utf-8-sig")
            codigo = "utf-8-sig"
        except UnicodeDecodeError:
            muestra = muestra.decode("cp1252")
            codigo = "cp1252"
        archivo.seek(0)
        separador = csv.Sniffer().sniff(muestra.splitlines()[0], delimiters=";,").delimiter
        with io.TextIOWrapper(archivo, encoding=codigo, newline="") as lineas:
            filas = csv.DictReader(lineas, delimiter=separador)
            columnas = {
                unicodedata.normalize("NFC", nombre.strip()): nombre
                for nombre in filas.fieldnames or ()
            }
            for columna in ("RNC", "Fecha Emisión", "Fecha de Vencimiento", "Clasificación"):
                if columna not in columnas:
                    raise ValueError(f"Falta una columna del MICM: {columna}")
            for fila in filas:
                rnc = re.sub(r"[\s-]", "", fila[columnas["RNC"]] or "")
                try:
                    inicio = fecha_micm(fila[columnas["Fecha Emisión"]] or "")
                    fin = fecha_micm(fila[columnas["Fecha de Vencimiento"]] or "")
                except ValueError:
                    continue
                if inicio > hoy or fin < inicio:
                    continue
                ultimo = max(ultimo, inicio)
                if not RNC.fullmatch(rnc):
                    continue
                parte = partes[int(rnc) % PARTES]["micm"]
                categoria = " ".join((fila[columnas["Clasificación"]] or "").split())
                periodo = [fin.isoformat(), inicio.isoformat(), categoria[:70]]
                if periodo > parte.get(rnc, []):
                    parte[rnc] = periodo
    return ultimo.isoformat()


def principal():
    partes = [{"dgii": {}, "micm": {}} for _ in range(PARTES)]
    hoy = datetime.now(timezone.utc).astimezone(ZONA).date()
    dgii = indice_dgii(partes)
    micm = indice_micm(partes, hoy)
    cantidades = {tipo: sum(len(parte[tipo]) for parte in partes) for tipo in ("dgii", "micm")}
    if cantidades["dgii"] < 100_000 or cantidades["micm"] < 1_000:
        raise ValueError("La cobertura de la descarga es menor que la esperada")

    SALIDA.mkdir(parents=True, exist_ok=True)
    serializadas = [
        json.dumps(parte, separators=(",", ":"), sort_keys=True, ensure_ascii=False).encode()
        for parte in partes
    ]
    huella = hashlib.sha256()
    for contenido in serializadas:
        huella.update(contenido)
    version = huella.hexdigest()[:12]
    metadatos = {"partes": PARTES, "dgii": dgii, "micm": micm, "version": version}
    with tempfile.TemporaryDirectory(dir=SALIDA.parent) as transitorio:
        temporal = Path(transitorio)
        archivos = {f"{i:02d}.json": contenido for i, contenido in enumerate(serializadas)}
        archivos["cortes.json"] = (json.dumps(metadatos, ensure_ascii=False) + "\n").encode()
        for nombre, contenido in archivos.items():
            (temporal / nombre).write_bytes(contenido)
        for nombre in archivos:
            os.replace(temporal / nombre, SALIDA / nombre)
    print(json.dumps({"cortes": {"dgii": dgii, "micm": micm}, "registros": cantidades}))


if __name__ == "__main__":
    principal()
