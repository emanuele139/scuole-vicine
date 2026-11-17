#!/usr/bin/env python3
import argparse
from school_research import ROOT, RESEARCH, apply_research, publish_research_report, publish_client_catalog, read_json, write_json

parser = argparse.ArgumentParser(description='Unisce le ricerche per ID, senza omettere scuole o perdere i dati iniziali.')
parser.add_argument('--allow-partial', action='store_true', help='Solo anteprima di lavorazione: segnala tutte le schede mancanti.')
args = parser.parse_args()
schools, report = apply_research(read_json(RESEARCH / 'catalog-before.json'), strict=not args.allow_partial)
write_json(ROOT / 'src/data/schools.json', schools)
publish_client_catalog(schools)
publish_research_report(report)
reconciliation_path = ROOT / 'src/data/reconciliation-report.json'
if reconciliation_path.exists():
    reconciliation = read_json(reconciliation_path)
    reconciliation['researchCoverage'] = {key: report[key] for key in ('checkedAt','reviewed','schoolSpecificDetails','officialLinks','events')}
    reconciliation['summary'].update(enriched=sum(s['enriched'] for s in schools), events=report['events'], geolocated=sum(s['lat'] is not None for s in schools), needsReview=sum(s['status']=='needs-review' for s in schools))
    reconciliation['limits'] = [limit for limit in reconciliation['limits'] if 'enriched detail remains limited' not in limit]
    limit = 'Research coverage is tracked per school and field; a reviewed field may remain unpublished or unconfirmed.'
    if limit not in reconciliation['limits']: reconciliation['limits'].append(limit)
    for target in (reconciliation_path, ROOT/'research/reconciliation/report.json', ROOT/'public/dati/rapporto-riconciliazione.json'):
        write_json(target, reconciliation)
print({key: report[key] for key in ('catalogTotal', 'reviewed', 'schoolSpecificDetails', 'officialLinks', 'events')})
print('Schede assenti:', len(report['missingIds']), 'Schede ancora in lavorazione:', len(report['pendingIds']))
