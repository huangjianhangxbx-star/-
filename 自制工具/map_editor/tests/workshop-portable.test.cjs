const test = require("node:test"),
  assert = require("node:assert/strict");
const core = require("../dist/workshop.cjs"),
  codec = require("../desktop/portable-asset.cjs");
function chunk(type, data) {
  const b = Buffer.alloc(data.length + 12);
  b.writeUInt32BE(data.length);
  b.write(type, 4);
  data.copy(b, 8);
  let c = 0xffffffff;
  for (let i = 4; i < b.length - 4; i++) {
    c ^= b[i];
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  b.writeUInt32BE((c ^ 0xffffffff) >>> 0, b.length - 4);
  return b;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(1);
header.writeUInt32BE(1, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", header),
  chunk(
    "IDAT",
    require("node:zlib").deflateSync(Buffer.from([0, 255, 0, 0, 255])),
  ),
  chunk("IEND", Buffer.alloc(0)),
]).toString("base64");
test("portable model preserves canvases and preview and refuses corruption", () => {
  const source = core.upgradeCanvases(core.createAsset("portable"), "multi");
  const bytes = codec.encode(source, png, core),
    result = codec.decode(bytes, core);
  assert.notEqual(result.document.assetId, source.assetId);
  assert.deepEqual(result.document.canvases, source.canvases);
  assert.equal(result.preview, png);
  const broken = JSON.parse(bytes);
  broken.source += " ";
  assert.throws(
    () => codec.decode(Buffer.from(JSON.stringify(broken)), core),
    /校验/,
  );
});
test('portable painted source preserves exact texels and rejects paint tampering',()=>{
  const source=core.upgradeCanvases(core.createAsset('portable-paint'),'paint-copy');
  source.canvases[0].cells=[{x:0,y:0,z:0,color:0}];
  source.canvases[0].paintSource={schema:'xinghai-surface-paint-1',density:64,faces:{'0,0,0,0':{'0':'#aabbcc','255':'#112233'},'0,0,0,4':{'19':'#abcdef'}}};
  const bytes=codec.encode(source,png,core),result=codec.decode(bytes,core);
  assert.deepEqual(result.document.canvases,source.canvases);
  result.document.canvases[0].paintSource.faces['0,0,0,0']['0']='#ffffff';
  assert.equal(source.canvases[0].paintSource.faces['0,0,0,0']['0'],'#aabbcc');
  const broken=JSON.parse(bytes);broken.source=broken.source.replace('#aabbcc','#ffffff');
  assert.throws(()=>codec.decode(Buffer.from(JSON.stringify(broken)),core),/校验/);
});
