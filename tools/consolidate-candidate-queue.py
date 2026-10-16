"""Combine reviewed candidate packages without authorizing publication.

Usage: python tools/consolidate-candidate-queue.py BASE_QUEUE ORIGINAL_RECORDS NEW_PACK PRIORITY_PROFILES DO_PROFILES MURCIA_PACK OUTPUT
"""
import copy
import hashlib
import json
import sys
import unicodedata
from pathlib import Path


def normalized(value):
    value = ''.join(c for c in unicodedata.normalize('NFKD', value.lower()) if not unicodedata.combining(c))
    return ' '.join(''.join(c if c.isalnum() else ' ' for c in value).split())


def consolidate(base, original, incoming, profile_packs):
    records = copy.deepcopy(base['records'])
    ids = {r['candidateId'] for r in records}
    if len(ids) != len(records):
        raise ValueError('Duplicate base candidate ID')
    original_names = {}
    for row in original['records']:
        original_names.setdefault(normalized(row['name']), []).append(row['candidateId'])
    incoming_ids = set()
    incoming_sources = set()
    for row in incoming['records']:
        cid = row['candidateId']
        if cid in ids or cid in incoming_ids or row['sourceUrl'] in incoming_sources:
            raise ValueError('Duplicate incoming ID or source')
        if row.get('indexable') is not False or row.get('publicationReady') is not False or not row.get('evidenceUrls'):
            raise ValueError('Unsafe or unsourced incoming candidate')
        incoming_ids.add(cid)
        incoming_sources.add(row['sourceUrl'])
        hits = sorted({i for name in [row['name'], *row.get('aliases', [])] for i in original_names.get(normalized(name), [])})
        blockers = ['INTERNAL_IDENTITY_SNAPSHOT_AND_REVIEW_REQUIRED', 'PRIMARY_LOCATION_REVIEW_REQUIRED', 'STAGING_CONTENT_REVIEW_REQUIRED', 'VERIFY_REUSE_TERMS']
        if not row.get('detailRead'):
            blockers.append('OFFICIAL_DETAIL_REVIEW_REQUIRED')
        if hits:
            blockers.append('POSSIBLE_EXISTING_CANDIDATE_ALIAS')
        if 'entity_review' in row['reviewLevel']:
            blockers.append('ENTITY_SCOPE_REVIEW_REQUIRED')
        records.append({'candidateId': cid, 'name': row['name'], 'priority': 4 if hits or 'entity_review' in row['reviewLevel'] else 3,
                        'blockers': blockers, 'candidateNameMatches': hits, 'state': 'blocked_for_publication', 'indexable': False,
                        'sourceUrl': row['sourceUrl']})
    ids.update(incoming_ids)
    drafts = set()
    for pack in [incoming, *profile_packs]:
        for row in pack.get('profiles', pack.get('records', [])):
            # Dedicated profile packages contain editorial records themselves.
            is_draft = ('profiles' in pack or row.get('editorialDraft') is not None or row.get('editorial') is not None)
            if is_draft:
                if row['candidateId'] not in ids:
                    raise ValueError('Editorial profile for unknown candidate')
                drafts.add(row['candidateId'])
    for row in records:
        # Preserve previously documented availability, never infer approval.
        row['editorialDraftAvailable'] = row.get('editorialDraftAvailable', False) or row['candidateId'] in drafts
        row['state'] = 'blocked_for_publication'
        row['indexable'] = False
    return {'purpose': 'consolidated_review_queue_not_import', 'productionWritePerformed': False, 'publicationReadyCount': 0,
            'summary': {'total': len(records), 'baseCount': len(base['records']), 'addedCandidateRecords': len(incoming_ids),
                        'editorialDrafts': sum(r['editorialDraftAvailable'] for r in records)}, 'records': records}


if __name__ == '__main__':
    paths = [Path(p) for p in sys.argv[1:]]
    if len(paths) != 7:
        raise SystemExit(__doc__)
    contents = [p.read_bytes() for p in paths[:-1]]
    parsed = [json.loads(b) for b in contents]
    result = consolidate(parsed[0], parsed[1], parsed[2], parsed[3:])
    result['inputSha256'] = {p.name: hashlib.sha256(b).hexdigest() for p, b in zip(paths[:-1], contents)}
    with paths[-1].open('x', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(json.dumps(result['summary'], ensure_ascii=False))
