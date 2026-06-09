/** Stable hue derived from a system or core name. Gives each game a consistent
 *  fallback gradient when no thumbnail is cached, without needing a lookup table. */
export function systemHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 360;
}

/** Linear-gradient `background` value derived from a system or core name. */
export function systemFallbackBackground(name: string): string {
  const hue = systemHue(name);
  return `linear-gradient(135deg, hsl(${hue}, 60%, 28%) 0%, hsl(${(hue + 30) % 360}, 55%, 12%) 100%)`;
}
