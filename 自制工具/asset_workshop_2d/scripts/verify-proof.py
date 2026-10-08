"""Independent optional audit using Python zipfile and Pillow; never writes source inputs."""
from pathlib import Path, PurePosixPath
from hashlib import sha256
from zipfile import ZipFile
from io import BytesIO
import json
from PIL import Image

base = Path(__file__).resolve().parent.parent
archive = base / 'validation/proof-output/2dw-proof-codex.zip'
destination = base / 'validation/proof-extracted'
destination.mkdir(exist_ok=False)
with ZipFile(archive) as package:
    assert package.testzip() is None
    names = package.namelist()
    assert len(names) == len(set(names)) == 9
    files = {name: package.read(name) for name in names}
    manifest = json.loads(files['manifest.json'])
    spec = json.loads(files['spec/asset-spec.json'])
    assert {entry['path'] for entry in manifest['entries']} == set(names) - {'manifest.json'}
    for entry in manifest['entries']:
        data = files[entry['path']]
        assert len(data) == entry['byteLength'] and sha256(data).hexdigest() == entry['sha256']
    assert manifest['references'] == spec['references']
    assert manifest['taskId'] == spec['taskId']
    assert spec['output']['ppu'] == 100 and spec['output']['worldWidth'] == 3.84
    assert spec['fieldSources']['output.ppu'] == 'project-default'
    assert 'output/asset.png' not in names
    for reference in spec['references']:
        data = files[reference['packagePath']]
        assert data == (base / 'tests/fixtures' / reference['sourceName']).read_bytes()
        with Image.open(BytesIO(data)) as image:
            image.load()
            assert image.format == 'PNG' and image.size == (reference['widthPx'], reference['heightPx'])
        assert reference['packagePath'] in files['prompts/codex.md'].decode('utf-8')
        assert 'sourcePath' not in reference
    for name, data in files.items():
        parts = PurePosixPath(name)
        assert not parts.is_absolute() and '..' not in parts.parts and '\\' not in name and ':' not in name
        target = destination.joinpath(*parts.parts).resolve()
        assert target.is_relative_to(destination.resolve())
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        assert target.read_bytes() == data
report = {'zip': str(archive), 'sha256': sha256(archive.read_bytes()).hexdigest(),
          'files': names, 'references': len(spec['references']), 'crc': 'pass',
          'manifestHashes': 'pass', 'sourceBytes': 'identical', 'decodedPNG': 'pass',
          'targetGenerated': False, 'extractedTo': str(destination)}
(base / 'validation/independent-zip-audit.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report, ensure_ascii=False, indent=2))
