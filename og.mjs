// Tarjeta para compartir (1200x630) de cada episodio: fondo de la película oscurecido + marca + título.
import { execSync } from "node:child_process";

let sharpMod;
async function cargarSharp() {
  if (sharpMod !== undefined) return sharpMod;
  try { sharpMod = (await import("sharp")).default; }
  catch {
    try { execSync("npm install --no-save --no-audit --no-fund sharp", { stdio: "ignore" }); sharpMod = (await import("sharp")).default; }
    catch { sharpMod = null; }
  }
  return sharpMod;
}
const x = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function lineas(texto, max) {
  const out = []; let cur = "";
  for (const w of String(texto).split(/\s+/)) {
    if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) out.push(cur);
  return out;
}

// bgBuffer: Buffer con la imagen de fondo (o null). Devuelve un Buffer JPEG, o null si no hay sharp.
export async function tarjeta({ numero, title, bgBuffer }) {
  const sharp = await cargarSharp(); if (!sharp) return null;
  const W = 1200, H = 630;
  let fs = 74, max = 15, ls = lineas(title, max);
  if (ls.length > 3) { fs = 56; max = 21; ls = lineas(title, max); }
  if (ls.length > 3) { fs = 44; max = 27; ls = lineas(title, max).slice(0, 4); }
  const alto = fs * 1.12, y0 = 330 - ((ls.length - 1) * alto) / 2;
  const fuente = "Inter, 'DejaVu Sans', 'Liberation Sans', Arial, sans-serif";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
<defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#090c10" stop-opacity=".97"/><stop offset=".55" stop-color="#090c10" stop-opacity=".82"/><stop offset="1" stop-color="#090c10" stop-opacity=".25"/></linearGradient></defs>
<rect width="${W}" height="${H}" fill="url(#g)"/>
<g transform="translate(64,52)"><circle cx="22" cy="22" r="21" fill="#d93a32"/><circle cx="22" cy="22" r="3.5" fill="#090c10"/><g fill="#090c10"><circle cx="22" cy="10" r="4.4"/><circle cx="33.5" cy="18.2" r="4.4"/><circle cx="29.2" cy="32" r="4.4"/><circle cx="14.8" cy="32" r="4.4"/><circle cx="10.5" cy="18.2" r="4.4"/></g></g>
<text x="122" y="84" font-family="${fuente}" font-weight="800" font-size="30" fill="#f3f1ec" letter-spacing="1">MINUTO CINÉFILO</text>
<rect x="64" y="${y0 - fs - 40}" width="28" height="4" fill="#ef4d44"/>
<text x="104" y="${y0 - fs - 30}" font-family="${fuente}" font-weight="700" font-size="24" fill="#f3f1ec" letter-spacing="4">${numero ? "EPISODIO #" + x(numero) : "NUEVO EPISODIO"}</text>
${ls.map((l, i) => `<text x="64" y="${y0 + i * alto}" font-family="${fuente}" font-weight="800" font-size="${fs}" fill="#f3f1ec" letter-spacing="-1.5">${x(l)}</text>`).join("\n")}
<text x="64" y="574" font-family="${fuente}" font-weight="500" font-size="26" fill="#aeb6bf">Cápsulas de cine de 2 a 4 minutos · minutocinefilo.com.ar</text>
</svg>`;
  let base = sharp({ create: { width: W, height: H, channels: 3, background: "#0e1217" } }).jpeg().toBuffer();
  if (bgBuffer) { try { base = sharp(bgBuffer).resize(W, H, { fit: "cover", position: "attention" }).modulate({ brightness: 0.8 }).toBuffer(); } catch {} }
  return sharp(await base).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 84, mozjpeg: true }).toBuffer();
}
