const { mkdir, readFile, writeFile } = require('node:fs/promises');
const { basename, join, resolve } = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const selectedIds = [0, 1, 2, 3, 5, 6, 7].map(index => `ai-mapping-${index}`);
const helpers = `
  const byId = id => { const element=document.getElementById(id); if(!element)throw new Error('Missing #'+id); return element; };
  const status = () => byId('status').textContent || '';
  const aiStatus = () => byId('ai-status').textContent || '';
  const change = (id,value) => { const element=byId(id); element.value=value; element.dispatchEvent(new Event('change',{bubbles:true})); };
  const waitFor = async (condition,label) => {
    const deadline=Date.now()+90000;
    while(!condition()) {
      if(/载入失败|生成失败|保存失败|候选已计算，但目标预览失败/.test(status()))throw new Error(label+': '+status());
      if(byId('ai-status').classList.contains('error'))throw new Error(label+': '+aiStatus());
      if(Date.now()>deadline)throw new Error(label+' 超时；status='+status()+'；AI='+aiStatus());
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  };
  const check = id => document.querySelector('input[data-ai-candidate="'+id+'"]');
  const selectionsFromControls = () => Object.fromEntries(['source','target'].map(side=>[side,{
    directionId:byId('ai-'+side+'-direction').value,directionRoot:byId('ai-'+side+'-root').value,bodyAnchor:byId('ai-'+side+'-anchor').value,
    ...(byId('ai-'+side+'-ground').value?{groundAnchor:byId('ai-'+side+'-ground').value}:{}),
    sharedBones:byId('ai-'+side+'-shared').value.split(/\\r?\\n/).filter(Boolean),
    ...(byId('ai-'+side+'-normalization').value?{normalizationBones:byId('ai-'+side+'-normalization').value.split(/\\r?\\n/).filter(Boolean)}:{})
  }]));
`;

/** Real renderer buttons only. Native animation handoff and foreground Spine are deliberately outside this smoke. */
async function runAiFlow(window, inputSelections, options = {}) {
  if (process.env.SPW_SMOKE_AI_ENTRY === '1') return runAiEntryFlow(window);
  let selections = inputSelections;
  if (!selections) {
    try { selections = JSON.parse(process.env.SPW_SMOKE_AI_SELECTIONS || 'null'); }
    catch (error) { throw new Error(`SPW_SMOKE_AI_SELECTIONS 不是有效 JSON：${error.message}`); }
  }
  if (!selections?.source || !selections?.target) throw new Error('AI smoke 需要明确 source / target 方向选择');
  const restore = options.restore ?? process.env.SPW_SMOKE_AI_RESTORE === '1';
  const saveConfigPath = process.env.SPW_SMOKE_CONFIG_SAVE || '';
  if (!restore && !saveConfigPath) throw new Error('AI smoke 需要 SPW_SMOKE_CONFIG_SAVE 以验证跨进程配置');
  const sourceName = basename(process.env.SPW_SMOKE_SPINE_SOURCE || '');
  const targetName = basename(process.env.SPW_SMOKE_TARGET || '');

  const bootstrap = await window.webContents.executeJavaScript(`(async()=>{
    ${helpers}
    const selections=${JSON.stringify(selections)}, restore=${JSON.stringify(restore)}, selectedIds=${JSON.stringify(selectedIds)};
    byId('open-spine-source').click();
    await waitFor(()=>byId('source-name').textContent===${JSON.stringify(sourceName)}&&status().includes('来源已读取'),'来源读取');
    byId('open-target').click();
    await waitFor(()=>byId('target-name').textContent===${JSON.stringify(targetName)}&&status().includes('两份素材已读取'),'目标读取');
    byId('auto-refresh').checked=false;byId('auto-refresh').dispatchEvent(new Event('change',{bubbles:true}));
    const acceptedGroups=[];
    let initiallyUnchecked=false,analysisDirectory='';
    if(restore){
      byId('open-config').click();
      await waitFor(()=>status().includes('映射配置已载入'),'配置恢复');
      await waitFor(()=>aiStatus().includes('已恢复角色标定')&&selectedIds.every(id=>check(id)?.checked&&check(id)?.disabled),'接受记录恢复');
      if(${JSON.stringify(process.env.SPW_SMOKE_AI_REAPPLY==='1')}){
        byId('ai-apply-selection').click();
        await waitFor(()=>aiStatus().includes('方向与身体参考已应用'),'无修改重新应用参考');
        if(!selectedIds.every(id=>check(id)?.checked&&check(id)?.disabled)||check('ai-mapping-4'))throw new Error('无修改重新应用丢失旧版接受或撤回记录');
      }
    }else{
      if(![...byId('clip').options].some(option=>option.value==='common/talk1'))throw new Error('来源缺少 common/talk1');
      change('clip','common/talk1');
      for(const side of ['source','target']){
        const selection=selections[side];
        for(const [suffix,value]of [['direction',selection.directionId],['root',selection.directionRoot],['anchor',selection.bodyAnchor],['ground',selection.groundAnchor||''],['shared',(selection.sharedBones||[]).join(String.fromCharCode(10))],['normalization',(selection.normalizationBones||[]).join(String.fromCharCode(10))]]){
          const element=byId('ai-'+side+'-'+suffix);element.value=value;
          if(element.value!==value)throw new Error('真实选择不存在：'+side+' '+suffix+' '+value);
        }
      }
      if(![...byId('ai-second-animation').options].some(option=>option.value==='run'))throw new Error('来源缺少第二动作 run');
      change('ai-second-animation','run');
      byId('ai-apply-selection').click();
      await waitFor(()=>aiStatus().includes('方向与身体参考已应用'),'应用身体参考');
      byId('ai-export').click();
      await waitFor(()=>!!byId('ai-directory').textContent&&aiStatus().includes('分析包已生成'),'分析包导出');
      analysisDirectory=byId('ai-directory').textContent;
      byId('ai-import').click();
      await waitFor(()=>byId('ai-review-list').querySelectorAll('input[data-ai-candidate]').length===8&&aiStatus().startsWith('已校验'),'AI 结果导入');
      const initial=[...byId('ai-review-list').querySelectorAll('input[data-ai-candidate]')];
      initiallyUnchecked=initial.length===8&&initial.every(checkbox=>!checkbox.checked);
      if(!initiallyUnchecked)throw new Error('AI 候选未保持默认待审阅状态');
      for(const id of selectedIds)if(!check(id)||check(id).disabled)throw new Error('指定候选不可审阅：'+id);
      for(const id of selectedIds){
        if(check(id)?.checked&&check(id)?.disabled)continue;
        const section=check(id).closest('details');if(!section)throw new Error('骨链分组不存在：'+id);
        section.open=true;
        const groupIds=selectedIds.filter(candidate=>section.contains(check(candidate))&&!check(candidate).disabled);
        for(const candidate of groupIds){check(candidate).checked=true;check(candidate).dispatchEvent(new Event('change',{bubbles:true}));}
        const button=[...section.querySelectorAll('button')].find(item=>item.textContent==='接受本链勾选项');
        if(!button)throw new Error('骨链接受按钮不存在：'+id);
        const title=section.querySelector('summary').textContent;button.click();
        await waitFor(()=>groupIds.every(candidate=>check(candidate)?.checked&&check(candidate)?.disabled),'确认骨链 '+title);
        acceptedGroups.push({title,ids:groupIds});
      }
      if(!check('ai-mapping-4')||check('ai-mapping-4').checked)throw new Error('需单独校准的头骨候选缺失或被自动接受');
      if(byId('save-config').disabled)throw new Error('映射配置保存不可用');
      byId('save-config').click();await waitFor(()=>status().startsWith('映射配置已保存：'),'保存已审阅配置');
      if(status().slice('映射配置已保存：'.length)!==${JSON.stringify(saveConfigPath)})throw new Error('配置保存路径与 smoke 参数不一致');
    }
    return {sourceLoaded:true,targetLoaded:true,restore,initiallyUnchecked,analysisDirectory,acceptedGroups,
      selections:selectionsFromControls(),acceptedIds:selectedIds.filter(id=>check(id)?.checked&&check(id)?.disabled),
      deferredHead:!check('ai-mapping-4')||!check('ai-mapping-4').checked,headHidden:!check('ai-mapping-4'),aiStatus:aiStatus(),status:status()};
  })()`);
  if (!isDeepStrictEqual(bootstrap.selections, { source: selections.source, target: selections.target })) throw new Error('AI 方向与身体参考未按真实选择应用 / 恢复');
  if (!isDeepStrictEqual([...bootstrap.acceptedIds].sort(), [...selectedIds].sort())) throw new Error('AI 映射接受记录不是指定的七项');

  const configPath = restore ? process.env.SPW_SMOKE_CONFIG : saveConfigPath;
  if (!configPath) throw new Error('配置路径缺失，无法核对实际保存结果');
  const saved = JSON.parse(await readFile(configPath, 'utf8'));
  if (!isDeepStrictEqual([...(saved.aiReview?.acceptedIds || [])].sort(), [...selectedIds].sort())) throw new Error('磁盘配置未保留七项接受记录');
  if (!isDeepStrictEqual(saved.aiReview?.manifest?.sourceSelection, selections.source)
    || !isDeepStrictEqual(saved.aiReview?.manifest?.targetSelection, selections.target)) throw new Error('磁盘配置未保留真实方向标定');
  if (restore && saved.aiReview?.withdrawnIds?.includes('ai-mapping-4') && !bootstrap.headHidden) throw new Error('已撤回的头骨候选在重新载入后重新出现');
  const reviewedMappings = saved.objectMappings.filter(mapping => mapping.provenance?.origin === 'reviewed-ai');
  if (reviewedMappings.length !== 7) throw new Error(`磁盘配置 reviewed-ai 映射数异常：${reviewedMappings.length}`);

  const screenshotParent = process.env.SPW_SMOKE_AI_SCREENSHOTS || process.env.SPW_SMOKE_OUTPUT || process.env.SPW_SMOKE_AI_OUTPUT;
  if (!screenshotParent) throw new Error('需要 AI smoke 图片输出目录');
  const screenshotDirectory = join(resolve(screenshotParent), `ai-ui-smoke-${restore ? 'restore' : 'fresh'}-${Date.now()}`);
  await mkdir(screenshotDirectory, { recursive: true });
  const actions = [];
  for (const animation of restore ? ['run'] : ['common/talk1', 'run']) {
    const result = await window.webContents.executeJavaScript(`(async()=>{
      ${helpers}
      const animation=${JSON.stringify(animation)},clip=byId('clip');
      if(![...clip.options].some(option=>option.value===animation))throw new Error('来源没有动作：'+animation);
      if(clip.value!==animation)change('clip',animation);
      if(byId('generate').disabled)throw new Error('刷新按钮不可用：'+status());
      byId('generate').click();
      await waitFor(()=>status().startsWith('草稿已刷新：')&&byId('target-caption').textContent.includes('草稿预览与导入数据一致'),'动作 '+animation+' 草稿预览');
      const time=byId('time'),minimum=Number(time.min),maximum=Number(time.max),midpoint=(minimum+maximum)/2;
      if(!(maximum>minimum))throw new Error('动作时间范围无效：'+animation);
      const sampledTimes=[];
      for(const requested of [minimum,midpoint,maximum]){
        time.value=String(requested);time.dispatchEvent(new Event('input',{bubbles:true}));
        if(Math.abs(Number(time.value)-requested)>0.01)throw new Error('时间采样未到达：'+animation+' '+requested);
        if(/预览错误|预览失败|预览不可用/.test(byId('source-caption').textContent+' '+byId('target-caption').textContent))throw new Error('逐帧预览失败：'+animation+' '+requested);
        for(const id of ['source-canvas','target-canvas']){const canvas=byId(id);if(!canvas.width||!canvas.height||canvas.getContext('webgl')?.isContextLost())throw new Error(id+' WebGL不可用');}
        sampledTimes.push(Number(time.value));
      }
      time.value=String(midpoint);time.dispatchEvent(new Event('input',{bubbles:true}));
      byId('source-canvas').scrollIntoView({block:'center'});
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      return {animation,sampledTimes,screenshotTime:Number(time.value),status:status(),summary:byId('report-summary').textContent,
        stage:byId('stage-state').textContent,targetCaption:byId('target-caption').textContent,
        sourceCaption:byId('source-caption').textContent,mappingCount:byId('mapping-list').querySelectorAll('.mapping-row').length,
        acceptedIds:${JSON.stringify(selectedIds)}.filter(id=>check(id)?.checked&&check(id)?.disabled)};
    })()`);
    if (!isDeepStrictEqual([...result.acceptedIds].sort(), [...selectedIds].sort())) throw new Error('切换动作时接受记录丢失');
    const screenshotPath = join(screenshotDirectory, `${animation.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`);
    await writeFile(screenshotPath, (await window.webContents.capturePage()).toPNG());
    actions.push({ ...result, screenshotPath });
  }
  const diagnostics = await window.webContents.executeJavaScript(`(async()=>{
    ${helpers}
    if(byId('ai-diagnostics').disabled)throw new Error('诊断导出按钮未启用');
    byId('ai-diagnostics').click();await waitFor(()=>aiStatus().startsWith('诊断与修整请求已导出：'),'导出诊断');
    return {directory:aiStatus().slice('诊断与修整请求已导出：'.length),status:aiStatus()};
  })()`);
  let withdraw = {};
  if (!restore) {
    withdraw = await window.webContents.executeJavaScript(`(async()=>{
      ${helpers}
      const selectedIds=${JSON.stringify(selectedIds)};
      if(byId('ai-withdraw').disabled)throw new Error('尚未应用的提案撤回按钮不可用');
      byId('ai-withdraw').click();
      await waitFor(()=>selectedIds.every(id=>check(id)?.checked&&check(id)?.disabled)&&!check('ai-mapping-4')
        &&byId('ai-review-list').querySelectorAll('input[data-ai-candidate]').length===7,'撤回仅未接受候选');
      const withdrawStatus=aiStatus();
      const acceptedCountLabels=selectedIds.map(id=>check(id).closest('.ai-candidate').querySelector('small')?.textContent||'');
      if(acceptedCountLabels.some(label=>!label.includes('已接受')))throw new Error('撤回后已接受状态文案丢失');
      if(byId('save-config').disabled)throw new Error('撤回后配置保存不可用');
      byId('save-config').click();await waitFor(()=>status().startsWith('映射配置已保存：'),'保存撤回后的接受记录');
      if(status().slice('映射配置已保存：'.length)!==${JSON.stringify(saveConfigPath)})throw new Error('撤回后配置保存路径不一致');
      return {withdrawPreservedAccepted:true,withdrawStatus,acceptedCountLabels};
    })()`);
    const afterWithdraw = JSON.parse(await readFile(configPath, 'utf8'));
    if (!isDeepStrictEqual([...(afterWithdraw.aiReview?.acceptedIds || [])].sort(), [...selectedIds].sort())) throw new Error('撤回未接受候选时磁盘配置的已接受记录被清空');
    if (afterWithdraw.objectMappings.filter(mapping => mapping.provenance?.origin === 'reviewed-ai').length !== 7) throw new Error('撤回未接受候选时已审阅映射被改变');
    if (!isDeepStrictEqual(afterWithdraw.aiReview?.withdrawnIds, ['ai-mapping-4'])) throw new Error('撤回的头骨候选未持久保存');
    withdraw.withdrawnIds = afterWithdraw.aiReview.withdrawnIds;
  }
  return { ...bootstrap, savedConfigPath: configPath, reviewedMappingCount: reviewedMappings.length, screenshotDirectory, actions,
    diagnosticsDirectory: diagnostics.directory, diagnosticsStatus: diagnostics.status, withdrawnIds: saved.aiReview?.withdrawnIds || [], ...withdraw };
}

module.exports = { runAiFlow };

/** Regression for a first-time user who has not filled the optional direction labels. */
async function runAiEntryFlow(window) {
  const selections=JSON.parse(process.env.SPW_SMOKE_AI_SELECTIONS);
  return window.webContents.executeJavaScript(`(async()=>{
    ${helpers}
    byId('open-spine-source').click();await waitFor(()=>status().includes('来源已读取'),'来源读取');
    byId('open-target').click();await waitFor(()=>status().includes('两份素材已读取'),'目标读取');
    byId('auto-refresh').checked=false;byId('auto-refresh').dispatchEvent(new Event('change'));
    byId('ai-rig-settings').open=false;
    byId('ai-export').click();await new Promise(resolve=>setTimeout(resolve,50));
    if(!byId('ai-rig-settings').open || byId('ai-status').classList.contains('error'))throw new Error('首次生成仍被隐藏的必填方向标识阻止：'+aiStatus());
    if(byId('ai-directory').textContent)throw new Error('未确认参考点就写入分析包');
    const selections=${JSON.stringify(selections)};
    for(const side of ['source','target']){
      const selection=selections[side];
      change('ai-'+side+'-root',selection.directionRoot);change('ai-'+side+'-anchor',selection.bodyAnchor);
      change('ai-'+side+'-ground',selection.groundAnchor||'');
      change('ai-'+side+'-shared',(selection.sharedBones||[]).join(String.fromCharCode(10)));
      change('ai-'+side+'-normalization',(selection.normalizationBones||[]).join(String.fromCharCode(10)));
      change('ai-'+side+'-direction','');
    }
    change('clip','common/talk1');byId('ai-apply-selection').click();
    await waitFor(()=>aiStatus().includes('方向与身体参考已应用'),'空方向标签应用');
    for(const side of ['source','target'])if(byId('ai-'+side+'-direction').value!==selections[side].directionRoot)throw new Error('方向标识没有采用真实入口骨名');
    byId('ai-export').click();await waitFor(()=>aiStatus().includes('分析包已生成')&&!!byId('ai-directory').textContent,'分析包导出');
    const directory=byId('ai-directory').textContent;
    byId('ai-rig-settings').open=false;
    change('ai-target-direction','用户修改待确认');
    byId('ai-export').click();await new Promise(resolve=>setTimeout(resolve,50));
    if(!byId('ai-rig-settings').open||!aiStatus().includes('重新应用')||byId('ai-status').classList.contains('error'))throw new Error('修改参考后仍未明确引导重新应用：'+aiStatus());
    return {guidedFirstExport:true,blankDirectionUsesBoneName:true,dirtySelectionGuided:true,directory,status:aiStatus()};
  })()`);
}
