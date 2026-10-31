import { readFile } from 'node:fs/promises';
import { expect, it } from 'vitest';

function luminance(hex: string): number {
  const channels = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}
it('关键文字和说明变量在纸面上有可检查的对比度', async () => {
  const css = await readFile(new URL('./ark-experience.css', import.meta.url), 'utf8');
  const tokens = Object.fromEntries([...css.matchAll(/--ark-([\w-]+):\s*(#[a-f\d]{6})/g)].map(match => [match[1], match[2]!]));
  const ratio = (foreground: string, background: string) => {
    const light = luminance(tokens[foreground]!);
    const dark = luminance(tokens[background]!);
    return (Math.max(light, dark) + .05) / (Math.min(light, dark) + .05);
  };
  expect(ratio('ink', 'paper')).toBeGreaterThanOrEqual(7);
  expect(ratio('muted', 'paper')).toBeGreaterThanOrEqual(4.5);
  expect(ratio('warning', 'surface')).toBeGreaterThanOrEqual(4.5);
});
