"""Offline review preparation. Output is NOT an importable production dataset.
Usage: python tools/prepare-spain.py EUSKADI.json MURCIA.json DISCOVERY.json PUBLIC.json OUT.json
"""
import json,sys,re,math,hashlib,unicodedata,collections
from urllib.parse import urlparse

def key(s):
 s=unicodedata.normalize('NFKD',s or '').encode('ascii','ignore').decode().lower()
 return ' '.join(re.sub(r'\b(bodegas?|winery|s l|s a|s l u)\b','',re.sub('[^a-z0-9 ]',' ',s)).split())
def num(v):
 try:
  n=float(v);return n if math.isfinite(n) else None
 except (TypeError,ValueError):return None
def distance(a,b):
 if any(num(x.get(k)) is None for x in [a,b] for k in ['lat','lon']):return None
 p,q=map(math.radians,[a['lat'],b['lat']]);dp=q-p;dl=math.radians(b['lon']-a['lon']);v=math.sin(dp/2)**2+math.cos(p)*math.cos(q)*math.sin(dl/2)**2
 return 6371000*2*math.asin(min(1,math.sqrt(v)))
def prepare(e,m,d,p):
 rows=[]
 for x in e['candidates']:
  r=dict(x);r['origin']='euskadi';rows.append(r)
 for x in m:
  a,b=num(x.get('Latitud')),num(x.get('Longitud'));flags=[]
  if a is None or b is None:flags.append('MISSING_COORDINATES')
  elif abs(a)>180 or abs(b)>180:flags.append('UNKNOWN_PROJECTED_CRS')
  else:flags.append('SOURCE_COORDINATE_AXES_REVERSED_REVIEW_REQUIRED')
  name=x['Nombre'].strip()
  if re.search('almazara|museo|tienda|olimendros',name,re.I):flags.append('ENTITY_TYPE_REVIEW')
  rows.append(dict(candidateId='murcia_'+str(x['Código']),origin='murcia',name=name,countryCode='ES',municipality=x.get('Municipio') or None,officialUrl=x.get('URL Real') or None,lat=None,lon=None,rawCoordinates={'Latitud':x.get('Latitud'),'Longitud':x.get('Longitud')},sourceUrl='http://nexo.carm.es/nexo/archivos/recursos/opendata/json/Bodegas.json',reviewFlags=flags+['VERIFY_REUSE_TERMS'],indexable=False))
 for x in d['candidates']:
  rows.append(dict(x,candidateId='discovery_'+hashlib.sha256((x['sourceUrl']+'|'+x['name']).encode()).hexdigest()[:16],origin=x['sourceId'],lat=None,lon=None,officialUrl=None,reviewFlags=['MISSING_COORDINATES','MISSING_OFFICIAL_WEBSITE','VERIFY_REUSE_TERMS']))
 assert len({x['candidateId'] for x in rows})==len(rows),'Duplicate source IDs'
 for r in rows:
  flags=set(r.get('reviewFlags',[]));flags.update(['INTERNAL_SNAPSHOT_REQUIRED','IDENTITY_REVIEW_REQUIRED','EDITORIAL_CONTENT_REQUIRED','PRIMARY_LOCATION_CHECK_REQUIRED'])
  if not r.get('officialUrl'):flags.add('MISSING_OFFICIAL_WEBSITE')
  if not r.get('municipality'):flags.add('MISSING_MUNICIPALITY')
  public=[];peers=[]
  for other in p:
   if other.get('countryCode')!='ES':continue
   dist=distance(r,other)
   if key(r['name'])==key(other['name']) or (dist is not None and dist<=100):public.append({'id':other['id'],'name':other['name'],'distanceMetres':round(dist) if dist is not None else None})
  for other in rows:
   if r['candidateId']==other['candidateId']:continue
   dist=distance(r,other)
   if key(r['name'])==key(other['name']) or (dist is not None and dist<=100):peers.append(other['candidateId'])
  if public:flags.add('POSSIBLE_EXISTING_PUBLIC_ENTITY')
  if peers:flags.add('POSSIBLE_BATCH_DUPLICATE')
  r.update(publicMatches=public,batchMatches=peers,reviewFlags=sorted(flags),state='blocked_for_publication',indexable=False,visitsVerified=False,image=None)
 return {'schemaVersion':1,'purpose':'review_only_not_production_import','productionWritePerformed':False,'publicationReadyCount':0,'records':rows,'summary':{'total':len(rows),'bySource':dict(collections.Counter(r['origin'] for r in rows)),'publicMatchRecords':sum(bool(r['publicMatches']) for r in rows),'batchMatchRecords':sum(bool(r['batchMatches']) for r in rows),'flags':dict(collections.Counter(f for r in rows for f in r['reviewFlags']))},'limitations':['Public catalogue does not include hidden/internal entities.','Name and distance matches are review alerts, never automatic merges.','No coordinate swapping or CRS conversion without source confirmation.','Website availability is not proof of identity, licensing or editorial quality.']}
if __name__=='__main__':
 e,m,d,p,out=sys.argv[1:];report=prepare(*[json.load(open(f)) for f in [e,m,d,p]]);json.dump(report,open(out,'w'),ensure_ascii=False,indent=2);print(json.dumps(report['summary'],ensure_ascii=False))
