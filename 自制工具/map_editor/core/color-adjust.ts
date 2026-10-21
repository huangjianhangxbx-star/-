export function adjustColor(
  hex: string,
  brightness: number,
  contrast: number,
  saturation: number,
  hue = 0,
) {
  let rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(...rgb),
    min = Math.min(...rgb),
    delta = max - min;
  if (delta && hue) {
    let h =
      max === rgb[0]
        ? (rgb[1] - rgb[2]) / delta
        : max === rgb[1]
          ? (rgb[2] - rgb[0]) / delta + 2
          : (rgb[0] - rgb[1]) / delta + 4;
    h = (((h + hue / 60) % 6) + 6) % 6;
    const x = delta * (1 - Math.abs((h % 2) - 1));
    rgb = (
      h < 1
        ? [delta, x, 0]
        : h < 2
          ? [x, delta, 0]
          : h < 3
            ? [0, delta, x]
            : h < 4
              ? [0, x, delta]
              : h < 5
                ? [x, 0, delta]
                : [delta, 0, x]
    ).map((v) => v + min);
  }
  const gray = rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  return (
    "#" +
    rgb
      .map((v) => {
        v = gray + (v - gray) * (1 + saturation / 100);
        v = (v - 0.5) * (1 + contrast / 100) + 0.5 + brightness / 100;
        return Math.round(Math.max(0, Math.min(1, v)) * 255)
          .toString(16)
          .padStart(2, "0");
      })
      .join("")
  );
}
