(() => {
  'use strict';
  const colors = { body: '#7894a3', end: '#4c687b', corner: '#4e827a', shoulder: '#a7baad', lock: '#633e59', path: '#b77a32', paper: '#f2f5f1' };
  const cases = {
    straight: { name: '直线', paths: [[[15, 40], [85, 40]]], extension: [[85, 40], [85, 18]], corners: [], junctions: [], lock: [30, 40], note: '直段延长后，原来的末端要变成中段，并为新末端安排收口。仅在原件末尾再放一件不会自动完成这一步。' },
    corner: { name: '转弯', paths: [[[17, 59], [52, 59], [52, 22]]], extension: [[52, 22], [81, 22]], corners: [[52, 59]], junctions: [], lock: [29, 59], note: '转弯的位置先成为连接关系，再选适用的内外角或接合形式。两条直段的相交并不等于一个完成的转角。' },
    junction: { name: '交汇', paths: [[[15, 42], [85, 42]], [[51, 42], [51, 15]]], extension: [[51, 15], [79, 15]], corners: [], junctions: [[51, 42]], lock: [28, 42], note: '第二段接上主体时，交汇处与附近原件需要一起重组。周围已经锁定的手修不能被顺带覆盖。' }
  };
  const steps = [
    { title: '记录结构意图', copy: '记录你画到哪里、想要多宽、多高，以及这一笔是在增加还是削减。首次命中确定参考表面，后续候选预览不能成为不断垫高的新落点。', caption: '笔画表达结构意图，不直接等于一串模型变换。' },
    { title: '形成目标轮廓', copy: '先把笔画覆盖区域组织成连续形体，合并重复覆盖的部分，再确定顶部、侧面和高度带。局部加粗或瘦身修改的是这一段形体。', caption: '先得到希望存在的形体，再决定用什么构件表达。' },
    { title: '识别相邻关系', copy: '根据连通、方向、高低和支撑关系，找出主体、端部、转角、肩部与交汇。这些职责决定各位置应该使用什么类型的原料。', caption: '颜色只表示职责：主体、中段、端部、转角与过渡。' },
    { title: '安排适配素材', copy: '从同一雪岩风格套件里选择适合职责的构件，使用经过认证的朝向、重复中段和连接带。保留主要外观面；缺少合适连接时，明确指出缺口。', caption: '示意职责分配；尚未读取真实源模型进行布局求解。' },
    { title: '接合与局部更新', copy: '处理内部面、局部接合和雪岩暴露，再更新受影响的附近。新的连接可改变原端部角色；远处结构、手动锁和独立摆件保持。邻域更新不允许越过明示的增删范围任意改变体积；最终仍须实际检查几何、外观和性能。', caption: '同一段笔画形成协作结构，局部修改会带动必要的邻近连接。' }
  ];
  const state = { path: 'corner', step: 4, progress: 100, extend: false, protect: true };
  const $ = s => document.querySelector(s);
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  function linePoints(path, interval = 1.5) {
    const points = [path[0]];
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], count = Math.max(1, Math.ceil(distance(a, b) / interval));
      for (let n = 1; n <= count; n++) points.push([a[0] + (b[0] - a[0]) * n / count, a[1] + (b[1] - a[1]) * n / count]);
    }
    return points;
  }
  function partialPaths(paths, ratio) {
    const samples = paths.map(p => linePoints(p));
    const total = samples.reduce((sum, p) => sum + p.length, 0), limit = Math.max(2, Math.ceil(total * ratio));
    let left = limit;
    return samples.map(p => { const part = p.slice(0, left); left = Math.max(0, left - p.length); return part; }).filter(p => p.length > 1);
  }
  function pointsAttribute(points) { return points.map(p => p.map(x => x.toFixed(2)).join(',')).join(' '); }
  function near(point, points, radius) { return points.some(p => distance(point, p) <= radius); }
  function nearestDistance(point, paths) { let d = Infinity; for (const path of paths) for (const sample of path) d = Math.min(d, distance(point, sample)); return d; }
  function activeTurns(current, paths) {
    const candidates = current.corners.concat(current.junctions).concat(state.extend ? [current.extension[0]] : []);
    return candidates.filter(p => {
      const directions = [[-1,0],[1,0],[0,-1],[0,1]].map(d => nearestDistance([p[0] + d[0] * 5, p[1] + d[1] * 5], paths) < 1.4);
      return (directions[0] || directions[1]) && (directions[2] || directions[3]);
    });
  }
  function baseMarkup() {
    let grid = '';
    for (let x = 5; x < 100; x += 5) grid += `<line x1="${x}" y1="12" x2="${x}" y2="74"/>`;
    for (let y = 14; y < 78; y += 5) grid += `<line x1="5" y1="${y}" x2="95" y2="${y}"/>`;
    return `<g stroke="#dbe5e2" stroke-width=".22">${grid}</g><text x="5" y="8" fill="#6b8389" font-family="Microsoft YaHei,sans-serif" font-size="3.3">俯视结构示意 · 无真实米制比例</text>`;
  }
  function inputMarkup(paths, changed, opacity = 1) {
    return `<g opacity="${opacity}">${paths.map(p => `<polyline points="${pointsAttribute(p)}" fill="none" stroke="${colors.path}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}${changed.map(p => `<polyline points="${pointsAttribute(p)}" fill="none" stroke="${colors.path}" stroke-width="1.15" stroke-dasharray="1.5 1"/>`).join('')}</g>`;
  }
  function oldMarkup(paths) {
    let pieces = '';
    for (const path of paths) {
      let accumulated = 0, last = null;
      for (const p of path) {
        accumulated += last ? distance(p, last) : 0; last = p;
        if (accumulated < 10 && p !== path[0]) continue;
        accumulated = 0;
        pieces += `<g transform="translate(${p[0] - 4},${p[1] - 5})"><rect x="0" y="1.8" width="8" height="8.2" fill="${colors.body}" stroke="#f2f5f1" stroke-width=".65"/><path d="M0,1.8 L5,1.8 L5,0 L8,0 L8,3.5 L0,3.5Z" fill="#f8fbf1"/><rect x=".9" y="6.4" width="3.8" height="3.6" fill="${colors.end}"/><path d="M.9,6.4H4.7" stroke="#f8fbf1" stroke-width=".7"/></g>`;
      }
    }
    return pieces;
  }
  function occupiedCells(paths, current) {
    const cells = [], endPoints = paths.flatMap(p => [p[0], p[p.length - 1]]), corners = activeTurns(current, paths);
    for (let y = 14; y < 73; y += 4) for (let x = 7; x < 94; x += 4) {
      const center = [x + 2, y + 2], d = nearestDistance(center, paths);
      if (d > 6) continue;
      let role = 'body';
      if (near(center, endPoints, 6.5)) role = 'end';
      if (near(center, corners, 7.3)) role = 'corner';
      if (role === 'body' && d > 3.3) role = 'shoulder';
      const protectedCell = state.protect && distance(center, current.lock) < 4.9;
      cells.push({ x, y, role, protectedCell });
    }
    return cells;
  }
  function newMarkup(paths, changed, current) {
    let markup = '';
    if (state.step === 0) return inputMarkup(paths, changed);
    if (state.extend && changed.length) markup += `<g opacity=".32">${changed.map(p => `<polyline points="${pointsAttribute(p)}" fill="none" stroke="#e2b676" stroke-width="24" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}</g>`;
    markup += paths.map(p => `<polyline points="${pointsAttribute(p)}" fill="none" stroke="#b4c7c7" stroke-width="13.5" stroke-linejoin="round" stroke-linecap="square"/>`).join('');
    if (state.step === 1) return markup + inputMarkup(paths, changed, .8);
    const cells = occupiedCells(paths, current);
    if (state.step === 4) markup += paths.map(p => `<polyline points="${pointsAttribute(p)}" fill="none" stroke="${colors.body}" stroke-width="12" stroke-linejoin="round" stroke-linecap="square"/>`).join('');
    for (const c of cells) {
      const fill = c.protectedCell ? colors.lock : colors[c.role];
      const border = state.step === 2 ? '#eff4ef' : state.step === 3 ? '#d9e4df' : 'none';
      markup += `<rect x="${c.x}" y="${c.y}" width="4.06" height="4.06" fill="${fill}" stroke="${border}" stroke-width=".2"/>`;
      if (state.step === 3 && c.role !== 'body') markup += `<path d="M${c.x + .4},${c.y + .6}h3.2" stroke="#f7f9ee" stroke-width=".6"/>`;
    }
    if (state.step >= 3) {
      const availableCorners = activeTurns(current, paths);
      for (const p of availableCorners) markup += `<path d="M${p[0] - 2.5},${p[1] + 2.5}v-5h5" fill="none" stroke="#e5f1e8" stroke-width=".8"/>`;
    }
    if (state.protect && near(current.lock, paths.flat(), 2.7)) markup += `<g transform="translate(${current.lock[0]},${current.lock[1]})"><circle r="3.2" fill="${colors.lock}" stroke="#fafbf3" stroke-width=".5"/><path d="M-1.1,-.3v-1a1.1,1.1 0 0 1 2.2,0v1M-1.6,-.3h3.2v2.3h-3.2Z" fill="none" stroke="#fafbf3" stroke-width=".38"/></g>`;
    if (state.extend && changed.length && state.step >= 2) {
      const changedPoints = changed.flat(), x0 = Math.max(4, Math.min(...changedPoints.map(p => p[0])) - 10), x1 = Math.min(96, Math.max(...changedPoints.map(p => p[0])) + 10), y0 = Math.max(11, Math.min(...changedPoints.map(p => p[1])) - 10), y1 = Math.min(75, Math.max(...changedPoints.map(p => p[1])) + 10);
      markup += `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" fill="none" stroke="${colors.path}" stroke-width=".8" stroke-dasharray="1.4 1.5" class="halo-boundary"/>`;
    }
    if (state.step === 2) markup += inputMarkup(paths, [], .5);
    return markup;
  }
  function render() {
    const current = cases[state.path], paths = partialPaths(current.paths, state.progress / 100);
    let changed = [];
    if (state.extend && state.progress > 70) changed = partialPaths([current.extension], (state.progress - 70) / 30);
    const combined = paths.concat(changed);
    $('#old-view').innerHTML = baseMarkup() + inputMarkup(paths, changed, .35) + oldMarkup(combined);
    $('#new-view').innerHTML = baseMarkup() + newMarkup(combined, changed, current);
    $('#new-view').setAttribute('aria-label', `${current.name}路径，第${state.step + 1}步${steps[state.step].title}。${state.extend ? '补画时，赭金区域表示附近需要重新组织。' : ''}`);
    const text = (selector, value) => { if ($(selector).textContent !== value) $(selector).textContent = value; };
    text('#new-title', steps[state.step].title);
    text('#new-caption', steps[state.step].caption);
    $('#progress-number').value = `${state.progress}%`;
    text('#step-count', `步骤 ${state.step + 1} / 5`);
    text('#step-title', steps[state.step].title);
    text('#step-copy', steps[state.step].copy);
    text('#case-copy', current.note + (state.extend ? ' 赭金带是本次重组示意范围，实际范围还要由连通关系、最大构件包络和接合带确定。' : ''));
    document.querySelectorAll('[data-path]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.path === state.path)));
    document.querySelectorAll('[data-step]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.step) === state.step)));
    document.body.dataset.diagramState = `${state.path}:${state.step}:${state.progress}:${state.extend}:${state.protect}`;
  }
  document.querySelectorAll('[data-path]').forEach(button => button.addEventListener('click', () => { state.path = button.dataset.path; render(); }));
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', () => { state.step = Number(button.dataset.step); render(); }));
  $('#progress').addEventListener('input', e => { state.progress = Number(e.target.value); render(); });
  $('#extend').addEventListener('change', e => { state.extend = e.target.checked; render(); });
  $('#protect').addEventListener('change', e => { state.protect = e.target.checked; render(); });
  render();
})();
