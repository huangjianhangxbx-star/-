/** Hidden, no-mouse renderer exercise using the real ignored intake samples. */
async function runFlow(window, scenario = 'normal') {
  return window.webContents.executeJavaScript(`(async () => {
    const scenario = ${JSON.stringify(scenario)};
    const byId = (id) => document.getElementById(id);
    const status = () => byId('status').textContent || '';
    const waitFor = async (condition, label) => {
      const deadline = Date.now() + 25000;
      while (!condition()) {
        if (status().includes('失败')) throw new Error(label + ': ' + status());
        if (Date.now() > deadline) throw new Error(label + ' 超时: ' + status());
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    const setValue = (id, value, event = 'change') => {
      const node = byId(id); node.value = value; node.dispatchEvent(new Event(event, { bubbles: true }));
    };
    const setSelect = (node, value) => {
      node.value = value; node.dispatchEvent(new Event('change', { bubbles: true }));
    };

    byId('open-source').click();
    await waitFor(() => byId('source-name').textContent !== '尚未载入' && byId('source-caption').textContent !== '载入后显示三维模型；无网格时显示骨架', '源 GLB 载入');
    byId('open-target').click();
    await waitFor(() => byId('target-name').textContent !== '尚未载入' && !byId('add-mapping').disabled, '目标 Spine 载入');
    setValue('range-end', '0.1');
    setValue('sample-hz', '10');
    const sourcePaths = [...byId('source-foot').options].map((option) => option.value).filter(Boolean);
    setValue('source-foot', sourcePaths.at(-1));
    const targetBones = [...byId('target-foot').options].map((option) => option.value).filter(Boolean);
    setValue('target-foot', targetBones.includes('root') ? 'root' : targetBones[0]);
    byId('add-mapping').click();
    const mapping = byId('mapping-list').querySelector('.mapping-row');
    const selects = mapping.querySelectorAll('select');
    setSelect(selects[0], sourcePaths[0]);
    setSelect(selects[1], sourcePaths[1]);
    setSelect(selects[2], targetBones.includes('root') ? 'root' : targetBones[0]);
    setValue('yaw', '45', 'input');
    const liveFeedback = byId('target-caption').textContent.includes('当前帧实时预览');
    if (scenario === 'invalid-config') {
      byId('choose-output').click();
      await waitFor(() => byId('output-path').textContent !== '尚未选择目录', '输出目录选择');
      byId('open-config').click();
      await waitFor(() => status().includes('配置读取失败'), '无效配置读取');
      const generateReadyAfterBadConfig = !byId('generate').disabled;
      byId('generate').click();
      await waitFor(() => !byId('save-output').disabled, '无效配置后的原配置恢复');
      return { generateReadyAfterBadConfig, generatedAfterBadConfig: !byId('save-output').disabled };
    }
    if (scenario === 'protect-config-input') {
      byId('choose-output').click();
      await waitFor(() => byId('output-path').textContent !== '尚未选择目录', '输出目录选择');
      byId('save-config').click();
      await waitFor(() => status().includes('配置保存失败'), '原件覆盖保护');
      return { protected: status().includes('不能覆盖已载入的原素材'), status: status() };
    }
    byId('choose-output').click();
    await waitFor(() => byId('output-path').textContent !== '尚未选择目录', '输出目录选择');
    byId('save-config').click();
    await waitFor(() => status().includes('配置已保存'), '配置保存');
    setValue('yaw', '0', 'input');
    byId('open-config').click();
    await waitFor(() => byId('yaw').value === '45', '配置重开');
    byId('choose-output').click();
    await waitFor(() => byId('output-path').textContent !== '尚未选择目录', '输出目录选择');
    byId('step-forward').click();
    const stepped = Number(byId('time').value) > 0;
    if (byId('generate').disabled) throw new Error('生成按钮不可用: ' + status());
    byId('generate').click();
    await waitFor(() => !byId('save-output').disabled, '动画生成');
    if (scenario === 'target-identity') {
      byId('open-target').click();
      const disabledImmediately = byId('save-output').disabled;
      await waitFor(() => status().includes('目标载入失败'), '无效目标载入');
      const disabledAfterFailure = byId('save-output').disabled;
      byId('open-target').click();
      const disabledDuringValidLoad = byId('save-output').disabled;
      await waitFor(() => byId('target-name').textContent === 'replacement.json' && status().includes('素材已载入'), '有效目标重选');
      return { disabledImmediately, disabledAfterFailure, disabledDuringValidLoad, disabledAfterValidLoad: byId('save-output').disabled, status: status() };
    }
    byId('save-output').click();
    await waitFor(() => status().includes('完整副本已保存'), '完整副本保存');
    return {
      sourceLoaded: byId('source-name').textContent,
      targetLoaded: byId('target-name').textContent,
      modelReady: byId('source-model-canvas').parentElement.classList.contains('model-ready'),
      targetPreviewReady: !/不可用|失败/.test(byId('target-caption').textContent),
      restoredYaw: byId('yaw').value,
      stepped,
      liveFeedback,
      generated: byId('stage-state').textContent,
      saved: status(),
    };
  })()`);
}

module.exports = { runFlow };
