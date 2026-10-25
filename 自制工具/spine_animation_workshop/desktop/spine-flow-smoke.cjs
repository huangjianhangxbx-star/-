/** Exercise the real Spine-to-Spine renderer without taking over the mouse. */
async function runSpineFlow(window, animation = 'run') {
  const sourceName = require('node:path').basename(process.env.SPW_SMOKE_SPINE_SOURCE || '');
  const targetName = require('node:path').basename(process.env.SPW_SMOKE_TARGET || '');
  const saveConfigPath = process.env.SPW_SMOKE_CONFIG_SAVE || '';
  return window.webContents.executeJavaScript(`(async () => {
    const animation = ${JSON.stringify(animation)};
    const sourceName = ${JSON.stringify(sourceName)};
    const targetName = ${JSON.stringify(targetName)};
    const saveConfigPath = ${JSON.stringify(saveConfigPath)};
    const byId = (id) => document.getElementById(id);
    const status = () => byId('status')?.textContent || '';
    const waitFor = async (condition, label) => {
      const deadline = Date.now() + 90000;
      while (!condition()) {
        if (/来源载入失败|目标载入失败|配置载入失败|迁移已阻止|生成失败|保存失败/.test(status())) {
          throw new Error(label + ': ' + status());
        }
        if (Date.now() > deadline) throw new Error(label + ' 超时: ' + status());
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };

    byId('open-spine-source').click();
    await waitFor(() => byId('source-name').textContent === sourceName && status().includes('来源已读取'), '来源读取');
    byId('open-target').click();
    await waitFor(() => byId('target-name').textContent === targetName && status().includes('两份素材已读取'), '目标读取');
    const sourceLoaded = byId('source-name').textContent === sourceName;
    const targetLoaded = byId('target-name').textContent === targetName;

    byId('auto-refresh').checked = false; byId('auto-refresh').dispatchEvent(new Event('change'));
    byId('open-config').click();
    await waitFor(() => status().includes('映射配置已载入'), '映射配置读取');
    byId('draft-scope').value = 'mapped'; byId('draft-scope').dispatchEvent(new Event('change'));
    const configLoaded = byId('mapping-list').querySelectorAll('.mapping-row').length > 0
      && !!byId('source-direction').value && !!byId('target-direction').value;
    let savedConfigPath = '';
    if (saveConfigPath) {
      if (byId('save-config').disabled) throw new Error('配置保存按钮不可用');
      byId('save-config').click();
      await waitFor(() => status().startsWith('映射配置已保存：'), '应用内配置另存');
      savedConfigPath = status().slice('映射配置已保存：'.length);
      if (savedConfigPath !== saveConfigPath) throw new Error('配置保存路径不一致');
    }
    const clip = byId('clip');
    if (![...clip.options].some((option) => option.value === animation)) {
      throw new Error('来源没有 smoke 动作：' + animation);
    }
    if (clip.value !== animation) {
      clip.value = animation;
      clip.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await waitFor(() => byId('animation-name').value.length > 0 && byId('channel-list').children.length > 0, '动作选择');
    const outputName = byId('animation-name').value;
    byId('choose-output').click();
    await waitFor(() => byId('output-path').textContent !== '尚未选择目录', '输出目录选择');
    if (byId('generate').disabled) throw new Error('生成按钮不可用：' + status());

    byId('generate').click();
    await waitFor(() => !byId('save-output').disabled, '生成和预览');
    const reportSummary = byId('report-summary').textContent || '';
    const blockedRows = [...byId('report-list').querySelectorAll('.blocked')];
    const calibrationWarnings = blockedRows.filter((line) => (line.textContent || '').startsWith('校准警告')).length;
    const noBlockedChannels = blockedRows.length === calibrationWarnings;
    const noUnmappedChannels = ![...byId('report-list').children].some(line => /^(未映射|不兼容|冲突)/.test(line.textContent || ''));
    const stage = byId('stage-state').textContent || '';
    const targetCaption = byId('target-caption').textContent || '';
    const canvas = byId('target-canvas');
    const previewReady = targetCaption.includes('草稿预览与导入数据一致')
      && canvas.width > 0 && canvas.height > 0
      && !canvas.getContext('webgl')?.isContextLost();
    const generated = stage.includes('草稿可预览') && targetCaption.includes(outputName);

    const time = byId('time');
    const minimum = Number(time.min);
    const maximum = Number(time.max);
    const midpoint = (minimum + maximum) / 2;
    const requestedTimes = animation === 'city/interact'
      ? [minimum, 0.1, 0.2, midpoint, maximum]
      : [minimum, midpoint, maximum];
    const sampledTimes = [];
    for (const requested of requestedTimes) {
      time.value = String(requested);
      time.dispatchEvent(new Event('input', { bubbles: true }));
      if (Math.abs(Number(time.value) - requested) > 0.01) throw new Error('时间轴未移到采样时点');
      if (/预览错误|预览失败/.test(byId('source-caption').textContent || '')
        || /预览错误|预览失败/.test(byId('target-caption').textContent || '')) {
        throw new Error('候选逐时点预览失败：' + requested);
      }
      sampledTimes.push(Number(time.value));
    }

    byId('save-output').click();
    await waitFor(() => status().startsWith('完整副本与迁移报告已保存：') || status().startsWith('导回文件已准备：'), '完整副本保存');
    const nativePrepared = status().startsWith('导回文件已准备：');
    const savedPath = status().slice((nativePrepared ? '导回文件已准备：' : '完整副本与迁移报告已保存：').length);
    return {
      animation, sourceLoaded, targetLoaded, configLoaded, savedConfigPath, outputName, nativePrepared,
      previewReady, generated, noBlockedChannels, noUnmappedChannels,
      reportSummary, calibrationWarnings, stage, targetCaption, sampledTimes, savedPath,
    };
  })()`);
}

module.exports = { runSpineFlow };

/** Fresh project pair, no saved mapping and no direction text. Check actual renderer controls. */
async function runAutoMappingFlow(window, animation = 'atk1') {
  return window.webContents.executeJavaScript(`(async () => {
    const byId = id => document.getElementById(id);
    const waitFor = async (condition, label) => {
      const deadline = Date.now() + 90000;
      while (!condition()) {
        if (/载入失败|自动分析未完成|生成失败/.test(byId('status').textContent + byId('mapping-analysis').textContent)) throw new Error(label + ': ' + byId('status').textContent + byId('mapping-analysis').textContent);
        if (Date.now() > deadline) throw new Error(label + ' timeout');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    };
    byId('open-spine-source').click();
    await waitFor(() => byId('status').textContent.includes('来源已读取'), 'source');
    byId('open-target').click();
    await waitFor(() => byId('status').textContent.includes('两份素材已读取'), 'target');
    const initialAutomatic = byId('mapping-list').querySelectorAll('.mapping-row').length > 3;
    const clip = byId('clip'); clip.value = ${JSON.stringify(animation)}; clip.dispatchEvent(new Event('change', {bubbles:true}));
    await waitFor(() => byId('mapping-analysis').textContent.includes('本地采样 25 帧'), 'sampling');
    byId('suggest-mappings').click();
    const mappingCount = byId('mapping-list').querySelectorAll('.mapping-row').length;
    const summary = byId('mapping-analysis').textContent;
    const reviewCount = byId('suggestion-list').querySelectorAll('.suggestion-row').length;
    const optionalDirections = !byId('source-direction').value && !byId('target-direction').value;
    byId('generate').click();
    await waitFor(() => byId('report-summary').textContent !== '尚未生成', 'channel audit');
    return {initialAutomatic, mappingCount, summary, reviewCount, optionalDirections,
      status: byId('status').textContent, reportSummary: byId('report-summary').textContent,
      noRawError: !/must be|生成失败/.test(byId('status').textContent),
      unsafeSaveDisabled: byId('save-output').disabled, draftPreviewReady: !byId('save-output').disabled};
  })()`);
}
module.exports.runAutoMappingFlow = runAutoMappingFlow;

/** Verify the user-facing partial draft / adjust / refresh / confirm loop without controlling the mouse. */
async function runIterativeDraftFlow(window, animation = 'atk1') {
  return window.webContents.executeJavaScript(`(async () => {
    const animation = ${JSON.stringify(animation)};
    const byId=id=>document.getElementById(id);
    const waitFor=async(condition,label)=>{const deadline=Date.now()+90000;while(!condition()){
      if(/载入失败|生成失败|保存失败|预览失败/.test(byId('status').textContent))throw new Error(label+': '+byId('status').textContent);
      if(Date.now()>deadline)throw new Error(label+' timeout: '+byId('status').textContent);
      await new Promise(resolve=>setTimeout(resolve,100));
    }};
    byId('open-spine-source').click();await waitFor(()=>byId('status').textContent.includes('来源已读取'),'source');
    byId('open-target').click();await waitFor(()=>byId('status').textContent.includes('两份素材已读取'),'target');
    byId('clip').value=${JSON.stringify(animation)};byId('clip').dispatchEvent(new Event('change',{bubbles:true}));
    await waitFor(()=>byId('status').textContent.startsWith('草稿已刷新')&&!byId('save-output').disabled,'automatic draft');
    const firstName=byId('target-caption').textContent;
    const firstSummary=byId('report-summary').textContent;
    const outputNotChosen=byId('output-path').textContent==='尚未选择目录';
    const row=[...byId('mapping-list').querySelectorAll('.mapping-row')].find(row=>row.querySelector('.mapping-name-grid input')?.value==='hips7');
    if(!row)throw new Error('body mapping row missing');
    const edit=target=>{const r=[...byId('mapping-list').querySelectorAll('.mapping-row')].find(row=>row.querySelector('.mapping-name-grid input')?.value==='hips7');const input=r.querySelectorAll('.mapping-name-grid input')[1];input.value=target;input.dispatchEvent(new Event('change',{bubbles:true}));};
    byId('auto-refresh').checked=false;byId('auto-refresh').dispatchEvent(new Event('change'));
    edit('body');
    const staleDisabled=byId('save-output').disabled;
    byId('generate').click();await waitFor(()=>!byId('save-output').disabled,'manual refresh with mapping conflict');
    const conflictPreviewReady=byId('report-summary').textContent!==firstSummary;
    byId('auto-refresh').checked=true;byId('auto-refresh').dispatchEvent(new Event('change'));
    edit('chest');await waitFor(()=>!byId('save-output').disabled&&byId('report-summary').textContent===firstSummary,'automatic edited refresh');
    const sameDraftName=byId('target-caption').textContent===firstName;
    const sampledTimes=[];for(const time of [0,0.7,Number(byId('time').max)]){byId('time').value=String(time);byId('time').dispatchEvent(new Event('input'));sampledTimes.push(Number(byId('time').value));}
    const readyStatus=byId('status').textContent;
    byId('save-output').click();await waitFor(()=>byId('status').textContent.startsWith('导回文件已准备：'),'confirm native animation');
    return {animation,firstSummary,firstName,outputNotChosen,staleDisabled,conflictPreviewReady,sameDraftName,sampledTimes,readyStatus,
      savedPath:byId('status').textContent.slice('导回文件已准备：'.length),projectPath:byId('native-project-path').textContent,carrierPath:byId('native-import-path').textContent};
  })()`);
}
module.exports.runIterativeDraftFlow=runIterativeDraftFlow;
