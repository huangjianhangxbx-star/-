export function hsvToHex(h: number, s: number, v: number): string {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  const rgb = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${rgb.map((n) => Math.round((n + m) * 255).toString(16).padStart(2, "0")).join("")}`;
}
export function hexToHsv(hex: string): [number, number, number] {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("请输入六位 HEX 颜色");
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [((h * 60) + 360) % 360, max === 0 ? 0 : d / max, max];
}

export function bindColorWheel(canvas: HTMLCanvasElement, initial: string, changed: (hex: string) => void) {
  const ctx = canvas.getContext("2d")!;
  let [h, s, v] = hexToHsv(initial);
  const center = 92, square = { x: 43, y: 43, size: 98 };
  function render() {
    ctx.clearRect(0, 0, 184, 184);
    for (let i = 0; i < 360; i++) {
      ctx.beginPath(); ctx.strokeStyle = hsvToHex(i, 1, 1); ctx.lineWidth = 17;
      ctx.arc(center, center, 77, (i - 1) * Math.PI / 180, (i + 1.2) * Math.PI / 180); ctx.stroke();
    }
    ctx.fillStyle = hsvToHex(h, 1, 1); ctx.fillRect(square.x, square.y, square.size, square.size);
    const white = ctx.createLinearGradient(square.x, 0, square.x + square.size, 0);
    white.addColorStop(0, "#fff"); white.addColorStop(1, "#ffffff00");
    ctx.fillStyle = white; ctx.fillRect(square.x, square.y, square.size, square.size);
    const black = ctx.createLinearGradient(0, square.y, 0, square.y + square.size);
    black.addColorStop(0, "#00000000"); black.addColorStop(1, "#000");
    ctx.fillStyle = black; ctx.fillRect(square.x, square.y, square.size, square.size);
    const angle = h * Math.PI / 180;
    ctx.beginPath(); ctx.arc(center + Math.cos(angle) * 77, center + Math.sin(angle) * 77, 5, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.beginPath(); ctx.arc(square.x + s * square.size, square.y + (1 - v) * square.size, 5, 0, Math.PI * 2);
    ctx.strokeStyle = v < 0.5 ? "#fff" : "#222"; ctx.stroke();
  }
  function pick(e: PointerEvent) {
    const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * 184 / r.width, y = (e.clientY - r.top) * 184 / r.height;
    const distance = Math.hypot(x - center, y - center);
    if (distance >= 65 && distance <= 89) h = ((Math.atan2(y - center, x - center) * 180 / Math.PI) + 360) % 360;
    else if (x >= square.x && x <= square.x + square.size && y >= square.y && y <= square.y + square.size) {
      s = (x - square.x) / square.size; v = 1 - (y - square.y) / square.size;
    } else return;
    render(); changed(hsvToHex(h, s, v));
  }
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pick(e); });
  canvas.addEventListener("pointermove", (e) => { if (e.buttons) pick(e); });
  render();
  return { set(hex: string) { [h, s, v] = hexToHsv(hex); render(); } };
}
