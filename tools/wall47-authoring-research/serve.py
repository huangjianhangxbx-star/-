"""Loopback-only study service; ID-only Explorer calls through audited local G01."""
import argparse,json,sys
from pathlib import Path
from urllib.parse import unquote,urlsplit
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from model import safe_path

def make_server(study,library,port=5294,reveal=None):
 study=Path(study).resolve();library=Path(library).resolve();sys.path.insert(0,str(library/'tools'))
 from gallery_server import GalleryHandler,AssetRegistry,AssetError,select_in_explorer
 data=json.loads((study/'gallery/data.json').read_text(encoding='utf8'));ids={e['spriteKey'] for f in data['families'] for e in f['entries']}
 rows=[json.loads(l) for l in (library/'catalog/asset-index.jsonl').read_text(encoding='utf8').splitlines()];rows=[r for r in rows if r.get('asset_key') in ids]
 registry=AssetRegistry(library,rows)
 if set(registry.records)!=ids:raise ValueError('study identities missing from export registry')
 class Handler(GalleryHandler):
  def static_request(self,head=False):
   try:
    self.trusted_request();route=unquote(urlsplit(self.path).path)
    if route=='/api/health':self.reply(200,ok=True,service='wall47-study/1');return
    if route=='/':self.send_response(302);self.send_header('Location','/gallery/artist-workflow.html');self.end_headers();return
    if route.startswith('/library/'):
     rel=route[len('/library/'):];key=self.server.png_ids.get(rel)
     if key is None:raise AssetError(404,'原图不在本研究身份清单')
     target=self.server.registry.resolve(key)
    else:
     target=safe_path(study,route.lstrip('/'));parts=target.relative_to(study).parts
     if not parts or parts[0] not in ['gallery','views','masters','reports','comparisons'] or target.suffix.lower() not in ['.html','.js','.css','.json','.png','.md','.csv','.zip'] or not target.is_file():raise AssetError(404,'此路径不开放')
    self.static_target=target
    if head:SimpleHTTPRequestHandler.do_HEAD(self)
    else:SimpleHTTPRequestHandler.do_GET(self)
   except ValueError:self.reply(403,ok=False,error='路径越出研究区')
   except AssetError as e:self.reply(e.status,ok=False,error=e.message)
 server=ThreadingHTTPServer(('127.0.0.1',port),Handler);server.registry=registry;server.reveal=reveal or select_in_explorer;server.png_ids={r['png_path']:k for k,r in registry.records.items()};server.daemon_threads=True;return server
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--study',required=True);p.add_argument('--library',required=True);p.add_argument('--port',type=int,default=5294);a=p.parse_args()
 with make_server(a.study,a.library,a.port) as server:
  print(f'http://127.0.0.1:{a.port}/gallery/artist-workflow.html',flush=True);server.serve_forever()
