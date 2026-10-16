"""Read-only candidate screening. Signals are never automatic merge decisions."""
import json,re,unicodedata,hashlib,sys,math
from pathlib import Path
from urllib.parse import urlparse
from itertools import combinations

def norm(s):
 s=''.join(c for c in unicodedata.normalize('NFKD',str(s or '').lower()) if not unicodedata.combining(c))
 return ' '.join(re.findall(r'[a-z0-9]+',s))
def identity(s):
 s=re.sub(r'\b(?:s\s*l\s*n\s*e|s\s*a\s*u|s\s*l|s\s*a|s\s*c\s*g)\b',' ',norm(s))
 return ' '.join(t for t in s.split() if t not in {'bodega','bodegas','adega','adegas'})
def domain(s):
 if not s:return ''
 return (urlparse(s if '://' in s else 'https://'+s).hostname or '').removeprefix('www.')
def audit(queue,packs):
 ids={r['candidateId'] for r in queue['records']};rows={}
 for pack in packs:
  for row in pack['records']:
   if row['candidateId'] not in ids:continue
   if row['candidateId'] in rows:raise ValueError('Repeated input ID')
   rows[row['candidateId']]=row
 if set(rows)!=ids:raise ValueError('Missing candidate details')
 signals=[]
 for a,b in combinations(rows.values(),2):
  reasons=[]
  an={identity(x) for x in [a['name'],*a.get('aliases',[])]};bn={identity(x) for x in [b['name'],*b.get('aliases',[])]}
  if (an&bn)-{''}:reasons.append('NORMALIZED_NAME_OR_ALIAS')
  da=domain(a.get('officialUrl') or a.get('websiteListedByCouncil'));db=domain(b.get('officialUrl') or b.get('websiteListedByCouncil'))
  if da and da==db:reasons.append('SHARED_DOMAIN_NOT_PROOF_OF_IDENTITY')
  for key in ['email','phone']:
   if a.get(key) and norm(a[key])==norm(b.get(key,'')):reasons.append('SHARED_'+key.upper())
  if all(isinstance(r.get(k),(float,int)) for r in [a,b] for k in ['lat','lon']):
   la,lb=map(math.radians,[a['lat'],b['lat']]);dl=math.radians(b['lon']-a['lon']);h=math.sin((lb-la)/2)**2+math.cos(la)*math.cos(lb)*math.sin(dl/2)**2
   dist=6371000*2*math.asin(min(1,math.sqrt(h)))
   if dist<100:reasons.append('WITHIN_100M_NOT_PROOF_OF_IDENTITY')
  if reasons:signals.append({'candidateIds':[a['candidateId'],b['candidateId']],'names':[a['name'],b['name']],'signals':reasons})
 return {'purpose':'candidate_identity_screening_not_merge','checkedAt':'2026-10-16','candidateCount':len(rows),'productionWritePerformed':False,'automaticMerges':0,'publicationReadyCount':0,'signals':signals,'limitations':['Only supplied fields; missing contacts are not evidence of distinctness.','Shared groups, neighbouring premises and similar names require documentary review.','Coordinates may be unverified source points.','Fresh private inventory still required before production import.']}
if __name__=='__main__':
 paths=[Path(s) for s in sys.argv[1:]]
 result=audit(json.loads(paths[0].read_text()),[json.loads(p.read_text()) for p in paths[1:-1]])
 result['inputSha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in paths[:-1]}
 with paths[-1].open('x') as f:json.dump(result,f,ensure_ascii=False,indent=2);f.write('\n')
 print(json.dumps({'candidates':result['candidateCount'],'pairs':len(result['signals']),'signals':result['signals']},ensure_ascii=False))
