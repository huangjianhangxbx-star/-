'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
function makeProposal(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 8192 || text.includes('\0')) throw Error('请填写有效修订建议（最多8192字）。');
  return {schemaVersion:'2dw-environment-proposal/1',catalogVersion:'1',status:'candidate',text:text.trim(),origin:'用户在桌面工坊提交的待审修订；未修改批准规则'};
}
async function saveProposal(text, destination) {
  const proposal = makeProposal(text);
  if (!destination) return {cancelled:true};
  if (!path.isAbsolute(destination) || path.extname(destination).toLowerCase() !== '.json') throw Error('请选择 JSON 草稿文件。');
  const bytes = Buffer.from(JSON.stringify(proposal,null,2)+'\n');
  await fs.writeFile(destination, bytes, {flag:'wx'});
  return {cancelled:false,path:destination,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
}
module.exports = {makeProposal,saveProposal};
