// Genera capsulas/<id>/index.html, sitemap.xml y robots.txt desde capsulas.json
// Si existe la variable TMDB_KEY, trae la ficha de cada película y la guarda en data/tmdb/<id>.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const { site, capsulas } = JSON.parse(readFileSync("capsulas.json", "utf8"));
const index = readFileSync("index.html", "utf8");
const css = index.match(/<style>([\s\S]*?)<\/style>/)[1];
const fonts = index.match(/<link href="https:\/\/fonts\.googleapis[^>]*>/)[0];
const KEY = process.env.TMDB_KEY;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = iso => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
const hm = m => (m ? `${Math.floor(m / 60)} h ${m % 60} min` : "");

async function ficha(c) {
  let id = c.tmdb_id;
  try {
    if (KEY && !id) {
      const r = await (await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${KEY}&language=es-AR&query=${encodeURIComponent(c.film)}`)).json();
      id = r.results?.[0]?.id;
      if (id) console.log(`Aviso: "${c.film}" sin tmdb_id; se usó ${id}. Agregá "tmdb_id": ${id} al JSON para fijarlo.`);
    }
    if (!id) return null;
    const file = `data/tmdb/${id}.json`;
    if (KEY) {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${KEY}&language=es-AR&append_to_response=credits`);
      if (res.ok) {
        const j = await res.json(); // se guarda solo lo que la web muestra, con fecha de descarga
        const slim = { _fetched: new Date().toISOString(), title: j.title, original_title: j.original_title, release_date: j.release_date, runtime: j.runtime,
          genres: (j.genres || []).map(g => ({ name: g.name })), production_countries: (j.production_countries || []).map(p => ({ iso: p.iso_3166_1, name: p.name })),
          credits: { crew: (j.credits?.crew || []).filter(p => p.job === "Director").map(p => ({ job: p.job, name: p.name })), cast: (j.credits?.cast || []).slice(0, 4).map(p => ({ name: p.name })) } };
        mkdirSync("data/tmdb", { recursive: true }); writeFileSync(file, JSON.stringify(slim));
      }
      else console.log(`TMDB respondió ${res.status} para ${c.film}; se usa la copia guardada si existe.`);
    }
    if (!existsSync(file)) return null;
    const d = JSON.parse(readFileSync(file, "utf8"));
    const dias = (Date.now() - new Date(d._fetched || 0)) / 864e5;
    if (!(dias <= 150)) { console.log(`Ficha de "${c.film}" vencida (${Math.round(dias)} días, límite TMDB: 6 meses): no se muestra hasta renovarla con TMDB_KEY.`); return null; }
    return { id, ...d };
  } catch (e) { console.log("TMDB:", e.message); return null; }
}

function guion(path) {
  if (!path || !existsSync(path)) return { html: "", sync: false };
  const paras = readFileSync(path, "utf8").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  let sync = false;
  const html = paras.map(p => {
    const m = p.match(/^\[(\d+):(\d{2})\]\s*/);
    if (m) { sync = true; return `<p class="trans" data-t="${+m[1] * 60 + +m[2]}" tabindex="0" role="button">${esc(p.slice(m[0].length))}</p>`; }
    return `<p class="trans">${esc(p).replace(/\n/g, "<br>")}</p>`;
  }).join("");
  return { html, sync };
}

const pais = t => (t.production_countries || []).map(p => { try { return p.iso ? new Intl.DisplayNames(["es"], { type: "region" }).of(p.iso) : p.name; } catch { return p.name; } }).join(", ");
const ic = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = { film: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4"/>', lang: '<path d="M4 6h9M8.5 4v2M6 6c0 4 3 7 6.5 8M11 6c0 3-2.5 6.5-6 8"/><path d="M13 20l4-9 4 9M14.5 17h5"/>', cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', flag: '<path d="M5 21V4M5 5h11l-2 4 2 4H5"/>', award: '<circle cx="12" cy="9" r="5"/><path d="M9 13.5L7.5 21l4.5-2.5 4.5 2.5L15 13.5"/>', user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>', mask: '<path d="M4 5h16v6c0 5-3.5 8-8 8s-8-3-8-8z"/><path d="M9 10v1M15 10v1M9.5 14.5c1.5 1.2 3.5 1.2 5 0"/>' };
const row = (icon, k, v) => v ? `<div class="r">${ic(icon)}<div><dt>${k}</dt><dd>${esc(v)}</dd></div></div>` : "";
const client = `
const a=document.getElementById('au'),pl=document.getElementById('pl'),sk=document.getElementById('sk'),tm=document.getElementById('tm'),vo=document.getElementById('vo');
const f=t=>isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const ps=[...document.querySelectorAll('[data-t]')];
const setP=()=>sk.style.setProperty('--p',sk.value+'%');
pl.onclick=()=>a.paused?a.play():a.pause();
a.onplay=()=>{pl.setAttribute('aria-pressed','true');pl.setAttribute('aria-label','Pausar')};
a.onpause=a.onended=()=>{pl.setAttribute('aria-pressed','false');pl.setAttribute('aria-label','Reproducir')};
a.onloadedmetadata=()=>{tm.textContent='0:00 / '+f(a.duration);const d=document.getElementById('dur');if(d)d.textContent=f(a.duration)+' min'};
a.onerror=()=>{document.getElementById('note').textContent='No se pudo cargar el audio.';pl.disabled=true};
a.ontimeupdate=()=>{if(a.duration){sk.value=a.currentTime/a.duration*100;setP();tm.textContent=f(a.currentTime)+' / '+f(a.duration)}
let cur=null;for(const p of ps){if(+p.dataset.t<=a.currentTime)cur=p}
ps.forEach(p=>p.classList.toggle('now',p===cur))};
sk.oninput=()=>{if(a.duration)a.currentTime=sk.value/100*a.duration;setP()};
vo.oninput=()=>{a.volume=vo.value};
ps.forEach(p=>{const go=()=>{a.currentTime=+p.dataset.t;a.play()};p.onclick=go;p.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}}});
const cp=document.getElementById('copy');if(cp)cp.onclick=async()=>{try{await navigator.clipboard.writeText(location.href.split('#')[0]);cp.textContent='¡Copiado!'}catch(e){prompt('Copiá el enlace:',location.href)}};
`;
const extra = `
.cols{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,4fr);gap:clamp(32px,6vw,96px);margin-top:clamp(56px,8vw,96px);align-items:start}
@media(max-width:900px){.cols{grid-template-columns:1fr}}
.back{display:inline-block;margin-bottom:40px;font-size:14px;color:var(--mute)}
.player.v{grid-template-columns:56px 1fr auto auto}
.vol{display:flex;align-items:center;gap:8px;color:var(--mute);font-size:13px}.vol input{width:84px}
@media(hover:none){.vol{display:none}.player.v{grid-template-columns:56px 1fr auto}}
.trans{max-width:60ch;margin-bottom:1.1em;color:#cfcac0;padding-left:16px;border-left:2px solid transparent;transition:color .25s,border-color .25s}
.trans[data-t]{cursor:pointer}.trans[data-t]:hover{color:var(--ink)}
.trans.now{color:var(--ink);border-left-color:var(--red-hi)}
.hint{font-size:13px;color:var(--mute);margin-bottom:24px}
#transcripcion h2,#transcripcion .hint{padding-left:18px}
.ficha h2{font-size:22px;margin-bottom:24px}.ficha dl{display:grid;gap:16px}.ficha .r{display:grid;grid-template-columns:22px 1fr;gap:12px;align-items:start}.ficha .r svg{color:var(--mute);margin-top:2px}.ficha dt{color:var(--mute);font-size:12px}.ficha dd{margin:0;font-size:15px}
.ficha .tm{display:inline-block;margin-top:28px;border:1px solid var(--mute);padding:10px 18px;border-radius:2px;font-size:14px;text-decoration:none}.ficha .tm:hover{border-color:var(--ink)}
`;

const urls = [site.url];
const fichas = {}; // datos de TMDB para la home (solo episodios con ficha vigente)
const REEL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#d93a32"/><circle cx="20" cy="20" r="3.2" fill="#090c10"/><g fill="#090c10"><circle cx="20" cy="9" r="4"/><circle cx="30.5" cy="16.5" r="4"/><circle cx="26.5" cy="29" r="4"/><circle cx="13.5" cy="29" r="4"/><circle cx="9.5" cy="16.5" r="4"/></g></svg>';
for (const c of capsulas.filter(x => !x.demo)) {
  const pageUrl = `${site.url}capsulas/${c.id}/`; urls.push(pageUrl);
  const audio = c.audio ? (/^https?:/.test(c.audio) ? c.audio : "../../" + c.audio) : "";
  const g = guion(c.transcript), t = await ficha(c);
  const dir = t?.credits?.crew?.find(p => p.job === "Director")?.name;
  const cast = (t?.credits?.cast || []).slice(0, 4).map(p => p.name).join(", ");
  const generos = (t?.genres || []).map(x => x.name).join(", ");
  if (t) fichas[c.id] = { tmdb_id: t.id, title: t.title, original_title: t.original_title, year: (t.release_date || "").slice(0, 4), runtime: t.runtime,
    country: pais(t), director: dir || "", cast, genres: (t.genres || []).map(x => x.name) };
  const fichaHtml = t ? `<aside class="ficha" aria-labelledby="tf"><h2 id="tf">Datos de la película</h2><dl>
${row(IC.film, "Título original", t.original_title !== t.title ? t.original_title : "")}${row(IC.lang, "Título en español", t.title)}${row(IC.cal, "Año", (t.release_date || "").slice(0, 4))}${row(IC.clock, "Duración", hm(t.runtime))}${row(IC.flag, "País", pais(t))}${row(IC.award, "Director", dir)}${row(IC.user, "Reparto principal", cast)}${row(IC.mask, "Géneros", generos)}</dl>
<a class="tm" href="https://www.themoviedb.org/movie/${t.id}" target="_blank" rel="noopener">Ver en TMDB ↗</a></aside>` : "";
  const q = encodeURIComponent(`Escuchá «${c.film}» en Minuto Cinéfilo`), u = encodeURIComponent(pageUrl);
  const player = audio ? `<div class="player v" role="group" aria-label="Reproductor de ${esc(c.title)}">
<button class="play" id="pl" aria-pressed="false" aria-label="Reproducir"><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>
<input type="range" id="sk" min="0" max="100" step="0.1" value="0" aria-label="Posición del audio"><span class="time" id="tm">0:00 / ${esc(c.duration || "--:--")}</span>
<label class="vol">Vol <input type="range" id="vo" min="0" max="1" step="0.05" value="1" aria-label="Volumen"></label></div>
<audio id="au" preload="metadata" src="${esc(audio)}"></audio><p class="note" id="note" role="status"></p>` : `<p class="note">El audio de esta cápsula todavía no está disponible.</p>`;
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.film)} — ${esc(c.title)} | Minuto Cinéfilo</title>
<meta name="description" content="${esc(c.description)}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(c.film)} — Minuto Cinéfilo">
<meta property="og:description" content="${esc(c.description)}"><meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${site.url}og.png"><meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image"><meta name="color-scheme" content="dark">
<link rel="icon" href="../../favicon.svg">${fonts}
<style>${css}${extra}</style></head><body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header><div class="wrap"><a class="logo" href="../../">${REEL}MINUTO CINÉFILO</a>
<nav aria-label="Principal"><a href="../../">Inicio</a><a href="../../#archivo">Episodios</a><a href="../../#sobre">Sobre el proyecto</a><a href="${esc(site.radioUrl)}" target="_blank" rel="noopener">Radio Monk</a><a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></nav></div></header>
<main id="contenido"><div class="wrap" style="padding-block:clamp(48px,8vw,112px)">
<a class="back" href="../../#archivo">← Todos los episodios</a>
<div class="latest" style="margin-top:0"><div class="poster">${c.poster ? `<img src="${esc(c.poster)}" alt="Póster de ${esc(c.film)}">` : "<span>Póster no disponible</span>"}</div>
<div>${c.numero ? `<p class="label" style="margin-bottom:12px">Episodio #${esc(c.numero)}</p>` : ""}<h1 class="film" style="font-size:clamp(30px,4vw,52px)">${esc(c.title)}</h1><p style="color:var(--mute);font-size:18px;margin-top:6px">${esc(c.subtitle || c.film)}</p>
<div class="meta"><time datetime="${esc(c.date)}">${fecha(c.date)}</time><span id="dur">${c.duration ? esc(c.duration) + " min" : ""}</span></div>
<p class="desc">${esc(c.description)}</p>${player}
<div class="share"><span>Compartir</span><a href="https://wa.me/?text=${q}%20${u}" target="_blank" rel="noopener">WhatsApp</a><a href="https://t.me/share/url?url=${u}&text=${q}" target="_blank" rel="noopener">Telegram</a><a href="https://twitter.com/intent/tweet?text=${q}&url=${u}" target="_blank" rel="noopener">X</a><a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a><button type="button" id="copy">Copiar enlace</button></div>
</div></div>
${g.html || fichaHtml ? `<div class="cols"><section id="transcripcion" aria-labelledby="tg" style="padding:0">${g.html ? `<h2 id="tg" style="font-size:22px;margin-bottom:12px">Guion</h2>${g.sync ? '<p class="hint">Tocá un párrafo para saltar a ese momento del audio.</p>' : '<div style="height:12px"></div>'}${g.html}` : ""}</section>${fichaHtml}</div>` : ""}
</div></main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Minuto Cinéfilo</span><em>${esc(site.footerPhrase)}</em></div>
<div class="wrap tmdb"><img src="../../tmdb-logo.svg" alt="TMDB" height="12"><span>Este producto usa TMDB y las API de TMDB, pero no está avalado, certificado ni aprobado por TMDB. Datos de películas: <a href="https://www.themoviedb.org" target="_blank" rel="noopener">The Movie Database</a>.</span></div></footer>
${audio ? `<script>${client}</script>` : ""}
</body></html>`;
  mkdirSync(`capsulas/${c.id}`, { recursive: true });
  writeFileSync(`capsulas/${c.id}/index.html`, html);
}
mkdirSync("data", { recursive: true });
writeFileSync("data/fichas.json", JSON.stringify(fichas));
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
writeFileSync("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}sitemap.xml\n`);
console.log(`OK: ${urls.length - 1} página(s) generadas`);
