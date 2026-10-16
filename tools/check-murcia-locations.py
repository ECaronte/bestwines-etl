"""Read public tourism directory; save evidence only. Usage: python check-murcia-locations.py OUTPUT.json"""
import urllib.request,re,json,concurrent.futures,urllib.parse,sys
base='https://itrem.carm.es'
s=urllib.request.urlopen(base+'/es/bodegas/',timeout=25).read().decode('latin1')
paths=sorted(set(re.findall(r'href="(/es/bodega/[^"]+)"',s)))
def get(path):
 u=base+urllib.parse.quote(path,safe='/');r={'sourceUrl':u,'sourceId':re.search(r'-(\d+)/$',path).group(1)}
 try:
  h=urllib.request.urlopen(u,timeout=20).read().decode('latin1');m=re.search(r'const coordenadas\s*=\s*\[\s*([-\d.]+),\s*([-\d.]+)',h)
  if m:r.update(lat=float(m[1]),lon=float(m[2]))
  r['pageTitle']=re.search(r'<title>(.*?)</title>',h,re.S).group(1).strip()
 except Exception as e:r['error']=str(e)
 return r
rows=list(concurrent.futures.ThreadPoolExecutor(4).map(get,paths));json.dump(rows,open(sys.argv[1],'w'),indent=2,ensure_ascii=False)
print(json.dumps(rows,ensure_ascii=False))
