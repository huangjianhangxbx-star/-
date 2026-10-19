import { addPane, closePane, navigate, newLayout, restoreLayout, travel,
  type BrowserLayout, type BrowserPane } from '../core/asset-browser-state.ts';

export type ProjectEntry = { kind: 'directory' | 'asset' | 'file' | 'link';
  name: string; path: string; assetId?: string; readOnly?: boolean };
export type BrowserProvider = {
  list: (folder: string) => Promise<ProjectEntry[]>;
  preview: (id: string) => HTMLElement | null;
  open: (id: string) => void;
  context: (event: MouseEvent, id: string) => void;
};
const element = (tag: string, text?: string) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};
const icon = (kind: ProjectEntry['kind']) => {
  const img = document.createElement('img');
  img.className = 'project-browser-icon';
  img.src = `icons/${kind}.svg`; img.alt = '';
  return img;
};
export class ProjectAssetBrowser {
  private layout: BrowserLayout;
  private cache = new Map<string, ProjectEntry[]>();
  private loading = new Set<string>();
  private expanded = new Set<string>(['']);
  private host: HTMLElement | null = null;
  private provider: BrowserProvider;
  constructor(private key: string, provider: BrowserProvider) {
    this.provider = provider;
    try { this.layout = restoreLayout(JSON.parse(localStorage.getItem(key) || 'null')); }
    catch { this.layout = newLayout(); }
  }
  mount(host: HTMLElement, provider?: BrowserProvider) {
    this.host = host;
    if (provider) this.provider = provider;
    this.render();
  }
  refresh() {
    this.cache.clear();
    this.render();
  }
  activeFolder() {
    return this.layout.panes.find((pane) => pane.id === this.layout.active)?.folder ?? '';
  }
  private save() {
    localStorage.setItem(this.key, JSON.stringify(this.layout));
    this.render();
  }
  private entries(folder: string): ProjectEntry[] | null {
    if (!this.cache.has(folder) && !this.loading.has(folder)) {
      this.loading.add(folder);
      void this.provider.list(folder).then((rows) => {
        this.cache.set(folder, rows);
      }).catch((error) => {
        this.cache.set(folder, []);
        const status = this.host?.querySelector<HTMLElement>('.project-browser-status');
        if (status) status.textContent = `读取目录失败：${error.message}`;
      }).finally(() => { this.loading.delete(folder); this.render(); });
    }
    return this.cache.get(folder) ?? null;
  }
  private open(pane: BrowserPane, folder: string) {
    Object.assign(pane, navigate(pane, folder));
    this.expanded.add(folder);
    this.layout.active = pane.id;
    this.save();
  }
  private tabMenu(event: MouseEvent, pane: BrowserPane) {
    event.preventDefault();
    const old = document.querySelector('.project-browser-tab-menu'); old?.remove();
    const menu = element('div'); menu.className = 'project-browser-tab-menu';
    const action = (label: string, fn: () => void) => {
      const button = element('button', label); button.onclick = () => { menu.remove(); fn(); };
      menu.append(button);
    };
    action('新建资源画布', () => { this.layout = addPane(this.layout, pane.id, this.layout.split, false); this.save(); });
    action('复制此画布', () => { this.layout = addPane(this.layout, pane.id, this.layout.split, true); this.save(); });
    action('向右分屏', () => { this.layout = addPane(this.layout, pane.id, 'right', true); this.save(); });
    action('向下分屏', () => { this.layout = addPane(this.layout, pane.id, 'down', true); this.save(); });
    action('关闭画布', () => { this.layout = closePane(this.layout, pane.id); this.save(); });
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 160)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - 180)}px`;
    document.body.append(menu);
    const dismiss = (e: PointerEvent) => {
      if (!menu.contains(e.target as Node)) { menu.remove(); document.removeEventListener('pointerdown', dismiss, true); }
    };
    setTimeout(() => document.addEventListener('pointerdown', dismiss, true), 0);
  }
  private tree(pane: BrowserPane, parent: HTMLElement, folder: string, depth: number) {
    if (depth > 12) return;
    const rows = this.entries(folder);
    if (!rows) { parent.append(element('small', '读取中…')); return; }
    for (const row of rows) {
      const item = element('button'); item.className = 'project-browser-tree-item';
      item.style.paddingLeft = `${8 + depth * 13}px`;
      item.append(icon(row.kind), element('span', row.name));
      item.title = row.path + (row.readOnly ? ' · 只读' : '');
      item.dataset.path = row.path;
      const isFolder = row.kind === 'directory' || row.kind === 'asset';
      item.classList.toggle('active', pane.folder === row.path);
      item.onclick = () => {
        if (isFolder) this.open(pane, row.path);
        else { pane.selected = row.path; this.save(); }
      };
      if (row.kind === 'asset' && row.assetId) {
        item.ondblclick = () => this.provider.open(row.assetId!);
        item.oncontextmenu = (e) => this.provider.context(e, row.assetId!);
      }
      parent.append(item);
      if (isFolder && this.expanded.has(row.path)) this.tree(pane, parent, row.path, depth + 1);
    }
  }
  private pane(pane: BrowserPane): HTMLElement {
    const host = element('section'); host.className = 'project-browser-pane';
    host.dataset.paneId = pane.id;
    const toolbar = element('div'); toolbar.className = 'project-browser-toolbar';
    const control = (label: string, callback: () => void) => {
      const button = element('button', label) as HTMLButtonElement;
      button.onclick = callback; toolbar.append(button); return button;
    };
    control('←', () => { Object.assign(pane, travel(pane, 'back')); this.save(); }).disabled = !pane.back.length;
    control('→', () => { Object.assign(pane, travel(pane, 'forward')); this.save(); }).disabled = !pane.forward.length;
    control('⌂', () => this.open(pane, ''));
    const crumbs = element('div'); crumbs.className = 'project-browser-crumbs';
    const parts = pane.folder ? pane.folder.split('/') : [];
    const crumb = (label: string, path: string) => {
      const button = element('button', label); button.onclick = () => this.open(pane, path); crumbs.append(button);
    };
    crumb('项目', ''); parts.forEach((part, index) => crumb(part, parts.slice(0, index + 1).join('/')));
    toolbar.append(crumbs);
    control('⟳', () => this.refresh()).title = '刷新目录';
    const search = document.createElement('input'); search.type = 'search'; search.placeholder = '搜索当前目录';
    search.setAttribute('aria-label', '搜索项目资产'); search.value = pane.query;
    search.oninput = () => { pane.query = search.value; localStorage.setItem(this.key, JSON.stringify(this.layout));
      this.renderContents(host, pane); };
    toolbar.append(search);
    host.append(toolbar);
    const body = element('div'); body.className = 'project-browser-body';
    const tree = element('nav'); tree.className = 'project-browser-tree';
    tree.setAttribute('aria-label', '项目目录树');
    const root = element('button', '▾  项目根目录'); root.className = 'project-browser-root';
    root.onclick = () => this.open(pane, ''); tree.append(root);
    this.tree(pane, tree, '', 0);
    const content = element('div'); content.className = 'project-browser-content';
    body.append(tree, content); host.append(body);
    this.renderContents(host, pane);
    host.addEventListener('wheel', (event) => {
      if (!event.altKey) return;
      event.preventDefault();
      pane.zoom = Math.max(48, Math.min(220, pane.zoom + (event.deltaY > 0 ? -16 : 16)));
      this.save();
    }, { passive: false });
    return host;
  }
  private renderContents(host: HTMLElement, pane: BrowserPane) {
    const content = host.querySelector<HTMLElement>('.project-browser-content');
    if (!content) return;
    content.replaceChildren();
    content.style.setProperty('--browser-card-size', `${pane.zoom}px`);
    const rows = this.entries(pane.folder);
    if (!rows) { content.append(element('p', '正在读取目录…')); return; }
    const filtered = rows.filter((row) => row.name.toLocaleLowerCase().includes(pane.query.toLocaleLowerCase()));
    for (const row of filtered) {
      const card = element('button') as HTMLButtonElement;
      card.className = 'project-browser-card'; card.dataset.path = row.path;
      card.classList.toggle('active', pane.selected === row.path);
      card.title = `${row.path}${row.readOnly ? ' · 只读' : ''}`;
      const preview = row.kind === 'asset' && row.assetId ? this.provider.preview(row.assetId) : null;
      const visual = element('span'); visual.className = 'project-browser-visual';
      visual.append(preview || icon(row.kind));
      card.append(visual, element('span', row.name));
      card.onclick = () => { pane.selected = row.path; this.layout.active = pane.id;
        for (const sibling of content.querySelectorAll('.project-browser-card')) sibling.classList.remove('active');
        card.classList.add('active'); localStorage.setItem(this.key, JSON.stringify(this.layout)); };
      card.ondblclick = () => {
        if (row.kind === 'asset' && row.assetId) this.provider.open(row.assetId);
        else if (row.kind === 'directory') this.open(pane, row.path);
      };
      if (row.kind === 'asset' && row.assetId) {
        card.draggable = true;
        card.ondragstart = (event) => {
          event.dataTransfer?.setData('application/x-xinghai-project-asset', row.assetId!);
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
        };
        card.oncontextmenu = (event) => this.provider.context(event, row.assetId!);
      }
      content.append(card);
    }
    if (!filtered.length) content.append(element('p', pane.query ? '没有匹配项' : '此目录为空'));
  }
  private render() {
    if (!this.host) return;
    this.host.replaceChildren(); this.host.classList.add('project-asset-browser');
    const tabs = element('div'); tabs.className = 'project-browser-tabs';
    for (const pane of this.layout.panes) {
      const tab = element('button', pane.folder.split('/').at(-1) || '项目');
      tab.className = 'project-browser-tab'; tab.classList.toggle('active', pane.id === this.layout.active);
      tab.setAttribute('aria-pressed', String(pane.id === this.layout.active));
      tab.oncontextmenu = (e) => this.tabMenu(e, pane);
      tab.onclick = () => { this.layout.active = pane.id; this.save(); };
      tabs.append(tab);
    }
    const plus = element('button', '+') as HTMLButtonElement; plus.title = '新建资源画布';
    plus.onclick = () => { this.layout = addPane(this.layout, this.layout.active, this.layout.split, false); this.save(); };
    plus.disabled = this.layout.panes.length >= 4; tabs.append(plus);
    this.host.append(tabs);
    const grid = element('div'); grid.className = `project-browser-panes split-${this.layout.split}`;
    grid.style.setProperty('--pane-count', String(this.layout.panes.length));
    for (const pane of this.layout.panes) grid.append(this.pane(pane));
    this.host.append(grid, element('div', '右键画布标签：复制、分屏或关闭 · Alt + 滚轮：缩放图标'));
    this.host.lastElementChild!.className = 'project-browser-status';
  }
}
