"""Record one explicit source-frame rotation, without modifying native files."""
import json, hashlib
from pathlib import Path
KIT=Path(__file__).resolve().parents[2]/'kit'
path=KIT/'contracts.json'
data=json.loads(path.read_text(encoding='utf-8'))
note=('Bake actual imported FBX root/child matrices, then apply Quaternion.Euler(0,180,0) '
      'once to the source frame. Known exporter raw Unity=(-sourceX,sourceZ,-sourceY); '
      'the proper 180-degree yaw yields author=(sourceX,sourceZ,sourceY), determinant +1. '
      'All v1 pieces are symmetric about the source Y/author Z width plane. The asymmetric '
      'tread keeps its intended author -X nose. This is source coordinate adaptation, '
      'not artistic mirroring or nonuniform scaling. Actual Unity envelopes, outward '
      'triangle winding and tread nose must be checked by Engine QA.')
data['unityAdapterYaw']=180
data['adapterNote']=note
data['logicalAxis']='Unity author X=bridge length,Y up,Z width; actual FBX transforms then one 180-degree yaw'
for item in data['assets']:
    source=KIT/item['source']
    assert hashlib.sha256(source.read_bytes()).hexdigest().upper()==item['sourceSha256']
    item['unityAdapterYaw']=180
    item['adapterNote']=note
    item['sourceAxis']='Blender X=length,Y=width,Z=up; v1 all symmetric in width'
    item['logicalAxis']='Adapted Unity author X=length,Y=up,Z=width'
    item['authorBounds']=item['native']['unityBounds']
path.write_text(json.dumps(data,indent=2,ensure_ascii=False),encoding='utf-8')
