#!/usr/bin/env python3
"""Validate the three disjoint research batches before importing reviewed positions.

This combines recorded evidence; it does not geocode or infer any point.
Run only after all three batches have completed their research.
"""
import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
def read(path): return json.loads(path.read_text())
def write(path, value): path.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--round', type=int, choices=[2,3], default=2)
    args = parser.parse_args()
    BASE = ROOT/f'research/neighbors/coordinate-round-{args.round}'
    expected_count = {2:245, 3:119}[args.round]
    all_assignments = {}
    proposals = {}
    merged, records, assigned_ids, inputs = {}, [], set(), []
    for group in range(1, 4):
        assignment = read(BASE/f'assignment-{group}.json')
        scope = {s['id']:s for s in assignment}
        assert len(scope) == len(assignment) and not (assigned_ids & scope.keys()), 'Overlapping assignments'
        assigned_ids.update(scope)
        all_assignments.update(scope)
        proposal_path = BASE/f'group-{group}-address-proposals.json'
        if proposal_path.exists():
            proposed = read(proposal_path)
            for proposal in proposed:
                school_id = proposal['id']
                assert school_id in scope and school_id not in proposals, 'Address proposal outside assignment or duplicated'
                previous = scope[school_id]
                assert proposal.get('oldAddress', previous['address']) == previous['address'], school_id
                assert proposal.get('oldComune', previous['comune']) == previous['comune'], school_id
                assert proposal.get('rationale') and proposal.get('sources'), school_id
                assert all(s.get('url','').startswith('https://') and s.get('label') for s in proposal['sources']), school_id
                towns = read(ROOT/'src/data/territorial-access.json')['municipalities']
                new_comune = proposal.get('newComune', previous['comune'])
                town = next((t for t in towns if t['name'] == new_comune), None)
                assert town, f'Corrected municipality outside coverage: {new_comune}'
                if proposal.get('newComuneSlug'): assert proposal['newComuneSlug'] == town['slug'], school_id
                assert proposal.get('newAddress', previous['address']).strip(), school_id
                obsolete = proposal.get('obsoleteWarnings', [])
                assert all(w in previous['warnings'] for w in obsolete), f'Unknown obsolete warning: {school_id}'
                proposals[school_id] = {'previousAddress':previous['address'], 'previousComune':previous['comune'],
                    'newAddress':proposal.get('newAddress',previous['address']), 'newComune':new_comune, 'newComuneSlug':town['slug'],
                    'reason':proposal['rationale'], 'sources':proposal['sources'], 'reviewedAt':'2026-11-17', 'obsoleteWarnings':obsolete}
        coordinates_path = BASE/f'group-{group}-coordinates.json'
        audit_path = BASE/f'group-{group}-audit.json'
        coordinates = read(coordinates_path)
        audit = read(audit_path)
        outcomes = {r['id']:r for r in audit['records']}
        assert len(outcomes) == len(audit['records']) and outcomes.keys() == scope.keys(), f'Incomplete audit in group {group}'
        assert coordinates.keys() <= scope.keys(), 'Coordinate outside assignment'
        for school_id, outcome in outcomes.items():
            assert outcome['status'] in ['located', 'unresolved']
            assert bool(school_id in coordinates) == (outcome['status']=='located'), school_id
            assert outcome['attempts'], f'Missing research evidence: {school_id}'
            assert all(a.get('url','').startswith('https://') and a.get('outcome') for a in outcome['attempts']), school_id
        for school_id, point in coordinates.items():
            assert all(isinstance(point[k], (float,int)) and math.isfinite(point[k]) for k in ['lat','lng']), school_id
            assert 45.30 < point['lat'] < 45.65 and 8.95 < point['lng'] < 9.50, school_id
            assert point.get('year') and point.get('method') and point.get('matching'), school_id
            assert point['source'].get('url','').startswith('https://') and point['source'].get('label') and point['source'].get('checkedAt'), school_id
            assert all(s.get('url','').startswith('https://') and s.get('label') for s in point.get('additionalSources', [])), school_id
        merged.update(coordinates)
        records.extend(audit['records'])
        for path in [coordinates_path, audit_path, BASE/f'assignment-{group}.json'] + ([proposal_path] if proposal_path.exists() else []):
            inputs.append({'path':str(path.relative_to(ROOT)), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    assert len(assigned_ids) == expected_count, f'Research scope must account for the original {expected_count} unlocated services'
    baseline = read(ROOT/'research/neighbors/coordinates.json')
    baseline.update(read(ROOT/'research/neighbors/nursery-location-candidates.json'))
    if args.round == 3:
        baseline.update(read(ROOT/'research/neighbors/coordinate-round-2/reviewed-coordinates.json'))
    assert not (baseline.keys() & merged.keys()), 'Cannot overwrite an existing position'
    by_town = collections.Counter()
    for group in range(1,4):
        for school in read(BASE/f'assignment-{group}.json'):
            if school['id'] in merged: by_town[proposals.get(school['id'], {}).get('newComune', school['comune'])] += 1
    publishers = collections.Counter(urlparse(p['source']['url']).hostname for p in merged.values())
    summary = {'checkedAt':'2026-11-17', 'scope':f'{expected_count} servizi dei comuni confinanti senza coordinate all’inizio dell’approfondimento {args.round}', 'investigated':len(records), 'baselineLocated':len(baseline), 'newlyLocated':len(merged), 'remainingUnlocated':len(assigned_ids)-len(merged), 'addressReviews':len(proposals), 'addressCorrections':sum(p['previousAddress']!=p['newAddress'] or p['previousComune']!=p['newComune'] for p in proposals.values()), 'newlyLocatedByComune':dict(sorted(by_town.items())), 'newlyLocatedBySourceHost':dict(sorted(publishers.items())), 'inputs':inputs}
    if args.round == 3: write(BASE/'reviewed-addresses.json',proposals)
    write(BASE/'reviewed-coordinates.json',merged)
    write(BASE/'summary.json',summary)
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
