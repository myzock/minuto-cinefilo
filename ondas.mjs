// Forma de onda y duración de cada audio local, con ffmpeg. Si no hay ffmpeg, la web usa la barra simple.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, statSync, mkdirSync } from "node:fs";
const N = 90, SR = 4000, ARCH = "data/ondas.json", V = 2; // V: versión del formato; si cambia, se recalcula todo
export function ondas(rutas) {
  const cache = existsSync(ARCH) ? JSON.parse(readFileSync(ARCH, "utf8")) : {};
  const out = {}; let cambio = false;
  const hay = spawnSync("ffmpeg", ["-version"]).status === 0;
  for (const r of rutas) {
    if (!existsSync(r)) continue;
    const size = statSync(r).size;
    if (cache[r]?.s === size && cache[r]?.v === V) { out[r] = cache[r]; continue; }
    if (!hay) continue;
    const p = spawnSync("ffmpeg", ["-v", "error", "-i", r, "-ac", "1", "-ar", String(SR), "-f", "s16le", "-"], { maxBuffer: 1 << 29 });
    if (p.status !== 0 || !p.stdout?.length) { console.log(`::warning::No se pudo calcular la onda de ${r}`); continue; }
    const b = p.stdout, n = Math.floor(b.length / 2), per = n / N, pk = [];
    for (let i = 0; i < N; i++) {
      let s = 0, k = 0;
      for (let j = Math.floor(i * per); j < Math.floor((i + 1) * per) && j < n; j++) { const v = b.readInt16LE(j * 2) / 32768; s += v * v; k++; }
      pk.push(k ? Math.sqrt(s / k) : 0);
    }
    const mx = Math.max(...pk, 1e-6);
    const fp = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", r]), dd = parseFloat(String(fp.stdout || "")); // duración del encabezado, la misma que lee el navegador; se trunca como la muestra el reproductor
    out[r] = { v: V, s: size, d: Math.floor(isFinite(dd) && dd > 0 ? dd : n / SR), p: pk.map(v => Math.max(8, Math.round(Math.pow(v / mx, 2.2) * 100))) };
    cache[r] = out[r]; cambio = true;
  }
  if (cambio) { mkdirSync("data", { recursive: true }); writeFileSync(ARCH, JSON.stringify(cache)); }
  return out;
}
