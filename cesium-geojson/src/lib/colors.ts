import { Color } from "cesium";

/**
 * Parse CSS-like rgba()/hex strings into Cesium Color.
 * Accepts: 'rgba(r,g,b,a)', '#rrggbb', '#rgb', 'rgb(r,g,b)'
 */
export function parseCssColor(input: string | undefined, fallback: Color = Color.WHITE): Color {
  if (!input) return fallback;

  const trimmed = input.trim();

  // rgba(r,g,b,a)
  const rgbaMatch = trimmed.match(/^rgba?\s*\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgbaMatch) {
    const r = Math.min(255, Math.max(0, Number(rgbaMatch[1])));
    const g = Math.min(255, Math.max(0, Number(rgbaMatch[2])));
    const b = Math.min(255, Math.max(0, Number(rgbaMatch[3])));
    const a = rgbaMatch[4] !== undefined ? Math.min(1, Math.max(0, Number(rgbaMatch[4]))) : 1;
    return new Color(r / 255, g / 255, b / 255, a);
  }

  // hex #rrggbb or #rgb
  if (/^#([\da-f]{3}|[\da-f]{6})$/i.test(trimmed)) {
    return Color.fromCssColorString(trimmed);
  }

  // last resort: let Cesium try (named colors etc.)
  try {
    return Color.fromCssColorString(trimmed);
  } catch {
    return fallback;
  }
}
