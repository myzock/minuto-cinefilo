// Genera capsulas/<id>/index.html, sitemap.xml y robots.txt desde capsulas.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const { site, capsulas } = JSON.parse(readFileSync("capsulas.json", "utf8"));
const index = readFileSync("index.html", "utf8");
const css = index.match(/<style>([\s\S]*?)<\/style>/)[1];
const fonts = index.match(/<link href="https:\/\/fonts\.googleapis[^>]*>/)[0];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = iso => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
const reales = capsulas.filter(c => !c.demo);
const urls = [site.url];

for (const c of reales) {
  const pageUrl = `${site.url}capsulas/${c.id}/`;
  urls.push(pageUrl);
  const audio = c.audio ? (/^https?:/.test(c.audio) ? c.audio : "../../" + c.audio) : "";
  const img = c.poster || site.url + "og.png";
  let trans = "";
  if (c.transcript && existsSync(c.transcript)) {
    const paras = readFileSync(c.transcript, "utf8").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    trans = `<section id="transcripcion" style="padding-block:48px 0"><p class="label">Transcripción</p>${paras.map(p => `<p class="trans">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}</section>`;
  }
  const t = encodeURIComponent(`Escuchá «${c.film}» en Minuto Cinéfilo`), u = encodeURIComponent(pageUrl);
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.film)} — ${esc(c.title)} | Minuto Cinéfilo</title>
<meta name="description" content="${esc(c.description)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(c.film)} — Minuto Cinéfilo">
<meta property="og:description" content="${esc(c.description)}"><meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${esc(img)}"><meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image"><meta name="color-scheme" content="dark">
<link rel="icon" href="../../favicon.svg">${fonts}
<style>${css}
.back{display:inline-block;margin-bottom:40px;font-size:14px;color:var(--mute)}
.cap audio{width:100%;margin-top:8px}.trans{max-width:60ch;margin-bottom:1.2em;color:#d6d1c7}
</style></head><body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header><div class="wrap"><a class="logo" href="../../">MINUTO CINÉFILO</a>
<nav aria-label="Principal"><a href="../../#capsulas">Cápsulas</a><a href="../../#sobre">Sobre el proyecto</a><a href="${esc(site.radioUrl)}" target="_blank" rel="noopener">Radio Monk</a><a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></nav></div></header>
<main id="contenido"><div class="wrap cap" style="padding-block:clamp(48px,8vw,112px)">
<a class="back" href="../../#capsulas">← Todas las cápsulas</a>
<div class="latest" style="margin-top:0"><div class="poster">${c.poster ? `<img src="${esc(c.poster)}" alt="Póster de ${esc(c.film)}">` : "<span>Póster no disponible</span>"}</div>
<div><h1 class="film" style="font-size:clamp(30px,4vw,52px)">${esc(c.film)}</h1>
<div class="meta"><span>${esc(c.title)}</span><time datetime="${esc(c.date)}">${fecha(c.date)}</time><span>${esc(c.duration)} min</span></div>
<p class="desc">${esc(c.description)}</p>
${audio ? `<audio controls controlsList="nodownload noplaybackrate" oncontextmenu="return false" preload="none" src="${esc(audio)}"></audio>` : '<p class="note">El audio de esta cápsula todavía no está disponible.</p>'}
<div class="share"><span>Compartir</span><a href="https://wa.me/?text=${t}%20${u}" target="_blank" rel="noopener">WhatsApp</a><a href="https://t.me/share/url?url=${u}&text=${t}" target="_blank" rel="noopener">Telegram</a><a href="https://twitter.com/intent/tweet?text=${t}&url=${u}" target="_blank" rel="noopener">X</a><a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a></div>
${c.transcript && trans ? '<p class="links"><a href="#transcripcion">Leer la transcripción</a></p>' : ""}
</div></div>${trans}</div></main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Minuto Cinéfilo</span><em>${esc(site.footerPhrase)}</em></div>
<div class="wrap tmdb"><img src="../../tmdb-logo.svg" alt="TMDB" height="12"><span>Este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.</span></div></footer>
</body></html>`;
  mkdirSync(`capsulas/${c.id}`, { recursive: true });
  writeFileSync(`capsulas/${c.id}/index.html`, html);
}
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
writeFileSync("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}sitemap.xml\n`);
console.log(`OK: ${reales.length} página(s) generadas`);
