#!/usr/bin/env python3
"""Minimize the CC BY 4.0 municipal civic dataset for exact, local address lookup."""
import argparse
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://dati.comune.milano.it/dataset/ds634-numeri-civici-coordinate'
RESOURCE = 'https://dati.comune.milano.it/dataset/5c6519f6-6d26-41c9-b53b-6106e08d1b90/resource/533b4e63-3d78-4bb5-aeb4-6c5f648f7f21/download/ds634_civici_coordinategeografiche_20261001_final_csv.zip'


def transform(rows):
    streets = {}
    excluded = 0
    for row in rows:
        if row['STATOCIVICO'] != 'Applicato' or row['STATOVIA'] != 'Intitolata' or row['BARRA2'].strip() or not row['NUMERO'].isdigit() or int(row['NUMERO']) <= 0:
            excluded += 1
            continue
        lat, lng = float(row['LAT_WGS84']), float(row['LONG_WGS84'])
        if not (math.isfinite(lat) and math.isfinite(lng) and 45.35 <= lat <= 45.62 and 8.95 <= lng <= 9.45):
            raise ValueError('Coordinate comunali non valide')
        kind = row['TIPO'].strip()
        aliases = sorted({f'{kind} {row[key].strip().title()}' for key in ['DESCRITTIVO', 'ANNCSU', 'OPENSTREETMAP'] if row[key].strip()})
        if not aliases:
            raise ValueError('Denominazione stradale mancante')
        name = f"{kind} {row['DESCRITTIVO'].strip().title()}" if row['DESCRITTIVO'].strip() else aliases[0]
        street = streets.setdefault(row['CODICE_VIA'], {'name': name, 'aliases': aliases, 'numbers': []})
        if street['name'] != name or street['aliases'] != aliases:
            raise ValueError('Denominazioni discordanti per lo stesso codice via')
        number = row['NUMEROCOMPLETO'].strip()
        if any(item[0] == number for item in street['numbers']):
            raise ValueError('Civico duplicato: verificare le coordinate prima di pubblicare')
        street['numbers'].append([number, round(lat, 6), round(lng, 6)])
    result = sorted(streets.values(), key=lambda street: street['name'])
    for street in result:
        street['numbers'].sort(key=lambda item: item[0])
    return result, excluded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, help='ZIP ufficiale già scaricato; altrimenti scarica la risorsa configurata')
    parser.add_argument('--output', type=Path, default=ROOT / 'public/dati/civici-milano.json')
    args = parser.parse_args()
    raw = args.input.read_bytes() if args.input else urllib.request.urlopen(RESOURCE, timeout=60).read()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        name = next(name for name in archive.namelist() if name.lower().endswith('.csv'))
        rows = csv.DictReader(io.StringIO(archive.read(name).decode('utf-8-sig')), delimiter=';')
        streets, excluded = transform(rows)
    total = sum(len(street['numbers']) for street in streets)
    data = {'version': 1, 'date': '2026-10-01', 'source': SOURCE, 'resource': RESOURCE,
            'attribution': 'Comune di Milano · DS634 · elaborazione Scuole Vicine',
            'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
            'sourceSha256': hashlib.sha256(raw).hexdigest(), 'count': total, 'excluded': excluded, 'streets': streets}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'{len(streets)} vie, {total} civici applicati; {excluded} record esclusi. {args.output.stat().st_size} byte.')


if __name__ == '__main__':
    main()
