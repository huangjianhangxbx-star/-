/* Store-only ZIP for the user's locally cut PNGs. No service upload. */
window.pngZip=async function(files){
 const encoder=new TextEncoder(),chunks=[],entries=[];let offset=0;
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const header=(size,values)=>{const a=new Uint8Array(size),v=new DataView(a.buffer);for(const[p,n,bits]of values)bits===16?v.setUint16(p,n,true):v.setUint32(p,n,true);return a;};
 for(const[name,blob]of files){const bytes=new Uint8Array(await blob.arrayBuffer()),n=encoder.encode(name),sum=crc(bytes),h=header(30,[[0,0x04034b50,32],[4,20,16],[6,0x800,16],[14,sum,32],[18,bytes.length,32],[22,bytes.length,32],[26,n.length,16]]);entries.push({n,sum,size:bytes.length,offset});chunks.push(h,n,bytes);offset+=h.length+n.length+bytes.length;}
 const directoryStart=offset;for(const e of entries){const h=header(46,[[0,0x02014b50,32],[4,20,16],[6,20,16],[8,0x800,16],[16,e.sum,32],[20,e.size,32],[24,e.size,32],[28,e.n.length,16],[42,e.offset,32]]);chunks.push(h,e.n);offset+=h.length+e.n.length;}
 chunks.push(header(22,[[0,0x06054b50,32],[8,entries.length,16],[10,entries.length,16],[12,offset-directoryStart,32],[16,directoryStart,32]]));return new Blob(chunks,{type:'application/zip'});
};
