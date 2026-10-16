"""Build an ordered review queue; never approves or publishes candidates.
Usage: python tools/build-publication-queue.py REVIEW PROFILES OUTPUT
"""
import collections
import hashlib
import json
import math
import sys

def distance(a, b):
    p, q = math.radians(a['lat']), math.radians(b['lat'])
    h = math.sin((q-p)/2)**2 + math.cos(p)*math.cos(q)*math.sin(math.radians(b['lon']-a['lon'])/2)**2
    return 6371000*2*math.asin(min(1, math.sqrt(h)))

def build(report, profiles):
    by_id = {r['candidateId']: r for r in report['records']}
    evidence = {}
    for p in profiles['records']:
        key = p['candidateId']
        if key not in by_id or key in evidence or not p.get('sources'):
            raise ValueError('Unknown/repeated profile or missing sources')
        if any(not s['url'].startswith('https://') for s in p['sources']):
            raise ValueError('Invalid source')
        geo = p['geographicReview']
        if geo['status'] == 'dataset_point_corroborated_within_50m':
            original = by_id[key]
            if original.get('lat') is None or original.get('lon') is None or distance(original, geo) > 50:
                raise ValueError('Coordinate corroboration does not meet 50m threshold')
        evidence[key] = p
    queue = []
    for key, row in by_id.items():
        if row.get('state') == 'excluded_from_winery_queue':
            continue
        p = evidence.get(key)
        flags = row['reviewFlags']
        blockers = ['INTERNAL_IDENTITY_SNAPSHOT_AND_REVIEW_REQUIRED', 'STAGING_CONTENT_REVIEW_REQUIRED']
        if row.get('unresolvedBatchMatches'):
            blockers.append('BATCH_IDENTITY_RESOLUTION_REQUIRED')
        if p:
            geo = p['geographicReview']['status']
            priority = 1 if geo == 'dataset_point_corroborated_within_50m' else 2
            if priority == 2:
                blockers.append('PRIMARY_LOCATION_REVIEW_REQUIRED')
        else:
            priority = 3
            blockers.extend(['SOURCE_DOCUMENTARY_DOSSIER_REQUIRED', 'EDITORIAL_DRAFT_REQUIRED', 'PRIMARY_LOCATION_REVIEW_REQUIRED'])
        if any(x in flags for x in ['ENTITY_TYPE_REVIEW','PROBABLE_BATCH_DUPLICATE','RETAIL_SITE_VERSUS_WINERY','MUSEUM_VERSUS_WINERY']):
            priority = 4
            blockers.append('ENTITY_SCOPE_REVIEW_REQUIRED')
        if 'VERIFY_REUSE_TERMS' in flags:
            blockers.append('SOURCE_REUSE_REVIEW_REQUIRED')
        queue.append({'candidateId': key, 'name': row['name'], 'priority': priority,
                      'editorialDraftAvailable': bool(p), 'blockers': sorted(set(blockers)),
                      'state': 'blocked_for_publication', 'indexable': False})
    queue.sort(key=lambda r:(r['priority'],r['name'].casefold(),r['candidateId']))
    return {'purpose':'review_queue_not_import','publicationReadyCount':0,'productionWritePerformed':False,
            'summary':{'total':len(queue),'byPriority':dict(collections.Counter(r['priority'] for r in queue)),
                       'editorialDrafts':len(evidence)}, 'records':queue}

if __name__ == '__main__':
    src, profiles, out = sys.argv[1:]
    result = build(json.load(open(src)),json.load(open(profiles)))
    result['inputSha256'] = {name: hashlib.sha256(open(path,'rb').read()).hexdigest() for name,path in [('review',src),('profiles',profiles)]}
    with open(out,'w') as f:
        json.dump(result,f,ensure_ascii=False,indent=2)
        f.write('\n')
    print(json.dumps(result['summary']))
