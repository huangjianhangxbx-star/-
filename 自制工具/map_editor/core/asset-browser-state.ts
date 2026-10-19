export type BrowserPane = {
  id: string;
  folder: string;
  back: string[];
  forward: string[];
  query: string;
  zoom: number;
  selected: string;
};
export type BrowserLayout = { panes: BrowserPane[]; active: string; split: 'right' | 'down' };
export const newPane = (id: string, folder = ''): BrowserPane =>
  ({ id, folder, back: [], forward: [], query: '', zoom: 128, selected: '' });
export const newLayout = (): BrowserLayout => ({ panes: [newPane('pane-1')], active: 'pane-1', split: 'right' });
export function navigate(pane: BrowserPane, folder: string): BrowserPane {
  if (folder === pane.folder) return pane;
  return { ...pane, folder, back: [...pane.back, pane.folder].slice(-40), forward: [], selected: '' };
}
export function travel(pane: BrowserPane, direction: 'back' | 'forward'): BrowserPane {
  const source = pane[direction];
  if (!source.length) return pane;
  const folder = source[source.length - 1];
  return { ...pane, folder, [direction]: source.slice(0, -1),
    [direction === 'back' ? 'forward' : 'back']:
      [...pane[direction === 'back' ? 'forward' : 'back'], pane.folder].slice(-40), selected: '' };
}
export function addPane(layout: BrowserLayout, sourceId: string, split: 'right' | 'down', duplicate: boolean): BrowserLayout {
  if (layout.panes.length >= 4) return layout;
  const index = layout.panes.findIndex((pane) => pane.id === sourceId);
  if (index < 0) return layout;
  const source = layout.panes[index];
  const pane = duplicate ? { ...structuredClone(source), id: crypto.randomUUID() }
    : newPane(crypto.randomUUID(), source.folder);
  const panes = [...layout.panes]; panes.splice(index + 1, 0, pane);
  return { panes, active: pane.id, split };
}
export function closePane(layout: BrowserLayout, id: string): BrowserLayout {
  if (layout.panes.length <= 1) return layout;
  const panes = layout.panes.filter((pane) => pane.id !== id);
  return { ...layout, panes, active: layout.active === id ? panes[0].id : layout.active };
}
export function restoreLayout(value: unknown): BrowserLayout {
  if (!value || typeof value !== 'object') return newLayout();
  const input = value as Partial<BrowserLayout>;
  if (!Array.isArray(input.panes) || !input.panes.length || input.panes.length > 4) return newLayout();
  const panes = input.panes.map((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.folder !== 'string' ||
        item.folder.startsWith('/') || item.folder.split('/').some((part) => part === '..' || part === '.'))
      return null;
    return { ...newPane(item.id), folder: item.folder,
      back: Array.isArray(item.back) ? item.back.filter((x): x is string => typeof x === 'string').slice(-40) : [],
      forward: Array.isArray(item.forward) ? item.forward.filter((x): x is string => typeof x === 'string').slice(-40) : [],
      query: typeof item.query === 'string' ? item.query.slice(0, 200) : '',
      zoom: Number.isFinite(item.zoom) ? Math.max(48, Math.min(220, item.zoom)) : 128,
      selected: typeof item.selected === 'string' ? item.selected : '' };
  });
  if (panes.some((pane) => !pane) || new Set(panes.map((pane) => pane!.id)).size !== panes.length)
    return newLayout();
  return { panes: panes as BrowserPane[],
    active: panes.some((pane) => pane!.id === input.active) ? input.active! : panes[0]!.id,
    split: input.split === 'down' ? 'down' : 'right' };
}
