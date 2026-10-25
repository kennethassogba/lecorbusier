import urllib.request,urllib.parse,json,re,html,concurrent.futures,time
from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
DATA=[
('gare-de-lyon','Gare de Lyon','12e',48.8449,2.3735,'Gare de Lyon','Conserver la façade et le beffroi à horloge de la vraie gare de Lyon, clairement identifiables. Intégrer le data center sur le parvis ou dans un volume adjacent, jamais en remplaçant la gare par un immeuble générique.'),
('tour-eiffel','Tour Eiffel','7e',48.8584,2.2945,'Eiffel Tower','La tour Eiffel doit rester entière et immédiatement reconnaissable. Installer le data center dans un volume bas au premier plan ou en bordure du Champ-de-Mars, sans masquer la tour.'),
('louvre','Louvre','1er',48.8606,2.3376,'Louvre Palace','Conserver les façades du palais du Louvre et la composition de la cour de cette photographie. Ajouter une infrastructure de calcul distincte dans la cour sans rendre le palais méconnaissable.'),
('musee-orsay',"Musée d'Orsay",'7e',48.8600,2.3266,"Musée d’Orsay",'Préserver la longue façade ferroviaire et les horloges du musée d’Orsay. Ajouter le data center comme une extension identifiable dans la perspective réelle de la photo.'),
('opera-garnier','Opéra Garnier','9e',48.8720,2.3316,'Palais Garnier','Conserver la façade monumentale et le toit de l’Opéra Garnier, avec la voirie visible. Installer une extension ou un pavillon data center au premier plan sans remplacer le monument.'),
('pantheon','Panthéon','5e',48.8462,2.3464,'Panthéon','Conserver le dôme, le portique et la silhouette du vrai Panthéon. Placer le data center sur la place dans la perspective de référence sans effacer le monument.'),
('notre-dame','Notre-Dame','4e',48.8530,2.3499,'Notre-Dame de Paris','Préserver le chevet, les arcs-boutants, la flèche et les tours visibles de Notre-Dame dans cette vue depuis la Seine. Créer le data center comme un nouveau volume indépendant sur le parvis ou le quai visible, sans transformer la cathédrale.'),
('hotel-de-ville','Hôtel de Ville','4e',48.8566,2.3522,'Hôtel de Ville, Paris','Conserver la façade néo-Renaissance et la place du vrai Hôtel de Ville de Paris. Introduire le data center comme un pavillon distinct, à l’échelle de la place.'),
('sacre-coeur','Sacré-Cœur','18e',48.8867,2.3431,'Sacré-Cœur, Paris','Conserver les dômes blancs et la silhouette entière du Sacré-Cœur sur la butte. Placer un data center en contrebas ou latéralement, visible sans masquer la basilique.'),
('arc-de-triomphe','Arc de Triomphe','8e',48.8738,2.2950,'Arc de Triomphe','Préserver le vrai Arc de Triomphe et sa grande arche. Ajouter le data center sur une emprise voisine visible de l’Étoile, sans remplacer l’arc.'),
('bastille','Bastille','4e',48.8532,2.3692,'Place de la Bastille','Préserver la colonne de Juillet et le Génie de la Liberté en haut de la colonne. Construire le data center sur une emprise adjacente de la place, dans la même perspective.'),
('concorde','Concorde','8e',48.8656,2.3212,'Place de la Concorde','Conserver l’obélisque de Louxor et les axes monumentaux visibles de la place de la Concorde. Intégrer le data center dans un pavillon latéral sans cacher l’obélisque.'),
('republique','République','11e',48.8674,2.3639,'Place de la République','Conserver le monument à la République avec sa statue et le tissu bâti réel en arrière-plan. Ajouter un volume de data center lisible sur un côté de la place.'),
('pompidou','Centre Pompidou','4e',48.8607,2.3525,'Centre Pompidou','Conserver la structure apparente et l’escalier extérieur reconnaissables du Centre Pompidou, visibles derrière le chantier réel de 2026. Ajouter le data center à côté ou sur le parvis sans banaliser ni remplacer le bâtiment.'),
('grand-palais','Grand Palais','8e',48.8661,2.3125,'Grand Palais','Conserver la verrière et la façade du Grand Palais dans cette vue aérienne réelle. Installer le data center en extension distincte dans l’emprise visible, en respectant la perspective réelle.'),
('invalides','Invalides','7e',48.8550,2.3126,'Les Invalides','Conserver le dôme doré et la façade des Invalides, clairement visibles. Ajouter le data center dans un volume bas latéral sans masquer le dôme.'),
('bibliotheque-france','Bibliothèque de France','13e',48.8338,2.3758,'Bibliothèque nationale de France','Préserver les tours de verre en forme de livres ouverts de la Bibliothèque nationale de France. Ajouter le data center sur l’esplanade dans un volume identifiable sans effacer les tours.'),
('palais-royal','Palais-Royal','1er',48.8642,2.3370,'Palais-Royal','Conserver la cour et les façades du Palais-Royal visibles dans cette photo. Si les colonnes de Buren sont présentes, les préserver. Ajouter le data center comme un pavillon contemporain autonome.'),
('trocadero','Trocadéro','16e',48.8620,2.2886,'Palais de Chaillot','Conserver les ailes courbes et la terrasse du palais de Chaillot au Trocadéro dans cette vue aérienne réelle. Ajouter le data center sur une emprise latérale visible en préservant le cadrage et les monuments.'),
('conciergerie','Conciergerie','1er',48.8560,2.3459,'Conciergerie','Conserver les tours médiévales et les quais de Seine visibles de la Conciergerie. Ajouter le data center dans un volume adjacent ou sur le quai, sans effacer les tours ni changer le cadrage de référence.')]
UA={'User-Agent':'ParisArchitectureApp/1.0 (reference photography and attribution; educational architectural speculation)'}
def api(host,params):
 u='https://'+host+'/w/api.php?'+urllib.parse.urlencode(params)
 for attempt in range(3):
  try:
   return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=35))
  except Exception:
   if attempt==2:raise
   time.sleep(2)
def clean(s): return html.unescape(re.sub('<[^>]+>','',s)).strip()
wp=api('en.wikipedia.org',{'action':'query','format':'json','titles':'|'.join(p[5] for p in DATA),'prop':'pageimages','piprop':'original','redirects':1})
images={p['title']:p.get('original',{}).get('source') for p in wp['query']['pages'].values()}
redirects={r['from']:r['to'] for r in wp['query'].get('redirects',[])}
for p in DATA:
 if p[5] not in images: images[p[5]]=images.get(redirects.get(p[5],''))
files={p[0]:'File:'+urllib.parse.unquote(urllib.parse.urlsplit(images[p[5]]).path.split('/')[-1]) for p in DATA if images.get(p[5])}
files.update({'musee-orsay':"File:Musée Orsay façade nord Paris 1.jpg",'pompidou':'File:Le Centre Georges-Pompidou en travaux (2026).jpg','concorde':'File:Paris - Place de la Concorde - 3119.jpg','invalides':'File:South facade of Dôme des Invalides.jpg'})
missing=[p[5] for p in DATA if p[0] not in files]
print('MISSING',missing,flush=True)
meta=api('commons.wikimedia.org',{'action':'query','format':'json','titles':'|'.join(files.values()),'prop':'imageinfo','iiprop':'url|extmetadata','iiurlwidth':1280,'redirects':1})
lookup={p['title']:p.get('imageinfo',[{}])[0] for p in meta['query']['pages'].values()}
for r in meta['query'].get('redirects',[]):lookup[r['from']]=lookup[r['to']]
for r in meta['query'].get('normalized',[]):
 if r['to'] in lookup: lookup[r['from']]=lookup[r['to']]
def download(p):
 id,name,arr,lat,lng,title,context=p
 if id not in files:return None
 m=lookup[files[id]]; ext=m.get('extmetadata',{})
 url=m.get('thumburl') or m['url']
 raw=urllib.request.urlopen(urllib.request.Request(url,headers=UA),timeout=60).read()
 from io import BytesIO
 im=Image.open(BytesIO(raw)).convert('RGB');im.thumbnail((1600,1600));im.save(ROOT/'public/places'/f'{id}.jpg',quality=88,optimize=True)
 result={'id':id,'name':name,'arrondissement':arr,'lat':lat,'lng':lng,'image':f'/corbs/places/{id}.jpg','sourceUrl':m['descriptionurl'],'author':clean(ext.get('Artist',{}).get('value','Wikimedia Commons')),'license':ext.get('LicenseShortName',{}).get('value',''),'licenseUrl':ext.get('LicenseUrl',{}).get('value',''),'context':context,'capturedAt':clean(ext.get('DateTimeOriginal',{}).get('value',''))}
 print(id,im.size,result['license'],result['sourceUrl'],flush=True)
 return result
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 out=list(pool.map(download,DATA))
out=[p for p in out if p]
(ROOT/'data/places.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
sheet=Image.new('RGB',(1200,5*220),'white');d=ImageDraw.Draw(sheet)
for i,p in enumerate(out):
 im=Image.open(ROOT/'public/places'/f'{p["id"]}.jpg');im=ImageOps.fit(im,(280,180))
 x=(i%4)*300;y=(i//4)*220;sheet.paste(im,(x,y));d.text((x+5,y+185),p['id'],fill='black')
sheet.save(ROOT/'data/contact-sheet.jpg')
