/*
 * The home page "drunkcoding" logo as an ascii.rest piece: the big-text
 * letters in one orange, each letter swaying out of step by at most one row,
 * and 8 dots on the letters' middle row lit in a random colour, a new set
 * four times a second. Frame 0 is the still logo: level letters, no dots.
 */
import type { Env, Meta } from "ascii.rest";
import bigText, { meta as bigMeta } from "ascii.rest/pieces/big-text";

// Orange, then six dot colours: for a light page, then for a dark one.
const LIGHT = [
  "#d9480f",
  "#006cac",
  "#2b8a3e",
  "#5f3dc4",
  "#c2255c",
  "#0b7285",
  "#e67700",
];
const DARK = [
  "#ff6b01",
  "#74c0fc",
  "#69db7c",
  "#b197fc",
  "#f783ac",
  "#3bc9db",
  "#ffd43b",
];

const DOTS = 8;
// The letters fill rows 1 to 5 at rest.
const MIDDLE = 3;

type Options = { text: string };

export const meta: Meta<Options> = {
  name: "drunkcoding logo",
  category: "type",
  note: "the drunkcoding banner in orange, swaying, with coloured dots",
  cols: bigMeta.cols,
  rows: bigMeta.rows,
  fps: 12,
  options: { text: "drunkcoding" },
  palette: [...LIGHT, ...DARK],
};

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function asciiLogo({
  text = "drunkcoding",
}: Partial<Options> = {}) {
  const { cols, rows } = meta;
  // The big-text letters at rest, all solid ink (its glint is out of sight at t = 0).
  const lines = bigText({ text })(0, { paper: true }).split("\n");
  const at = (r: number, c: number) => lines[r][c];
  const inkCol = (c: number) => lines.some(l => l[c] === "█");

  // Each letter's column span, its shadow included up to the next letter.
  const spans: [number, number][] = [];
  for (let c = 0; c < cols; c++) {
    if (inkCol(c) && (c === 0 || !inkCol(c - 1))) spans.push([c, c]);
    if (spans.length) spans[spans.length - 1][1] = c;
  }
  for (let i = 0; i < spans.length - 1; i++) spans[i][1] = spans[i + 1][0] - 1;

  const pool: number[] = [];
  for (let c = 0; c < cols; c++)
    if (at(MIDDLE, c) === "█") pool.push(MIDDLE * cols + c);
  if (pool.length < DOTS)
    throw new Error(
      `asciiLogo: "${text}" has ${pool.length} dot cells, needs ${DOTS}`
    );

  return (t: number, env: Env = {}) => {
    const base = env.paper === false ? LIGHT.length : 0;
    // A seeded draw of DOTS distinct cells (partial Fisher-Yates), so a step is the same every time.
    const step = Math.floor(t * 4);
    const lit = new Map<number, number>();
    if (step > 0) {
      const rand = mulberry32(step * 7919 + 17);
      const cells = [...pool];
      for (let k = 0; k < DOTS; k++) {
        const j = k + Math.floor(rand() * (cells.length - k));
        [cells[k], cells[j]] = [cells[j], cells[k]];
        lit.set(cells[k], 1 + Math.floor(rand() * (LIGHT.length - 1)));
      }
    }

    const out = Array.from({ length: rows }, () => new Array(cols).fill(" "));
    spans.forEach(([a, b], i) => {
      const dy = Math.round(Math.sin(t * 2.2 - i * 0.9) * Math.min(1, t) * 1.2);
      for (let r = 0; r < rows; r++) {
        const to = r + dy;
        if (to < 0 || to >= rows) continue;
        for (let c = a; c <= b; c++) {
          const g = at(r, c);
          if (g === " ") continue;
          out[to][c] = g;
          if (env.color)
            env.color[to * cols + c] = base + (lit.get(r * cols + c) ?? 0);
        }
      }
    });
    return out.map(l => l.join("")).join("\n");
  };
}
