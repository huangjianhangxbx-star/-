type ProofCheck = { spec: unknown; prompt: string; referenceCount: number };
type ProofResult = { path: string; sha256: string; entries: number | string[] };
declare global {
  interface Window { assetWorkshop: {
    info(): Promise<{name: string; version: string; userData: string; outputDirectory: string}>;
    check(): Promise<ProofCheck>; exportProof(): Promise<ProofResult>;
  }; }
}
const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const check = get<HTMLButtonElement>('check');
const exportButton = get<HTMLButtonElement>('export');
const status = get<HTMLParagraphElement>('status');
let ready = false;
async function inspect() {
  check.disabled = exportButton.disabled = true;
  status.textContent = '正在核对规范、参考图与任务文本…';
  try {
    const result = await window.assetWorkshop.check();
    get('spec').textContent = JSON.stringify(result.spec, null, 2);
    get('prompt').textContent = result.prompt;
    ready = true;
    status.textContent = `检查通过：${result.referenceCount} 张参考图，任务说明已准备。尚未生成目标图片。`;
    status.dataset.state = 'ready';
  } catch (error) {
    ready = false; status.textContent = `检查失败：${(error as Error).message}`; status.dataset.state = 'error';
  } finally { check.disabled = false; exportButton.disabled = !ready; }
}
check.addEventListener('click', () => { void inspect(); });
exportButton.addEventListener('click', async () => {
  check.disabled = exportButton.disabled = true;
  status.textContent = '正在生成并重新校验 ZIP…';
  try {
    const result = await window.assetWorkshop.exportProof();
    status.textContent = `任务 ZIP 已校验并保存：${result.path}\nSHA256：${result.sha256}`;
    status.dataset.state = 'exported';
  } catch (error) {
    status.textContent = `未导出：${(error as Error).message}`; status.dataset.state = 'error';
  } finally { check.disabled = false; exportButton.disabled = !ready; }
});
void window.assetWorkshop.info().then(info => {
  get('identity').textContent = `${info.name} ${info.version} · 离线运行`;
}).catch(error => { status.textContent = `启动检查失败：${error.message}`; });
void inspect();
export {};
