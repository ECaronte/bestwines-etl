"""Attach sourced research to a review report. Never grants publication approval.
Usage: python apply-research.py REVIEW CONTACTS LOCATION_EVIDENCE OUTPUT
"""
import json,sys,collections,math

def enrich(report,contacts,locations):
 c={r['candidateId']:r for r in contacts['records']};loc={'murcia_'+r['sourceId']:r for r in locations if 'lat' in r and 'lon' in r}
 assert len(c)==len(contacts['records'])
 stats=collections.Counter()
 for r in report['records']:
  flags=set(r['reviewFlags'])
  if r['candidateId'] in c:
   e=c[r['candidateId']];r['contactResearch']=e
   if e['websites']:
    r['officialUrl']=e['websites'][0]['url'];flags.discard('MISSING_OFFICIAL_WEBSITE');flags.add('WEBSITE_IDENTITY_AND_AVAILABILITY_CHECK_REQUIRED')
   if e['contacts']:stats['recordsWithPublicContact']+=1
  if r['candidateId'] in loc:
   e=loc[r['candidateId']];lat,lon=e['lat'],e['lon']
   assert math.isfinite(lat) and math.isfinite(lon) and 37<lat<40 and -3<lon<0
   r['locationEvidence']={**e,'checkedAt':'2026-10-16','status':'official_tourism_coordinates_primary_location_not_yet_verified'}
   raw=r['rawCoordinates'];a,b=raw['Latitud'],raw['Longitud']
   try:exact=abs(float(a)-lon)<1e-7 and abs(float(b)-lat)<1e-7
   except (TypeError,ValueError):exact=False
   # Only corroborated axis corrections are applied; changed/projected locations remain proposals.
   if exact:
    r['lat'],r['lon']=lat,lon;flags.discard('SOURCE_COORDINATE_AXES_REVERSED_REVIEW_REQUIRED');flags.add('SOURCE_AXIS_ORDER_CORRECTED');stats['corroboratedAxisCorrections']+=1
   else:
    flags.add('LOCATION_REPLACEMENT_REVIEW_REQUIRED');stats['locationReplacementProposals']+=1
   if r['candidateId']=='murcia_918':flags.add('MUNICIPALITY_LOCATION_CONFLICT')
   if r['candidateId']=='murcia_904':flags.add('SOURCE_LOCATION_CONFLICT')
   stats['murciaRecordsWithLocationEvidence']+=1
  r.update(reviewFlags=sorted(flags),state='blocked_for_publication',indexable=False,visitsVerified=False)
 report['publicationReadyCount']=0;report['productionWritePerformed']=False
 report['summary']['flags']=dict(collections.Counter(f for r in report['records'] for f in r['reviewFlags']))
 report['researchSummary']=dict(stats)
 report['limitations'].append('Official tourism coordinates do not independently establish the primary winery entrance. Replacement proposals are not applied.')
 return report
if __name__=='__main__':
 src,con,loc,out=sys.argv[1:];r=enrich(*[json.load(open(p)) for p in [src,con,loc]]);json.dump(r,open(out,'w'),ensure_ascii=False,indent=2);print(json.dumps(r['researchSummary']))
