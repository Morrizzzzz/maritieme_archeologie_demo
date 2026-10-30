#!/usr/bin/env python3
"""Ververs uitsluitend de openbare MaSS-lijst en Archis-wateronderzoeken.

Python 3.10+, alleen standaardbibliotheek. Geen accounts, tokens of proxy nodig.
De gegevens worden pas vervangen nadat BEIDE downloads zijn gevalideerd.
"""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
MASS_URL = 'https://mass.cultureelerfgoed.nl/api/v1/list/nl/'
ARCHIS_URL = 'https://data.geo.cultureelerfgoed.nl/openbaar/wfs'
TYPE_NAME = 'openbaar:archeologische_onderzoeksmeldingen_openbaar_wgs84'
FILTER = "bodemtype = 'Waterbodem'"


def get_json(url):
    request = Request(url, headers={'User-Agent': 'MaritiemeErfgoedatlas/1.0 (public data snapshot)', 'Accept': 'application/json'})
    with urlopen(request, timeout=90) as response:
        data = json.load(response)
    if isinstance(data, dict) and data.get('error'):
        raise RuntimeError(f'Bron geeft foutmelding: {data["error"]}')
    return data


def get_archis():
    features, seen = [], set()
    total = None
    for page in range(100):
        params = {'service': 'WFS', 'version': '2.0.0', 'request': 'GetFeature',
                  'typeNames': TYPE_NAME, 'srsName': 'EPSG:4326',
                  'outputFormat': 'application/json', 'CQL_FILTER': FILTER,
                  'count': 1000, 'startIndex': len(features), 'sortBy': 'meldingsnummer A'}
        data = get_json(ARCHIS_URL + '?' + urlencode(params))
        if data.get('type') != 'FeatureCollection' or not isinstance(data.get('features'), list):
            raise ValueError('Archis geeft geen FeatureCollection terug.')
        if str(data.get('numberMatched', '')).isdigit():
            total = int(data['numberMatched'])
        batch = data['features']
        for feature in batch:
            props = feature.get('properties') or {}
            identifier = str(props.get('meldingsnummer') or feature.get('id'))
            if identifier in seen:
                raise ValueError('Dubbel meldingsnummer: de bronpaginering is niet betrouwbaar.')
            if props.get('bodemtype') != 'Waterbodem':
                raise ValueError('De bron heeft het Waterbodem-filter niet toegepast.')
            seen.add(identifier)
            features.append(feature)
        if (total is not None and len(features) >= total) or not batch:
            if total is not None and len(features) != total:
                raise ValueError(f'Onvolledige download: {len(features)} van {total}.')
            break
        if total is None and len(batch) < 1000:
            break
    else:
        raise ValueError('Paginering overschrijdt 100 pagina’s; geen bestanden vervangen.')
    if not features:
        raise ValueError('Archis geeft een lege selectie; bestaande momentopname blijft behouden.')
    return {'type': 'FeatureCollection', 'features': features}, total


def build_manifest(mass, archis, retrieved_at, total=None):
    return {
        'schema_version': 1, 'retrieved_at': retrieved_at,
        'sources': {
            'mass': {'title': 'MaSS', 'retrieved_at': retrieved_at, 'count': len(mass),
                     'url': MASS_URL, 'file': 'data/mass.json', 'coverage': 'Alle records in de Nederlandstalige lijst-API, wereldwijd.',
                     'license': 'CC BY-SA 4.0', 'license_url': 'https://creativecommons.org/licenses/by-sa/4.0/'},
            'archis': {'title': 'Archis openbare wateronderzoeken', 'retrieved_at': retrieved_at,
                       'count': len(archis['features']), 'number_matched': total,
                       'url': ARCHIS_URL, 'type_name': TYPE_NAME, 'filter': FILTER,
                       'file': 'data/archis-water.geojson', 'coverage': 'Afgeronde, openbare onderzoeksmeldingen met bodemtype Waterbodem; geen volledige dossiers of Waterbodem-dataset.',
                       'license': 'Geen expliciete licentie vermeld in de geraadpleegde GetCapabilities. Bronvoorwaarden blijven van toepassing.'},
            'machu': {'title': 'MACHU (Rijkswaterstaatviewer)', 'included': False,
                      'url': 'https://geoweb.rijkswaterstaat.nl/Moduleviewer/?app=3d6b415eeabd47d9b3da56ebd686f7cf',
                      'checked_at': '2026-10-30', 'status': 'De onderzochte wrakken- en archiefdiensten retourneerden een ArcGIS-fout met code 403; geen objectgegevens gedownload.'},
            'erfgoedatlas': {'title': 'Erfgoedatlas', 'mode': 'live WMS + GetFeatureInfo',
                            'url': 'https://rce.webgis.nl/nl/map/erfgoedatlas',
                            'layers': ['Archeologische_Monumentenkaart_2014', 'rijksmonumentcontouren (archeologische stijl)', 'noordzee_arch_onderzoekspotentieel_2016']}
        }
    }


def save_snapshots(destination, mass, archis, manifest):
    destination.mkdir(parents=True, exist_ok=True)
    staged = []
    try:
        for name, obj in [('mass.json', mass), ('archis-water.geojson', archis), ('manifest.json', manifest)]:
            fd, temp = tempfile.mkstemp(prefix='snapshot-', suffix='.tmp', dir=destination)
            staged.append((Path(temp), destination / name))
            with os.fdopen(fd, 'w', encoding='utf-8') as stream:
                json.dump(obj, stream, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
                stream.write('\n')
        for temp, final in staged:
            os.replace(temp, final)
    finally:
        for temp, _ in staged:
            temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-dir', type=Path, default=ROOT / 'data')
    args = parser.parse_args()
    print('Openbare MaSS-lijst ophalen…')
    mass = get_json(MASS_URL)
    if not isinstance(mass, list) or not mass:
        raise ValueError('MaSS geeft geen gevulde lijst terug.')
    identifiers = [str(row['id']) for row in mass]
    if len(identifiers) != len(set(identifiers)):
        raise ValueError('Dubbele MaSS-ID’s.')
    print('Openbare Archis-onderzoeken met bodemtype Waterbodem ophalen…')
    archis, total = get_archis()
    stamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds')
    save_snapshots(args.data_dir, mass, archis, build_manifest(mass, archis, stamp, total))
    print(f'Opgeslagen: {len(mass)} MaSS-records en {len(archis["features"])} Archis-onderzoeken.')
    print('Publiceer de bijgewerkte data-map samen met de website.')


if __name__ == '__main__':
    main()
