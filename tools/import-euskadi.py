"""Normalize a downloaded official dataset into review candidates; never writes AWS.
Usage: python tools/import-euskadi.py source.json public.json output.json
"""
import sys,json,re,hashlib,unicodedata,math
from datetime import datetime,timezone
from urllib.parse import urlparse
SOURCE='https://opendata.euskadi.eus/contenidos/ds_recursos_turisticos/bodegas_vino_txakoli/opendata/bodegas.json'
def key(s):
 s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower()
 return ' '.join(re.sub(r'\b(bodegas?|winery)\b','',re.sub(r'[^a-z0-9 ]',' ',s)).split())
def number(v):
 try:
  n=float(v);return n if math.isfinite(n) else None
 except (TypeError,ValueError):return None
def url(v):
 p=urlparse(v or '');return v if p.scheme in ['http','https'] and p.netloc and not p.username else None
def build(rows,existing):
 if not isinstance(rows,list) or not rows:raise ValueError('Expected nonempty dataset array')
 result=[]; seen=set()
 for r in rows:
  source=url(r.get('physicalUrl'));name=(r.get('documentName') or '').strip()
  if not source or not name:raise ValueError('Missing source identity')
  ident='euskadi_'+hashlib.sha256(source.encode()).hexdigest()[:16]
  if ident in seen:raise ValueError('Duplicate source identity')
  seen.add(ident);lat=number(r.get('latwgs84'));lon=number(r.get('lonwgs84'))
  coords=lat is not None and lon is not None and 42<lat<44 and -4<lon<-1
  matches=[x['id'] for x in existing if x.get('countryCode')=='ES' and key(x['name'])==key(name)]
  flags=['VERIFY_ENTITY_AND_OFFICIAL_SITE','CHECK_INTERNAL_CATALOGUE_DUPLICATES']
  if matches:flags.append('EXISTING_PUBLIC_MATCH')
  if not coords:flags.append('INVALID_OR_MISSING_COORDINATES')
  if not url(r.get('web')):flags.append('MISSING_OFFICIAL_WEBSITE')
  if not r.get('municipality'):flags.append('MISSING_MUNICIPALITY')
  if re.search('escuela|complejo',name,re.I):flags.append('POSSIBLE_NON_WINERY')
  result.append(dict(candidateId=ident,name=name,countryCode='ES',municipality=r.get('municipality') or None,province=r.get('territory') or None,lat=lat if coords else None,lon=lon if coords else None,officialUrl=url(r.get('web')),sourceUrl=source,datasetUrl=SOURCE,attribution='Gobierno Vasco / Open Data Euskadi',license='CC-BY-4.0',licenseUrl='https://creativecommons.org/licenses/by/4.0/',sourceVisitFlag=r.get('visit')=='1',visitsVerified=False,existingPublicIds=matches,reviewFlags=flags,status='candidate',indexable=False,image=None))
 return dict(schemaVersion=1,checkedAt=datetime.now(timezone.utc).isoformat(),sourceCount=len(rows),candidateCount=len(result),productionWritePerformed=False,transformations='Selected factual fields; omitted descriptions, emails, phones and photographs. Source visit flag is not a verified booking offer.',candidates=result)
if __name__=='__main__':
 a,b,c=sys.argv[1:];out=build(json.load(open(a)),json.load(open(b)));json.dump(out,open(c,'w'),ensure_ascii=False,indent=2);print(json.dumps({'candidates':len(out['candidates']),'existingMatches':sum(bool(x['existingPublicIds']) for x in out['candidates']),'missingWebsite':sum(x['officialUrl'] is None for x in out['candidates']),'missingCoords':sum(x['lat'] is None for x in out['candidates'])}))
