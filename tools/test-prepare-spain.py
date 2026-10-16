import importlib.util,unittest
s=importlib.util.spec_from_file_location('quality',__file__.replace('test-prepare-spain.py','prepare-spain.py'));m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class QualityTests(unittest.TestCase):
 def row(self,id,name='Bodega Uno',lat=43,lon=-2):return dict(candidateId=id,name=name,countryCode='ES',lat=lat,lon=lon,municipality='Getaria',officialUrl='https://example.org',reviewFlags=[])
 def test_existing_alias(self):
  r=m.prepare({'candidates':[self.row('a','Ysios')]},[],{'candidates':[]},[dict(id='wd_2893608',name='Bodegas Ysios',countryCode='ES',lat=42,lon=-3)])
  self.assertEqual(len(r['records'][0]['publicMatches']),1)
 def test_nearby_is_alert_not_merge(self):
  r=m.prepare({'candidates':[self.row('a'),self.row('b','Different')]},[],{'candidates':[]},[])
  self.assertEqual(len(r['records']),2);self.assertEqual(r['summary']['batchMatchRecords'],2)
 def test_no_invented_coordinates(self):
  r=m.prepare({'candidates':[]},[{'Código':'1','Nombre':'Bodega','Latitud':'-1.1','Longitud':'38.5','Municipio':'Yecla'}],{'candidates':[]},[])
  self.assertIsNone(r['records'][0]['lat']);self.assertIn('SOURCE_COORDINATE_AXES_REVERSED_REVIEW_REQUIRED',r['records'][0]['reviewFlags'])
 def test_projected(self):
  r=m.prepare({'candidates':[]},[{'Código':'1','Nombre':'Bodega','Latitud':'4259253','Longitud':'647516'}],{'candidates':[]},[])
  self.assertIn('UNKNOWN_PROJECTED_CRS',r['records'][0]['reviewFlags'])
 def test_duplicate_id_rejected(self):
  with self.assertRaises(AssertionError):m.prepare({'candidates':[self.row('a'),self.row('a')]},[],{'candidates':[]},[])
 def test_never_publish(self):
  r=m.prepare({'candidates':[self.row('a')]},[],{'candidates':[]},[])
  self.assertEqual(r['publicationReadyCount'],0);self.assertFalse(r['records'][0]['indexable']);self.assertFalse(r['productionWritePerformed'])
if __name__=='__main__':unittest.main()
