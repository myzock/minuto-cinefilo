// Genera capsulas/<id>/index.html, sitemap.xml y robots.txt desde capsulas.json
// Si existe la variable TMDB_KEY, trae la ficha de cada película y la guarda en data/tmdb/<id>.json
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
const raw = readFileSync("capsulas.json", "utf8");
let datos;
try { datos = JSON.parse(raw); } catch (e) {
  const m = /position (\d+)/.exec(e.message); let donde = "";
  if (m) { const linea = raw.slice(0, +m[1]).split("\n").length; donde = ` (cerca de la línea ${linea}: ${raw.split("\n")[linea - 1].trim().slice(0, 80)})`; console.log(`::error file=capsulas.json,line=${linea}::Error de sintaxis en capsulas.json`); }
  console.error(`capsulas.json no es un JSON válido${donde}.\nSuele ser una coma de más o de menos, o una comilla sin cerrar, en esa línea o en la anterior.`);
  process.exit(1);
}
const { site, capsulas } = datos;
const index = readFileSync("index.html", "utf8");
const css = index.match(/<style>([\s\S]*?)<\/style>/)[1];
const fonts = index.match(/<link href="https:\/\/fonts\.googleapis[^>]*>/)[0];

const preco = '<link rel="preconnect" href="https://image.tmdb.org"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';

// ---- Política de seguridad de contenido (CSP) para las páginas generadas ----
// Los scripts en línea se autorizan por hash (sha256) calculado acá mismo, así la CSP nunca queda desfasada del contenido.
import { createHash } from "node:crypto";
function conCsp(html) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`);
  const gc = site.goatcounter && /^[a-z0-9-]+$/i.test(site.goatcounter) ? `https://${site.goatcounter}.goatcounter.com` : "";
  const csp = [
    "default-src 'none'",
    `script-src 'self' ${[...new Set(hashes)].join(" ")}${gc ? " https://gc.zgo.at" : ""}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    `img-src 'self' data: https://image.tmdb.org${gc ? " " + gc : ""}`,
    `connect-src 'self'${gc ? " " + gc : ""}`,
    "media-src 'self'",
    "frame-src https://www.youtube-nocookie.com",
    "object-src 'none'", "base-uri 'self'", "form-action 'self'",
  ].join("; ");
  return html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="${csp}">`);
}
const tarjetasFallidas = []; // cápsulas cuya tarjeta para compartir (og.jpg) no se pudo generar; se informan al final del build
const KEY = process.env.TMDB_KEY;
// TMDB acepta la clave v3 (?api_key=) o el "Token de acceso de lectura" v4 (empieza con "eyJ"), que viaja en una cabecera y no en la URL.
// Si el secreto TMDB_KEY es un token v4, se manda por cabecera; si es una clave v3, todo sigue igual.
const KEY_V4 = !!KEY && KEY.startsWith("eyJ");
function tfetch(url, opts = {}) {
  if (!KEY_V4) return fetch(url, opts);
  return fetch(url.replace(/([?&])api_key=[^&]*&?/, "$1").replace(/[?&]$/, ""), { ...opts, headers: { ...(opts.headers || {}), Authorization: `Bearer ${KEY}` } });
}
const IMG = "https://image.tmdb.org/t/p/";
const HOY = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }); // AAAA-MM-DD, hora de Argentina
const AHORA = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }); // HH:MM, hora de Argentina
const publicado = c => c.date < HOY || (c.date === HOY && (!c.hora || c.hora <= AHORA)); // "hora" es opcional: HH:MM de Argentina

// ---- Chequeo de capsulas.json: si hay errores, el build se corta y la web publicada queda como estaba ----
{
  const errores = [], avisos = [], ids = new Set();
  const urlOk = u => /^https:\/\/[a-z0-9.-]+\/([^\s]*\/)?$/i.test(u || "");
  // AAAA-MM-DD que exista de verdad: rechaza 2026-02-31, 2026-04-31, 29/02 de años no bisiestos, mes 00 o 13, etc.
  const fechaOk = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); if (!m) return false; const y = +m[1], mo = +m[2], d = +m[3], t = new Date(Date.UTC(y, mo - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d; };
  if (!urlOk(site.url)) errores.push(`"site.url" debe tener la forma https://minutocinefilo.com.ar/ (con https:// una sola vez y la barra / al final). Valor actual: ${JSON.stringify(site.url)}`);
  if (site.podcast?.guidBase && !urlOk(site.podcast.guidBase)) errores.push(`"podcast.guidBase" debe tener la forma https://dominio/ruta/ (con barra al final). Valor actual: ${JSON.stringify(site.podcast.guidBase)}`);
  capsulas.forEach((c, i) => {
    if (c.demo) return;
    const n = `Episodio ${i + 1} de la lista`, id = c.id ? `"${c.id}"` : n;
    if (!c.id || !/^[a-z0-9-]+$/.test(c.id)) errores.push(`${n}: "id" faltante o inválido (solo minúsculas, números y guiones). Valor: ${JSON.stringify(c.id)}`);
    else if (ids.has(c.id)) errores.push(`${id}: el id está repetido`); else ids.add(c.id);
    if (!c.title) errores.push(`${id}: falta "title"`);
    if (!c.description) errores.push(`${id}: falta "description"`);
    if (c.hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.hora)) errores.push(`${id}: "hora" debe tener el formato HH:MM de 00:00 a 23:59 (valor: ${JSON.stringify(c.hora)})`);
    if (!fechaOk(c.date)) errores.push(`${id}: "date" debe tener el formato AAAA-MM-DD y ser una fecha que exista (valor: ${JSON.stringify(c.date)})`);
    if (c.tmdb_id && !Number.isInteger(+c.tmdb_id)) errores.push(`${id}: "tmdb_id" debe ser un número (valor: ${JSON.stringify(c.tmdb_id)})`);
    if (!c.tmdb_id && !c.film) errores.push(`${id}: falta "tmdb_id" (o al menos "film")`);
    const lanzado = publicado(c), dest = lanzado ? errores : avisos, nota = lanzado ? "" : " (todavía no, el episodio está agendado)";
    const falta = (campo, ruta) => { if (ruta && !/^https?:/.test(ruta) && !existsSync(ruta)) dest.push(`${id}: "${campo}" apunta a "${ruta}" y ese archivo no existe en el repositorio (revisá mayúsculas, extensión y carpeta)${nota}`); };
    if (!c.audio) dest.push(`${id}: falta "audio"`); else falta("audio", c.audio);
    falta("transcript", c.transcript);
    if (c.trailer && !/(youtu\.be\/|v=|embed\/)[\w-]{11}|^[\w-]{11}$/.test(String(c.trailer))) avisos.push(`${id}: "trailer" no parece un enlace o ID de YouTube válido (se ignora)`);
    if (!c.tmdb_id && !c.poster) avisos.push(`${id}: sin tmdb_id ni poster, se mostrará sin póster`);
  });
  { // numeración y ciclos: se avisa (no se corta el build) para que se corrija a tiempo
    const r0 = capsulas.filter(x => !x.demo), o0 = [...r0].sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || (a.hora || "").localeCompare(b.hora || ""));
    const efec = c => c.numero || o0.indexOf(c) + 1; // el mismo número que usa la web: el del JSON o el que sale del orden por fecha
    r0.forEach(c => { if (c.numero != null && !(Number.isInteger(c.numero) && c.numero > 0)) avisos.push(`${c.id ? `"${c.id}"` : "Un episodio"}: "numero" debe ser un entero positivo (valor: ${JSON.stringify(c.numero)})`); });
    const usados = {}; o0.forEach(c => { (usados[efec(c)] ||= []).push(c.id); });
    for (const [n, l] of Object.entries(usados)) if (l.length > 1) avisos.push(`Numeración repetida: el número ${n} lo tienen ${l.join(" y ")}`);
    o0.forEach((c, i) => { const p = o0[i - 1]; if (p && efec(c) < efec(p)) avisos.push(`Numeración incoherente: "${c.id}" es el #${efec(c)} pero se publica después de "${p.id}" (#${efec(p)}); los números no siguen el orden de las fechas`); });
    const clave = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim(), grupos = {};
    r0.filter(c => c.ciclo).forEach(c => { (grupos[clave(c.ciclo)] ||= new Set()).add(c.ciclo); });
    for (const s of Object.values(grupos)) if (s.size > 1) avisos.push(`Ciclos que solo difieren por mayúsculas, acentos o espacios: ${[...s].map(x => JSON.stringify(x)).join(" y ")}. La web los trata como ciclos distintos`);
    r0.forEach(c => { if (c.ciclo && c.ciclo !== String(c.ciclo).replace(/\s+/g, " ").trim()) avisos.push(`${c.id ? `"${c.id}"` : "Un episodio"}: el ciclo ${JSON.stringify(c.ciclo)} tiene espacios de más al principio, al final o repetidos`); });
  }
  avisos.forEach(m => console.log(`::warning file=capsulas.json::${m}`));
  errores.forEach(m => console.log(`::error file=capsulas.json::${m}`));
  const pub = capsulas.filter(c => !c.demo && publicado(c)).length, agen = capsulas.filter(c => !c.demo && !publicado(c)).length;
  const resumen = `## Chequeo de capsulas.json\n- Publicados: ${pub}\n- Agendados: ${agen}\n` + (errores.length ? `\n### Errores (no se publicó nada)\n${errores.map(m => "- " + m).join("\n")}\n` : "\nTodo en orden.\n") + (avisos.length ? `\n### Avisos\n${avisos.map(m => "- " + m).join("\n")}\n` : "");
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, resumen, { flag: "a" });
  if (errores.length) { console.error("\nSe encontraron errores en capsulas.json:\n" + errores.map(m => " - " + m).join("\n") + "\n\nNo se generó nada: la web publicada sigue como estaba."); process.exit(1); }
}
// <title> de la cápsula: película — título | marca; si pasa de ~65 caracteres se usa solo el título y, si aun así no entra, se acorta
const SUF_TITULO = " | Minuto Cinéfilo";
function tituloSeo(c) {
  const completo = norm(c.film) && norm(c.film) !== norm(c.title) ? c.film + " — " + c.title : c.title;
  if ((completo + SUF_TITULO).length <= 65) return completo;
  if ((c.title + SUF_TITULO).length <= 65) return c.title;
  return c.title.slice(0, 65 - SUF_TITULO.length - 1).replace(/\s+\S*$/, "") + "…";
}
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fecha = iso => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
const hm = m => (m ? `${Math.floor(m / 60)} h ${m % 60} min` : "");

// ---- "Dónde verla" (TMDB watch/providers, datos de JustWatch): solo con "dondeVerla": true en site ----
async function disponibilidad(id) {
  if (site.dondeVerla !== true || !id) return null;
  const file = `data/watch/${id}.json`;
  let w = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  const dias = x => (Date.now() - new Date(x?._fetched || 0)) / 864e5;
  if (KEY && !(dias(w) < 7)) try { // se vuelve a pedir cada 7 días (la disponibilidad cambia más que la ficha)
    const res = await tfetch(`https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${KEY}`, { signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const ar = (await res.json()).results?.AR || {}; const nom = l => (l || []).map(p => p.provider_name).filter(Boolean);
      w = { _fetched: new Date().toISOString(), link: ar.link || "", flatrate: nom(ar.flatrate), free: [...nom(ar.free), ...nom(ar.ads)], rent: nom(ar.rent), buy: nom(ar.buy) };
      mkdirSync("data/watch", { recursive: true }); writeFileSync(file, JSON.stringify(w));
    } else console.log(`TMDB respondió ${res.status} para la disponibilidad de ${id}; se usa la copia guardada si existe.`);
  } catch (e) { console.log(`TMDB no respondió para la disponibilidad de ${id} (${e.name}); se usa la copia guardada si existe.`); }
  if (!w || !(dias(w) <= 21)) return null; // pasadas 3 semanas sin renovar, mejor no mostrar un dato viejo
  const items = [], vistos = new Set(); const sumar = (n, pre) => { if (!vistos.has(n) && items.length < 4) { vistos.add(n); items.push({ n, t: pre ? `${pre} · ${n}` : n }); } };
  (w.flatrate || []).forEach(n => sumar(n, "")); (w.free || []).forEach(n => sumar(n, "Gratis")); (w.rent || []).forEach(n => sumar(n, "Alquilar"));
  if (!items.length) (w.buy || []).forEach(n => sumar(n, "Comprar"));
  if (!items.length) return null;
  return { link: /^https:\/\/www\.themoviedb\.org\//.test(w.link) ? w.link : `https://www.themoviedb.org/movie/${id}/watch?locale=AR`, items };
}
const whHtml = w => w ? `<div class="wh"><p class="k">Dónde verla en Argentina</p><div class="pills">${w.items.map(i => `<a class="ver" data-p="${esc(i.n)}" href="${esc(w.link)}" target="_blank" rel="noopener">${esc(i.t)}</a>`).join("")}</div><p class="src">Fuente: <a href="https://www.justwatch.com" target="_blank" rel="noopener">JustWatch</a></p></div>` : "";

async function ficha(c) {
  let id = c.tmdb_id;
  try {
    if (KEY && !id) {
      const r = await (await tfetch(`https://api.themoviedb.org/3/search/movie?api_key=${KEY}&language=es-AR&query=${encodeURIComponent(c.film)}`, { signal: AbortSignal.timeout(15000) })).json();
      id = r.results?.[0]?.id;
      if (id) console.log(`Aviso: "${c.film}" sin tmdb_id; se usó ${id}. Agregá "tmdb_id": ${id} al JSON para fijarlo.`);
    }
    if (!id) return null;
    const file = `data/tmdb/${id}.json`;
    const hit = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    const fresca = hit && "trailer" in hit && "vote_average" in hit && (Date.now() - new Date(hit._fetched || 0)) / 864e5 < 30; // se vuelve a pedir a TMDB cada 30 días
    if (KEY && !fresca) try {
      const res = await tfetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${KEY}&language=es-AR&append_to_response=credits,images&include_image_language=null`, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const j = await res.json(); // se guarda solo lo que la web muestra, con fecha de descarga
        const videos = async lang => { try { const r = await tfetch(`https://api.themoviedb.org/3/movie/${id}/videos?api_key=${KEY}&language=${lang}`, { signal: AbortSignal.timeout(15000) }); return r.ok ? (await r.json()).results || [] : []; } catch { return []; } };
        const elegir = l => l.filter(x => x.site === "YouTube" && x.type === "Trailer").sort((a, b) => (b.official - a.official) || String(b.published_at).localeCompare(String(a.published_at)))[0]?.key;
        const trailer = elegir(await videos("es-AR")) || elegir(await videos("en-US")) || "";
        const slim = { _fetched: new Date().toISOString(), trailer, title: j.title, original_title: j.original_title, release_date: j.release_date, runtime: j.runtime, vote_average: j.vote_average || 0, vote_count: j.vote_count || 0, poster: j.poster_path || "",
          backdrop: ((j.images?.backdrops || []).filter(x => !x.iso_639_1).sort((a, b) => b.vote_average - a.vote_average || b.vote_count - a.vote_count)[0]?.file_path) || j.backdrop_path || "",
          genres: (j.genres || []).map(g => ({ name: g.name })), production_countries: (j.production_countries || []).map(p => ({ iso: p.iso_3166_1, name: p.name })),
          credits: { crew: (j.credits?.crew || []).filter(p => p.job === "Director").map(p => ({ job: p.job, name: p.name })), cast: (j.credits?.cast || []).slice(0, 4).map(p => ({ name: p.name })) } };
        mkdirSync("data/tmdb", { recursive: true }); writeFileSync(file, JSON.stringify(slim));
      }
      else console.log(`TMDB respondió ${res.status} para ${c.film}; se usa la copia guardada si existe.`);
    } catch (e) { console.log(`TMDB no respondió para ${c.film} (${e.name}); se usa la copia guardada si existe.`); }
    if (!existsSync(file)) return null;
    const d = JSON.parse(readFileSync(file, "utf8"));
    const dias = (Date.now() - new Date(d._fetched || 0)) / 864e5;
    if (!(dias <= 150)) { console.log(`Ficha de "${c.film}" vencida (${Math.round(dias)} días, límite TMDB: 6 meses): no se muestra hasta renovarla con TMDB_KEY.`); return null; }
    return { id, ...d, watch: await disponibilidad(id) };
  } catch (e) { console.log("TMDB:", e.message); return null; }
}

const sinAst = s => String(s ?? "").replace(/\*([^*\n]+)\*/g, "$1"); // quita los asteriscos de cursiva donde no se puede mostrar cursiva
const recorta = (s, max = 155) => { s = String(s ?? "").replace(/\s+/g, " ").trim(); if (s.length <= max) return s; const c = s.slice(0, max - 1), i = c.lastIndexOf(" "); return c.slice(0, i > 80 ? i : c.length).replace(/[\s,;:.\-–—]+$/, "") + "…"; }; // para la meta description de los buscadores; el texto original no se toca
const cursiva = s => s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function guion(path) {
  if (!path || !existsSync(path)) return { html: "", sync: false };
  const paras = readFileSync(path, "utf8").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  let sync = false;
  const html = paras.map(p => {
    const m = p.match(/^\[(\d+):(\d{2})\]\s*/);
    if (m) { sync = true; return `<p class="trans" data-t="${+m[1] * 60 + +m[2]}" tabindex="0" role="button">${cursiva(esc(p.slice(m[0].length)))}</p>`; }
    return `<p class="trans">${cursiva(esc(p)).replace(/\n/g, "<br>")}</p>`;
  }).join("");
  return { html, sync };
}

const pais = t => (t.production_countries || []).map(p => { try { return p.iso ? new Intl.DisplayNames(["es"], { type: "region" }).of(p.iso) : p.name; } catch { return p.name; } }).join(", ");
const ic = d => `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = { film: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4"/>', lang: '<path d="M4 6h9M8.5 4v2M6 6c0 4 3 7 6.5 8M11 6c0 3-2.5 6.5-6 8"/><path d="M13 20l4-9 4 9M14.5 17h5"/>', cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>', clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>', flag: '<path d="M5 21V4M5 5h11l-2 4 2 4H5"/>', award: '<circle cx="12" cy="9" r="5"/><path d="M9 13.5L7.5 21l4.5-2.5 4.5 2.5L15 13.5"/>', user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>', mask: '<path d="M4 5h16v6c0 5-3.5 8-8 8s-8-3-8-8z"/><path d="M9 10v1M15 10v1M9.5 14.5c1.5 1.2 3.5 1.2 5 0"/>' };
const ytId = v => { if (!v) return ""; const s = String(v), m = s.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/) || s.match(/^([\w-]{11})$/); return m ? m[1] : ""; };
const row = (icon, k, v) => v ? `<div class="r"><dt>${ic(icon)}${k}</dt><dd>${esc(v)}</dd></div>` : "";
const client = `
const a=document.getElementById('au'),pl=document.getElementById('pl'),sk=document.getElementById('sk'),tm=document.getElementById('tm'),vo=document.getElementById('vo');
const f=t=>isFinite(t)?Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0'):'0:00';
const ps=[...document.querySelectorAll('[data-t]')];
const setP=()=>{sk.style.setProperty('--p',sk.value+'%');dw()};
const wb=document.getElementById('wb'),cv=document.getElementById('wv');
function dw(){if(!W||!cv)return;const d=window.devicePixelRatio||1,w=cv.clientWidth,h=cv.clientHeight;if(!w)return;cv.width=w*d;cv.height=h*d;const x=cv.getContext('2d');x.scale(d,d);const n=W.length,s=w/n,f=sk.value/100;for(let i=0;i<n;i++){const bh=Math.max(3,W[i]/100*h);x.fillStyle=(i+.5)/n<=f?'#ef4d44':'#3a424d';x.beginPath();x.roundRect?x.roundRect(i*s+s*.18,(h-bh)/2,s*.64,bh,2):x.rect(i*s+s*.18,(h-bh)/2,s*.64,bh);x.fill()}}
if(W&&wb){wb.classList.add('on');addEventListener('resize',dw);dw()}
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
const trl = `
const b=document.getElementById('trbtn');
if(b)b.onclick=()=>{const a=document.getElementById('au');if(a)a.pause();
const f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+b.dataset.id+'?autoplay=1&rel=0';
f.title=b.dataset.t;f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';
b.replaceWith(f)};
`;
const trk = `
(function(){
const gc=(p,t)=>{try{window.goatcounter&&window.goatcounter.count&&window.goatcounter.count({path:p,title:t||p,event:true})}catch(e){}};
const id=(location.pathname.match(/capsulas\\/([^/]+)/)||[])[1]||'';
const vs=new Set();const una=(p,t)=>{if(vs.has(p))return;vs.add(p);gc(p,t)};
const RU=__RADIO__;
const au=document.getElementById('au');
if(au){
 au.addEventListener('play',()=>una('play/'+id,'Play: '+document.title));
 au.addEventListener('ended',()=>una('fin/'+id,'Completo: '+document.title));
 au.addEventListener('timeupdate',()=>{if(!au.duration)return;let s=0;const r=au.played;for(let i=0;i<r.length;i++)s+=r.end(i)-r.start(i);if(s/au.duration>=.5)una('mitad/'+id,'Mitad: '+document.title)});
}
const cl=a=>{const h=a.href||'';
 if(/wa\\.me|whatsapp/.test(h))return 'compartir/whatsapp/'+id;
 if(/t\\.me\\//.test(h))return 'compartir/telegram/'+id;
 if(/(twitter|x)\\.com\\/intent/.test(h))return 'compartir/x/'+id;
 if(/facebook\\.com\\/sharer/.test(h))return 'compartir/facebook/'+id;
 if(a.classList.contains('charla'))return 'charla/'+id;
 if(a.classList.contains('ver'))return 'donde-ver/'+(a.dataset.p||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
 if(/open\\.spotify\\.com/.test(h))return 'plataforma/spotify';
 if(/music\\.youtube\\.com|youtube\\.com\\/playlist/.test(h))return 'plataforma/youtube-music';
 if(/instagram\\.com/.test(h))return 'plataforma/instagram';
 try{if(RU&&new URL(h).hostname===new URL(RU).hostname)return 'plataforma/radio-monk'}catch(e){}
 if(/themoviedb\\.org/.test(h))return 'tmdb/'+id;
 if(/\\/capsulas\\/[^/]+\\/?$/.test(h)&&a.closest('.epnav'))return 'navegacion/'+(a.classList.contains('sig')?'siguiente':'anterior');
 return null};
document.addEventListener('click',e=>{
 if(e.target.closest('#copy')){gc('compartir/copiar/'+id);return}
 if(e.target.closest('#trbtn')){gc('trailer/'+id);return}
 const a=e.target.closest('a[href]');if(!a)return;const p=cl(a);if(p)gc(p)});
})();
`;
const extra = `
.wavebox{position:relative;height:44px;min-width:0}.wavebox canvas{display:none;width:100%;height:100%}.wavebox.on canvas{display:block}.wavebox input{position:absolute;inset:0;width:100%;height:100%;margin:0}.wavebox.on input{opacity:0}.wavebox:has(input:focus-visible){outline:2px solid var(--ink);outline-offset:3px;border-radius:6px}
.cols{display:grid;grid-template-columns:minmax(0,7fr) minmax(0,4fr);gap:clamp(32px,6vw,96px);margin-top:clamp(56px,8vw,96px);align-items:start}
@media(max-width:900px){.cols{grid-template-columns:1fr}}
.back{display:inline-block;margin-top:-11px;margin-bottom:29px;padding-block:11px;font-size:14px;color:var(--mute)}
.poster{position:relative}.score{position:absolute;left:12px;bottom:12px;background:rgba(9,12,16,.82);border:1px solid #2a2f37;border-radius:999px;padding:6px 12px;font-size:14px;font-weight:600;backdrop-filter:blur(4px)}.score small{font-weight:400;color:var(--mute);font-size:11px;margin-left:4px}
.epnav{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-bottom:64px}.epnav a{display:grid;gap:6px;border:1px solid #2a2f37;border-radius:6px;padding:16px 18px;text-decoration:none;color:inherit}.epnav a:hover{border-color:var(--ink)}.epnav small{color:var(--mute);font-size:12px}.epnav span{font-size:16px}.epnav .sig{text-align:right}@media(max-width:560px){.epnav{grid-template-columns:1fr}.epnav .sig{text-align:left}}
.player.v{grid-template-columns:56px 1fr auto auto}
.vol{display:flex;align-items:center;gap:8px;color:var(--mute);font-size:13px}.vol input{width:84px}
@media(hover:none){.vol{display:none}.player.v{grid-template-columns:56px 1fr auto}}
@media(max-width:640px){.latest .poster{max-width:220px;margin-inline:auto;padding:0}.trans{padding-left:12px}#transcripcion h2,#transcripcion .hint{padding-left:14px}.epnav{grid-template-columns:1fr}.epnav .sig{text-align:left}}
.trans{max-width:60ch;margin-bottom:1.1em;color:#cfcac0;padding-left:16px;border-left:2px solid transparent;transition:color .25s,border-color .25s}
.trans[data-t]{cursor:pointer}.trans[data-t]:hover{color:var(--ink)}
.trans.now{color:var(--ink);border-left-color:var(--red-hi)}
.hint{font-size:13px;color:var(--mute);margin-bottom:24px}
.trl{display:grid;gap:12px}
.trbtn{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;width:100%;aspect-ratio:16/9;background:var(--panel) center/cover no-repeat;border:1px solid var(--line);border-radius:12px;color:var(--ink);font:700 16px var(--serif);cursor:pointer}
.trbtn.img::before{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(9,12,16,.8),rgba(9,12,16,.35))}
.trbtn>*{position:relative}.trbtn:hover{border-color:var(--ink)}
.trbtn .pl{width:64px;height:64px;border-radius:50%;background:var(--red);display:grid;place-items:center;transition:background .2s}.trbtn:hover .pl{background:var(--red-hi)}.trbtn .pl svg{width:26px;height:26px;color:#fff}
.trbtn:not(.img){aspect-ratio:auto;flex-direction:row;justify-content:flex-start;padding:16px 20px}.trbtn:not(.img) .pl{width:44px;height:44px}
.trl iframe{width:100%;aspect-ratio:16/9;border:0;border-radius:12px}.trl a{font-size:14px;color:var(--mute);padding-block:11px;margin-block:-11px}
.wh .pills a{position:relative}.wh .pills a::after{content:"";position:absolute;inset:-7px -4px}
#transcripcion h2,#transcripcion .hint{padding-left:18px}
.ficha h2{font-size:22px;margin-bottom:24px}.ficha dl{display:grid;gap:16px}.ficha .r{position:relative;padding-left:34px}.ficha .r svg{position:absolute;left:0;top:2px;color:var(--mute)}.ficha dt{color:var(--mute);font-size:12px}.ficha dd{margin:0;font-size:15px}
.wh{margin-top:24px}.wh .k{font-size:12px;color:var(--mute);margin:0 0 8px}.wh .pills{display:flex;gap:8px;flex-wrap:wrap}.wh .pills a{border:1px solid var(--line);border-radius:999px;padding:5px 14px;font-size:13px;text-decoration:none}.wh .pills a:hover{border-color:var(--ink)}.wh .src{font-size:11px;color:var(--mute);opacity:.75;margin:10px 0 0}.wh .src a{color:inherit}
.ficha .tm{display:inline-block;margin-top:28px;border:1px solid var(--mute);padding:10px 18px;border-radius:2px;font-size:14px;text-decoration:none}.ficha .tm:hover{border-color:var(--ink)}
`;

const urls = [site.url];
const reales = capsulas.filter(x => !x.demo);
const asc = [...reales].sort((a, b) => a.date.localeCompare(b.date) || (a.hora || "").localeCompare(b.hora || "")); // el número de episodio sale del orden por fecha
const fichas = {}; // datos de TMDB para la home (solo episodios con ficha vigente)
const { ondas } = await import("./ondas.mjs");
const ONDAS = ondas(reales.filter(x => x.audio && !/^https?:/.test(x.audio)).map(x => x.audio));
const REEL = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="#d93a32"/><circle cx="20" cy="20" r="3.2" fill="#090c10"/><g fill="#090c10"><circle cx="20" cy="9" r="4"/><circle cx="30.5" cy="16.5" r="4"/><circle cx="26.5" cy="29" r="4"/><circle cx="13.5" cy="29" r="4"/><circle cx="9.5" cy="16.5" r="4"/></g></svg>';
for (const c of reales) {
  const pageUrl = `${site.url}capsulas/${c.id}/`; const futuro = !publicado(c); if (!futuro) urls.push(pageUrl);
  const audio = c.audio ? (/^https?:/.test(c.audio) ? c.audio : "../../" + c.audio) : "";
  const g = guion(c.transcript), t = await ficha(c);
  c.film = c.film || t?.title || ""; c.numero = c.numero || asc.indexOf(c) + 1;
  c.poster = c.poster || (t?.poster ? IMG + "w500" + t.poster : "");
  const dir = t?.credits?.crew?.find(p => p.job === "Director")?.name;
  const cast = (t?.credits?.cast || []).slice(0, 4).map(p => p.name).join(", ");
  const generos = (t?.genres || []).map(x => x.name).join(", ");
  if (t) fichas[c.id] = { tmdb_id: t.id, title: t.title, original_title: t.original_title, year: (t.release_date || "").slice(0, 4), runtime: t.runtime,
    country: pais(t), director: dir || "", cast, genres: (t.genres || []).map(x => x.name),
    vote_average: t.vote_average || 0, vote_count: t.vote_count || 0,
    poster: t.poster ? IMG + "w500" + t.poster : "", backdrop: t.backdrop ? IMG + "w1280" + t.backdrop : "", ...(t.watch ? { watch: t.watch } : {}) };
  const yt = c.trailer === false ? "" : ytId(c.trailer) || ytId(t?.trailer);
  const bd = c.backdrop || (t?.backdrop ? IMG + "w1280" + t.backdrop : "");
  const trailerHtml = yt ? `<section id="trailer" aria-labelledby="tt" style="padding:0 0 44px"><h2 id="tt" style="font-size:22px;margin-bottom:16px">Tráiler</h2><div class="trl"><button class="trbtn${bd ? " img" : ""}" id="trbtn" type="button" data-id="${yt}" data-t="Tráiler de ${esc(c.film)}"${bd ? ` style="background-image:url('${esc(bd.replace("/t/p/w1280/", "/t/p/w780/"))}')"` : ""}><span class="pl"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span><span>Ver el tráiler</span></button><a href="https://www.youtube.com/watch?v=${yt}" target="_blank" rel="noopener">Abrir en YouTube ↗</a></div></section>` : "";
  const fichaHtml = t ? `<aside class="ficha" aria-labelledby="tf"><h2 id="tf">Datos de la película</h2><dl>
${row(IC.film, "Título original", t.original_title !== t.title ? t.original_title : "")}${row(IC.lang, "Título en español", t.title)}${row(IC.cal, "Año", (t.release_date || "").slice(0, 4))}${row(IC.clock, "Duración", hm(t.runtime))}${row(IC.flag, "País", pais(t))}${row(IC.award, "Director", dir)}${row(IC.user, "Reparto principal", cast)}${row(IC.mask, "Géneros", generos)}</dl>
${whHtml(t.watch)}<a class="tm" href="https://www.themoviedb.org/movie/${t.id}" target="_blank" rel="noopener">Ver en TMDB ↗</a></aside>` : "";
  // tarjeta propia para compartir (si falla algo, se usa el fondo de la película o el og.png genérico)
  mkdirSync(`capsulas/${c.id}`, { recursive: true });
  const cardFile = `capsulas/${c.id}/og.jpg`;
  try {
    const src = bd || c.poster;
    const cacheFile = "data/og-cache.json", cache = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, "utf8")) : {};
    const clave = JSON.stringify([c.numero, c.title, src || ""]);
    let bg = null;
    const alDia = existsSync(cardFile) && cache[c.id] === clave; // el build corre cada hora: solo se rehace la tarjeta si cambió algo
    if (!alDia && src) { try { const r = await fetch(src, { signal: AbortSignal.timeout(15000) }); if (r.ok) bg = Buffer.from(await r.arrayBuffer()); } catch {} }
    if (alDia) { /* tarjeta al día */ } else if (bg || !existsSync(cardFile)) { const { tarjeta } = await import("./og.mjs"); const buf = await tarjeta({ numero: c.numero, title: c.title, bgBuffer: bg }); if (buf) { writeFileSync(cardFile, buf); if (bg) { cache[c.id] = clave; writeFileSync(cacheFile, JSON.stringify(cache)); } } }
  } catch (e) { console.log(`::warning::No se pudo generar la tarjeta de ${c.id}: ${e.message}`); tarjetasFallidas.push(`${c.id}: ${e.message}`); }
  if (!existsSync(cardFile) && !tarjetasFallidas.some(t => t.startsWith(c.id + ":"))) tarjetasFallidas.push(`${c.id}: no hay tarjeta og.jpg (al compartir se usa la imagen de reserva)`);
  const ogImg = existsSync(cardFile) ? `${pageUrl}og.jpg` : bd || c.poster || `${site.url}og.png`;
  const pub = asc.filter(publicado), i = pub.indexOf(c);
  const ant = i > 0 ? pub[i - 1] : (futuro ? pub[pub.length - 1] : null), sig = i >= 0 && i < pub.length - 1 ? pub[i + 1] : null;
  const epN = x => x.film || x.title;
  const navEp = ant || sig ? `<div class="wrap"><nav class="epnav" aria-label="Más cápsulas">${ant ? `<a class="ant" href="../${ant.id}/"><small>← Cápsula anterior</small><span>${esc(epN(ant))}</span></a>` : "<span></span>"}${sig ? `<a class="sig" href="../${sig.id}/"><small>Cápsula siguiente →</small><span>${esc(epN(sig))}</span></a>` : "<span></span>"}</nav></div>` : "";
  const subs = [["Spotify", site.spotifyUrl], ["Apple Podcasts", site.appleUrl], ["YouTube Music", site.youtubeMusicUrl], ["Amazon Music", site.amazonUrl]].filter(x => x[1]);
  const subsHtml = `<div class="share subs"><span>Escuchá en</span>${subs.map(([n, u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("")}<a href="../../feed.xml">RSS</a></div>`;
  const jld = JSON.stringify({ "@context": "https://schema.org", "@type": "PodcastEpisode", name: c.title, url: pageUrl, datePublished: c.date, description: sinAst(c.description),
    ...(c.numero ? { episodeNumber: c.numero } : {}), image: ogImg, inLanguage: "es-AR",
    ...(audio && !/^https?:/.test(c.audio) ? { associatedMedia: { "@type": "AudioObject", contentUrl: site.url + encodeURI(c.audio), encodingFormat: "audio/mpeg" } } : {}),
    partOfSeries: { "@type": "PodcastSeries", name: "Minuto Cinéfilo", url: site.url } }).replace(/</g, "\\u003c");
  const pun = t && t.vote_count >= 20 && t.vote_average ? `<span class="score" title="Puntaje de los usuarios de TMDB (${t.vote_count} votos)">★ ${t.vote_average.toFixed(1)} <small>TMDB</small></span>` : ""; // solo con votos suficientes
  const q = encodeURIComponent(`Escuchá «${c.film}» en Minuto Cinéfilo`), u = encodeURIComponent(pageUrl);
  const player = audio ? `<div class="player v" role="group" aria-label="Reproductor de ${esc(c.title)}">
<button class="play" id="pl" aria-pressed="false" aria-label="Reproducir"><svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg></button>
<div class="wavebox" id="wb"><canvas id="wv" aria-hidden="true"></canvas><input type="range" id="sk" min="0" max="100" step="0.1" value="0" aria-label="Posición del audio"></div><span class="time" id="tm">0:00 / ${esc(c.duration || "--:--")}</span>
<label class="vol">Vol <input type="range" id="vo" min="0" max="1" step="0.05" value="1" aria-label="Volumen"></label></div>
<audio id="au" preload="metadata" src="${esc(audio)}"></audio><p class="note" id="note" role="status"></p>` : `<p class="note">El audio de esta cápsula todavía no está disponible.</p>`;
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(tituloSeo(c))} | Minuto Cinéfilo</title>
<meta name="description" content="${esc(recorta(sinAst(c.description)))}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(c.title)} — Minuto Cinéfilo">
<meta property="og:description" content="${esc(sinAst(c.description))}"><meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${ogImg}">${existsSync(cardFile) ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:type" content="image/jpeg">' : ""}<meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${ogImg}"><meta name="color-scheme" content="dark">${futuro ? '<meta name="robots" content="noindex">' : ""}
<script type="application/ld+json">${jld}</script>
<link rel="icon" href="../../favicon.svg" type="image/svg+xml"><link rel="icon" href="../../favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="../../apple-touch-icon.png">${preco}${fonts}
<style>${css}${extra}</style></head><body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header><div class="wrap"><a class="logo" href="../../">${REEL}MINUTO CINÉFILO</a>
<nav aria-label="Principal"><a href="../../">Inicio</a><a href="../../#archivo">Cápsulas</a><a href="../../#sobre">Sobre el proyecto</a><a href="../../prensa/">Prensa</a><a href="${esc(site.radioUrl)}" target="_blank" rel="noopener">Radio Monk</a><a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></nav></div></header>
<main id="contenido"><div class="wrap" style="padding-block:clamp(48px,8vw,112px)">
<a class="back" href="../../#archivo">← Todas las cápsulas</a>
<div class="latest" style="margin-top:0"><div class="poster">${c.poster ? `<img src="${esc(c.poster)}" alt="Póster de ${esc(c.film)}" decoding="async">` : "<span>Póster no disponible</span>"}${pun}${c.ciclo ? `<span class="ciclo">${esc(c.ciclo)}</span>` : ""}</div>
<div>${c.numero ? `<p class="label" style="margin-bottom:12px">Cápsula #${esc(c.numero)}</p>` : ""}<h1 class="film" style="font-size:clamp(30px,4vw,52px)">${esc(c.title)}</h1>${norm(c.subtitle || c.film) && norm(c.subtitle || c.film) !== norm(c.title) ? `<p style="color:var(--mute);font-size:18px;margin-top:6px">${esc(c.subtitle || c.film)}</p>` : ""}
${site.paginasCiclos === true && c.ciclo ? `<p style="margin-top:8px"><a href="../../ciclos/${esc(norm(c.ciclo).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""))}/" style="color:var(--red-hi)">Ver todo el ciclo ${esc(c.ciclo)} →</a></p>` : ""}<div class="meta"><time datetime="${esc(c.date)}">${fecha(c.date)}</time><span id="dur">${c.duration ? esc(c.duration) + " min" : ""}</span></div>
<p class="desc">${cursiva(esc(c.description))}</p>${player}
${c.charla && /^https:\/\//.test(c.charla) ? `<a class="charla" href="${esc(c.charla)}" target="_blank" rel="noopener"><span><b>¿Querés más?</b> Escuchá la charla completa sobre ${esc(c.film || c.title)}</span><em>Spotify ↗</em></a>` : ""}
<div class="share"><span>Compartir</span><a href="https://wa.me/?text=${q}%20${u}" target="_blank" rel="noopener">WhatsApp</a><a href="https://t.me/share/url?url=${u}&text=${q}" target="_blank" rel="noopener">Telegram</a><a href="https://twitter.com/intent/tweet?text=${q}&url=${u}" target="_blank" rel="noopener">X</a><a href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a><button type="button" id="copy">Copiar enlace</button></div>
${subsHtml}
</div></div>
${g.html || fichaHtml || trailerHtml ? `<div class="cols"><div>${trailerHtml}<section id="transcripcion" aria-labelledby="tg" style="padding:0">${g.html ? `<h2 id="tg" style="font-size:22px;margin-bottom:12px">Guion</h2>${g.sync ? '<p class="hint">Tocá un párrafo para saltar a ese momento del audio.</p>' : '<div style="height:12px"></div>'}${g.html}` : ""}</section></div>${fichaHtml}</div>` : ""}
</div>
${navEp}</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Minuto Cinéfilo</span><em>${esc(site.footerPhrase)}</em></div>
<div class="wrap tmdb"><img src="../../tmdb-logo.svg" alt="TMDB" height="12"><span>Este producto usa TMDB y las API de TMDB, pero no está avalado, certificado ni aprobado por TMDB. Datos de películas: <a href="https://www.themoviedb.org" target="_blank" rel="noopener">The Movie Database</a>.</span></div></footer>
${site.goatcounter ? `<script data-goatcounter="https://${esc(site.goatcounter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ""}
<script>${trk.replace("__RADIO__", JSON.stringify(site.radioUrl || "").replace(/</g, "\\u003c"))}</script>
${audio ? `<script>const W=${JSON.stringify(c.audio && ONDAS[c.audio] ? ONDAS[c.audio].p : null)};${client}</script>` : ""}
${yt ? `<script>${trl}</script>` : ""}
</body></html>`;
  mkdirSync(`capsulas/${c.id}`, { recursive: true });
  writeFileSync(`capsulas/${c.id}/index.html`, conCsp(html));
}
// ---- Feed de podcast (para Spotify, Apple Podcasts, etc.) ----
const pod = site.podcast;
if (pod?.email) {
  const rfc = (d, h) => new Date(d + "T" + (h || "09:00") + ":00-03:00").toUTCString();
  const abs = r => (/^https?:/.test(r) ? r : site.url + encodeURI(r));
  const durFeed = c => { if (c.duration) return c.duration; const d = ONDAS[c.audio]?.d; if (!d) return ""; const h = Math.floor(d / 3600), m = Math.floor(d % 3600 / 60), s = d % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`; }; // duración calculada al armar la onda de audio
  const items = reales.filter(c => publicado(c) && c.audio && !/^https?:/.test(c.audio) && existsSync(c.audio))
    .sort((a, b) => b.date.localeCompare(a.date) || (b.hora || "").localeCompare(a.hora || "") || (b.numero || 0) - (a.numero || 0))
    .map(c => `<item><title>${esc(c.title)}</title><description>${esc(sinAst(c.description))}</description><link>${site.url}capsulas/${c.id}/</link><guid isPermaLink="false">${esc((pod.guidBase || site.url) + c.id)}</guid><pubDate>${rfc(c.date, c.hora)}</pubDate><enclosure url="${abs(c.audio)}" length="${statSync(c.audio).size}" type="audio/mpeg"/><itunes:episode>${c.numero}</itunes:episode><itunes:episodeType>full</itunes:episodeType><itunes:explicit>false</itunes:explicit>${durFeed(c) ? `<itunes:duration>${esc(durFeed(c))}</itunes:duration>` : ""}</item>`).join("\n");
  writeFileSync("feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(pod.titulo || "Minuto Cinéfilo")}</title><link>${site.url}</link><language>es</language>
<description>${esc(site.about)}</description>
<atom:link href="${site.url}feed.xml" rel="self" type="application/rss+xml"/>
<itunes:author>${esc(pod.autor || "Radio Monk")}</itunes:author><itunes:explicit>false</itunes:explicit><itunes:type>episodic</itunes:type>
<itunes:owner><itunes:name>${esc(pod.autor || "Radio Monk")}</itunes:name><itunes:email>${esc(pod.email)}</itunes:email></itunes:owner>
<itunes:image href="${site.url}${esc(pod.imagen || "podcast.jpg")}"/>
<itunes:category text="${esc(pod.categoria || "TV & Film")}">${pod.subcategoria === "" ? "" : `<itunes:category text="${esc(pod.subcategoria || "Film History")}"/>`}</itunes:category>
${items}
</channel></rss>
`);
  console.log(`Feed: ${items ? items.split("</item>").length - 1 : 0} episodio(s) en feed.xml`);
} else console.log("Feed: falta site.podcast.email en capsulas.json; no se genera feed.xml");

mkdirSync("data", { recursive: true });
writeFileSync("data/fichas.json", JSON.stringify(fichas));
// ---- Próximos estrenos en Argentina (TMDB) ----
const yaHoy = existsSync("data/proximos.json") && (() => { try { return JSON.parse(readFileSync("data/proximos.json", "utf8")).actualizado === HOY; } catch { return false; } })();
if (KEY && !yaHoy) { // el build corre cada hora: los estrenos se renuevan una vez por día
  try {
    const hasta = new Date(Date.now() + 60 * 864e5).toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
    const url = `https://api.themoviedb.org/3/discover/movie?api_key=${KEY}&language=es-AR&region=US&with_release_type=2|3&release_date.gte=${HOY}&release_date.lte=${hasta}&sort_by=popularity.desc&include_adult=false`;
    const r = await (await fetch(url, { signal: AbortSignal.timeout(15000) })).json();
    const desde = new Date(Date.now() - 21 * 864e5).toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
    const propios = new Set(capsulas.map(c => c.tmdb_id).filter(Boolean));
    const cand = (r.results || []).filter(m => m.poster_path && !propios.has(m.id) && (m.release_date || "") >= desde).slice(0, 16); // se descartan reestrenos (fecha global vieja)
    const items = [];
    for (const m of cand) { // la fecha de "discover" es la global: se pide la de EEUU (estreno en cines o limitado)
      const d = await (await tfetch(`https://api.themoviedb.org/3/movie/${m.id}/release_dates?api_key=${KEY}`, { signal: AbortSignal.timeout(15000) })).json();
      const fechas = ((d.results || []).find(x => x.iso_3166_1 === "US")?.release_dates || []).filter(x => x.type === 2 || x.type === 3).map(x => x.release_date.slice(0, 10)).filter(x => x >= HOY).sort();
      if (fechas[0]) items.push({ id: m.id, title: m.title, date: fechas[0], poster: IMG + "w342" + m.poster_path });
    }
    items.sort((a, b) => a.date.localeCompare(b.date)); items.length = Math.min(items.length, 12);
    if (r.results) { writeFileSync("data/proximos.json", JSON.stringify({ actualizado: HOY, items })); console.log(`Próximos estrenos: ${items.length}`); }
  } catch (e) { console.log(`::warning::No se pudieron traer los próximos estrenos: ${e.message}`); }
}
// ---- Páginas de ciclo (/ciclos/<nombre>/): quedan APAGADAS hasta poner "paginasCiclos": true en site ----
if (site.paginasCiclos === true) {
  const slug = t => norm(t).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const grupos = {};
  asc.filter(publicado).filter(x => x.ciclo).forEach(x => { (grupos[x.ciclo] ||= []).push(x); });
  for (const [nombre, eps] of Object.entries(grupos)) {
    const sl = slug(nombre); if (!sl) continue;
    const pageUrl = `${site.url}ciclos/${sl}/`;
    const lista = eps.map(x => `<li><a href="../../capsulas/${esc(x.id)}/"><b>${esc(x.title)}</b><span>${x.numero ? "#" + esc(x.numero) + " · " : ""}${fecha(x.date)}${x.duration ? " · " + esc(x.duration) + " min" : ""}</span></a></li>`).join("");
    const desc = `Todas las cápsulas del ciclo ${nombre} de Minuto Cinéfilo (${eps.length}).`;
    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Ciclo ${esc(nombre)} | Minuto Cinéfilo</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website"><meta property="og:title" content="Ciclo ${esc(nombre)} — Minuto Cinéfilo"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${pageUrl}"><meta property="og:image" content="${site.url}og.png"><meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image"><meta name="color-scheme" content="dark">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml"><link rel="icon" href="../../favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="../../apple-touch-icon.png">${preco}${fonts}
<style>${css}.cic{list-style:none;padding:0;margin:32px 0 0;display:grid;gap:12px}.cic a{display:grid;gap:4px;border:1px solid #2a2f37;border-radius:6px;padding:16px 18px;text-decoration:none;color:inherit}.cic a:hover{border-color:var(--ink)}.cic b{font-size:18px}.cic span{color:var(--mute);font-size:14px}</style></head><body>
<header><div class="wrap"><a class="logo" href="../../">${REEL}MINUTO CINÉFILO</a>
<nav aria-label="Principal"><a href="../../">Inicio</a><a href="../../#archivo">Cápsulas</a><a href="../../#sobre">Sobre el proyecto</a><a href="../../prensa/">Prensa</a><a href="${esc(site.radioUrl)}" target="_blank" rel="noopener">Radio Monk</a><a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></nav></div></header>
<main><div class="wrap" style="padding-block:clamp(48px,8vw,112px);max-width:760px">
<a class="back" href="../../#archivo">← Todas las cápsulas</a>
<p class="label" style="margin-bottom:12px">Ciclo</p><h1 class="film" style="font-size:clamp(32px,5vw,56px)">${esc(nombre)}</h1>
<p style="color:var(--mute);margin-top:10px">${eps.length} ${eps.length === 1 ? "cápsula" : "cápsulas"}, de la más antigua a la más nueva.</p>
<ul class="cic">${lista}</ul></div></main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Minuto Cinéfilo</span><em>${esc(site.footerPhrase)}</em></div></footer>
${site.goatcounter ? `<script data-goatcounter="https://${esc(site.goatcounter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ""}
</body></html>`;
    mkdirSync(`ciclos/${sl}`, { recursive: true });
    writeFileSync(`ciclos/${sl}/index.html`, conCsp(html));
    urls.push(pageUrl);
  }
}
// ---- Página de prensa (/prensa/): presentación institucional para distribuidoras, cadenas de cine y prensa ----
// Los textos que cambian con el tiempo (programa de radio, plataformas, muestra, tiempo de respuesta) salen de "prensa" en capsulas.json.
// Si un campo queda vacío, la frase o el bloque que lo usa no aparece. No se publican nombres ni datos personales.
{
  const pageUrl = `${site.url}prensa/`;
  const pr = site.prensa || {};
  const ult = asc.filter(c => !c.demo && publicado(c)).reverse();
  const durMin = c => { const d = c.duration ? null : ONDAS[c.audio]?.d; if (c.duration) return c.duration; if (!d) return ""; return `${Math.floor(d / 60)}:${String(d % 60).padStart(2, "0")}`; };
  const fila = x => `<li><a href="../capsulas/${esc(x.id)}/"><b>${esc(x.title)}</b><span>${x.film && x.film !== x.title ? esc(x.film) + " · " : ""}${fecha(x.date)}</span></a></li>`;
  const sueltas = ult.filter(x => !x.ciclo).slice(0, 6).map(fila).join("");
  const deCiclo = ult.filter(x => x.ciclo).slice(0, 4).map(fila).join("");
  // cápsula de muestra: la indicada en prensa.muestra si ya está publicada y tiene audio propio; si no, la última publicada (y el build avisa)
  const conAudio = c => c && c.audio && !/^https?:/.test(c.audio) && existsSync(c.audio);
  let muestra = ult.find(x => x.id === pr.muestra);
  if (!conAudio(muestra)) {
    if (pr.muestra) console.log(`::warning::prensa.muestra "${pr.muestra}" no está publicada o no tiene audio propio; se usa la última cápsula publicada.`);
    muestra = ult.find(conAudio);
  }
  const mail = esc((site.podcast && site.podcast.email) || "");
  const prog = String(pr.programa || "").trim(), radio = String(pr.radio || "").trim();
  const quienDe = prog ? ` de ${esc(prog)}${radio ? `, el programa que se emite en ${esc(radio)}` : ""}` : "";
  const origen = prog ? `Nació en <b>${esc(prog)}</b>${pr.programaDetalle ? `, ${esc(pr.programaDetalle)}` : ""}${radio ? `, por <b>${esc(radio)}</b>${pr.radioDetalle ? `, ${esc(pr.radioDetalle)}` : ""}` : ""}.` : "";
  const desc = "Presentación de Minuto Cinéfilo para distribuidoras, cadenas de cine y prensa: qué hacemos, cómo trabajamos, material para descargar y contacto.";
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Prensa | Minuto Cinéfilo</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${pageUrl}">
<meta property="og:type" content="website"><meta property="og:title" content="Prensa — Minuto Cinéfilo"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${pageUrl}"><meta property="og:image" content="${site.url}og.png"><meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image"><meta name="color-scheme" content="dark">
<link rel="icon" href="../favicon.svg" type="image/svg+xml"><link rel="icon" href="../favicon-32.png" sizes="32x32" type="image/png"><link rel="apple-touch-icon" href="../apple-touch-icon.png">${preco}${fonts}
<style>${css}.pr section{padding-block:clamp(32px,5vw,56px);border-top:1px solid var(--line)}.pr .hero{border-top:0;padding-top:clamp(40px,7vw,96px)}.pr h2{font-size:clamp(24px,3vw,34px);margin-bottom:16px}.pr p{color:#cfd3d8;max-width:62ch}.pr .lead{font-size:19px;margin-top:20px;color:var(--ink)}
.pr .cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.pr .btn{display:inline-block;padding:12px 20px;border-radius:999px;font-weight:700;font-size:15px;text-decoration:none;background:var(--red);color:#fff}.pr .btn.o{background:none;border:1px solid #3a444f;color:var(--ink)}
.pr .cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.pr .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px}.pr .card h3{font:700 17px/1.2 var(--serif);margin-bottom:8px}.pr .card p{font-size:15px;color:var(--mute)}
.pr .rec{list-style:none;padding:0;display:grid;gap:10px}.pr .rec a{display:grid;gap:2px;border:1px solid #2a2f37;border-radius:6px;padding:14px 18px;text-decoration:none}.pr .rec a:hover{border-color:var(--ink)}.pr .rec span{color:var(--mute);font-size:14px}.pr h3.sub{font:700 17px/1.2 var(--serif);margin:24px 0 12px}
.pr .kit{display:flex;flex-wrap:wrap;gap:12px}.pr .kit a{display:grid;gap:2px;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 18px;text-decoration:none;font-size:15px}.pr .kit a:hover{border-color:var(--ink)}.pr .kit small{color:var(--mute);font-size:12px}
.pr .mail{font:800 clamp(15px,4.6vw,28px)/1.2 var(--serif);color:var(--ink);display:inline-block;max-width:100%;overflow-wrap:anywhere;margin:-6px 0 -12px;padding-block:12px}
.pr .quien{color:var(--mute);margin-top:22px;font-size:15px}.pr .pasos{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;counter-reset:p}.pr .pasos li{counter-increment:p;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;display:grid;gap:6px}.pr .pasos li::before{content:counter(p);font:800 28px/1 var(--serif);color:var(--red-hi)}.pr .pasos b{font:700 17px/1.2 var(--serif)}.pr .pasos span{color:var(--mute);font-size:15px}
.pr .muestra{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:20px;max-width:640px}.pr .muestra h3{font:700 19px/1.2 var(--serif)}.pr .muestra .m{color:var(--mute);font-size:14px;margin:4px 0 14px}.pr .muestra audio{display:block;width:100%;height:44px}.pr .muestra .l{margin-top:14px;font-size:15px}.pr .nota{font-size:14px;color:var(--mute)}.pr .aparte{margin-top:16px}</style></head><body>
<header><div class="wrap"><a class="logo" href="../">${REEL}MINUTO CINÉFILO</a>
<nav aria-label="Principal"><a href="../">Inicio</a><a href="../#archivo">Cápsulas</a><a href="../#sobre">Sobre el proyecto</a><a class="on" href="./" aria-current="page">Prensa</a><a href="${esc(site.radioUrl)}" target="_blank" rel="noopener">Radio Monk</a><a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener">Instagram</a></nav></div></header>
<main class="pr">
<section class="hero"><div class="wrap">
<p class="label">Prensa</p>
<h1 class="film" style="font-size:clamp(34px,5vw,58px);max-width:16ch">El cine, en pocos minutos.</h1>
<p class="lead">Minuto Cinéfilo son cápsulas de audio de 2 a 4 minutos sobre películas: historias, curiosidades y decisiones creativas. Un proyecto independiente y sin fines de lucro${quienDe}.</p>
<div class="cta"><a class="btn" href="mailto:${mail}">Escribinos</a>${muestra ? `<a class="btn o" href="#muestra">Escuchar una cápsula</a>` : ""}</div>
</div></section>
<section><div class="wrap"><p class="label">Quiénes somos</p><h2>Un medio de cine en audio</h2>
<p>Minuto Cinéfilo tiene dirección editorial propia: hay un equipo responsable de cada cápsula y de las respuestas a la prensa. ${origen}</p>
${pr.plataformas ? `<p class="aparte">Publicamos en ${esc(pr.plataformas)} (@somosminutocinefilo). Hacemos contenido breve, claro y fácil de entender, para quienes quieren conocer una película en pocos minutos.</p>` : `<p class="aparte">Hacemos contenido breve, claro y fácil de entender, para quienes quieren conocer una película en pocos minutos.</p>`}
</div></section>
${muestra ? `<section id="muestra"><div class="wrap"><p class="label">Escuchá una cápsula</p><h2>Una muestra de nuestro trabajo</h2>
<div class="muestra"><h3>${esc(muestra.title)}</h3><p class="m">${muestra.film && muestra.film !== muestra.title ? esc(muestra.film) + " · " : ""}${fecha(muestra.date)}${durMin(muestra) ? " · " + esc(durMin(muestra)) + " min" : ""}</p>
<audio controls preload="none" src="../${encodeURI(muestra.audio)}" aria-label="Cápsula ${esc(muestra.title)}"></audio>
<p class="l"><a href="../capsulas/${esc(muestra.id)}/">Ver la página de la cápsula y leer el guion →</a></p></div>
<p class="nota" style="margin-top:14px">Las cápsulas se narran con voz generada por inteligencia artificial. Los textos y la edición son del equipo de Minuto Cinéfilo.</p></div></section>` : ""}
<section><div class="wrap"><p class="label">Qué hacemos</p><h2>Coberturas que ofrecemos</h2>
<div class="cols">
<div class="card"><h3>Cápsula de estreno</h3><p>Una pieza de 2 a 4 minutos sobre la película, publicada en la web y en las plataformas de audio.</p></div>
<div class="card"><h3>Avant premières y funciones de prensa</h3><p>Cobertura de la función con cápsula y publicaciones en redes.</p></div>
<div class="card"><h3>Eventos</h3><p>Presentaciones, ciclos y actividades de cine, con cápsula y presencia en redes.</p></div>
<div class="card"><h3>Entrevistas</h3><p>Conversaciones con equipos de las películas, a coordinar según el caso.</p></div>
<div class="card"><h3>Presencia en redes</h3><p>Publicaciones en Instagram, con mención a la distribuidora, la sala o el evento.</p></div>
${prog ? `<div class="card"><h3>Difusión en radio</h3><p>Las cápsulas se emiten en ${esc(prog)}${radio ? `, por ${esc(radio)}` : ""}.</p></div>` : ""}
</div></div></section>
<section><div class="wrap"><p class="label">Línea editorial</p><h2>Reseña independiente, no pieza de difusión</h2>
<p>Una invitación nos permite ver la película y contarla; no condiciona lo que decimos. Nuestras cápsulas son editoriales y reflejan lo que nos pareció cada película. No ofrecemos coberturas favorables a cambio de invitaciones.</p>
<p class="aparte">Si alguna vez publicáramos contenido acordado con una marca o una distribuidora, lo indicaríamos expresamente como tal.</p></div></section>
<section><div class="wrap"><p class="label">Cómo trabajamos</p><h2>Primero la película, después la cápsula</h2>
<ol class="pasos"><li><b>Vemos la película.</b><span>En la sala, en una función de prensa o en un evento.</span></li><li><b>Armamos el guion.</b><span>Con nuestra mirada y datos verificados sobre la película.</span></li><li><b>Publicamos.</b><span>El día del estreno o, como máximo, al día siguiente: en la web, las plataformas de audio y las redes.</span></li></ol>
<p class="aparte">Para coordinar fechas y horarios nos sirve conocer el día del estreno y el de la función. Tráiler, afiche, ficha técnica y fotos de prensa nos ayudan a preparar la cápsula y las publicaciones.</p></div></section>
${sueltas ? `<section><div class="wrap"><p class="label">Últimas cápsulas</p><h2>Lo último que publicamos</h2><ul class="rec">${sueltas}</ul>${deCiclo ? `<h3 class="sub">Ciclos y especiales</h3><ul class="rec">${deCiclo}</ul>` : ""}<p style="margin-top:16px"><a href="../#archivo">Ver todas las cápsulas →</a></p></div></section>` : ""}
<section><div class="wrap"><p class="label">Material de prensa</p><h2>Logo para descargar</h2>
<div class="kit"><a href="logo-minuto-cinefilo-fondo-blanco.png" download>Logo (PNG)<small>Sobre fondo blanco</small></a><a href="logo-minuto-cinefilo-transparente.png" download>Logo (PNG)<small>Fondo transparente</small></a><a href="../favicon.svg" download>Carrete (SVG)<small>Ícono vectorial</small></a></div></div></section>
<section><div class="wrap"><p class="label">Contacto</p><h2>Hablemos</h2>
<p>Para invitaciones a funciones de prensa, avant premières, eventos y entrevistas, escribinos a:</p>
<a class="mail" href="mailto:${mail}">${mail}</a>
${pr.respuesta ? `<p class="aparte">${esc(pr.respuesta)}</p>` : ""}
<p class="aparte">También por Instagram: <a href="${esc(site.instagramUrl)}" target="_blank" rel="noopener">@somosminutocinefilo</a></p></div></section>
</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Minuto Cinéfilo</span><em>${esc(site.footerPhrase)}</em></div></footer>
${site.goatcounter ? `<script data-goatcounter="https://${esc(site.goatcounter)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ""}
</body></html>`;
  mkdirSync("prensa", { recursive: true });
  writeFileSync("prensa/index.html", conCsp(html));
  urls.push(pageUrl);
}
{ // lista estática de episodios publicados dentro de <noscript> en la home (para quien no corre JS)
  const lista = asc.filter(publicado).reverse().map(x => `<li><a href="capsulas/${x.id}/">${esc(x.title)}</a> — ${esc(x.film || "")}</li>`).join("");
  const idx = readFileSync("index.html", "utf8");
  const hayProx = asc.some(x => !x.demo && !publicado(x)); // hay un episodio agendado: la home reserva el lugar del aviso "Próximamente" para que no salte
  const nuevo = idx.replace(/<!--SEO-LIST-->[\s\S]*?<!--\/SEO-LIST-->/, `<!--SEO-LIST--><ul>${lista}</ul><!--/SEO-LIST-->`)
    .replace(/<body class="cargando(?: hay-prox)?">/, `<body class="cargando${hayProx ? " hay-prox" : ""}">`);
  if (nuevo !== idx) writeFileSync("index.html", nuevo);
}
writeFileSync("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc></url>`).join("\n")}\n</urlset>\n`);
writeFileSync("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${site.url}sitemap.xml\n`);
if (tarjetasFallidas.length) {
  console.log(`::error::${tarjetasFallidas.length} tarjeta(s) para compartir sin generar: ${tarjetasFallidas.join(" | ")}`);
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Tarjetas para compartir sin generar\n${tarjetasFallidas.map(m => "- " + m).join("\n")}\n\nLas páginas se publicaron igual, pero al compartirlas en redes se usa una imagen de reserva.\n`, { flag: "a" });
}
console.log(`OK: ${urls.length - 1} página(s) generadas`);
