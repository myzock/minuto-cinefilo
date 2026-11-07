let SITE, CAPSULAS, FICHAS = {}, ONDAS = {}, sorted, current = null, audio = null, showAll = false, genre = "", ciclo = "", PROX = [], autoNext = true;
try { autoNext = localStorage.getItem("autoNext") !== "0"; } catch(e) {}
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const whBlock = w => (!w || !w.items || !w.items.length) ? "" : `<div class="wh"><p class="k">Dónde verla en Argentina</p><div class="pills">${w.items.map(i => `<a class="ver" data-p="${esc(i.n)}" href="${esc(w.link)}" target="_blank" rel="noopener">${esc(i.t)}</a>`).join("")}</div><p class="src">Fuente: <a href="https://www.justwatch.com" target="_blank" rel="noopener">JustWatch</a></p></div>`;
const fmtDate = iso => new Date(iso + "T12:00:00").toLocaleDateString("es-AR", {day:"numeric", month:"long", year:"numeric"});
const fmtTime = t => isFinite(t) ? Math.floor(t/60) + ":" + String(Math.floor(t%60)).padStart(2,"0") : "0:00";
const norm = s => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const page = c => c.demo ? null : "capsulas/" + encodeURIComponent(c.id) + "/";
const fich = c => FICHAS[c.id];
// Tamaños de imagen de TMDB según uso: el fondo desenfocado no necesita resolución, y en celular alcanza con 780 px.
const bgSmall = u => String(u).replace("image.tmdb.org/t/p/w1280/", "image.tmdb.org/t/p/w300/").replace("image.tmdb.org/t/p/w500/", "image.tmdb.org/t/p/w342/");
const heroSize = u => matchMedia("(max-width:760px)").matches ? String(u).replace("image.tmdb.org/t/p/w1280/", "image.tmdb.org/t/p/w780/") : u;
const thumb = u => String(u).replace("image.tmdb.org/t/p/w500/", "image.tmdb.org/t/p/w342/"); // miniaturas: no hace falta el tamaño grande
const ic = d => '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const I = {
  cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  tag:'<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="15.5" cy="8.5" r="1.2"/>',
  film:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v16M16 4v16M4 9h4M4 15h4M16 9h4M16 15h4"/>',
  lang:'<path d="M4 6h9M8.5 4v2M6 6c0 4 3 7 6.5 8M11 6c0 3-2.5 6.5-6 8"/><path d="M13 20l4-9 4 9M14.5 17h5"/>',
  flag:'<path d="M5 21V4M5 5h11l-2 4 2 4H5"/>',
  user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
  award:'<circle cx="12" cy="9" r="5"/><path d="M9 13.5L7.5 21l4.5-2.5 4.5 2.5L15 13.5"/>',
  mask:'<path d="M4 5h16v6c0 5-3.5 8-8 8s-8-3-8-8z"/><path d="M9 10v1M15 10v1M9.5 14.5c1.5 1.2 3.5 1.2 5 0"/>'
};
const I_PLAY = '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>';

Promise.all([
  fetch("capsulas.json").then(r => { if(!r.ok) throw 0; return r.json(); }),
  fetch("data/fichas.json").then(r => r.ok ? r.json() : {}).catch(() => ({})),
  fetch("data/ondas.json").then(r => r.ok ? r.json() : {}).catch(() => ({}))
]).then(([d, f, o]) => {
    SITE = d.site; FICHAS = f || {}; ONDAS = o || {};
    const hoy = new Date().toLocaleDateString("sv-SE", {timeZone: "America/Argentina/Buenos_Aires"});
    const hm = new Date().toLocaleTimeString("en-GB", {timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
    const orden = d.capsulas.filter(c => !c.demo).sort((a, b) => a.date.localeCompare(b.date) || (a.hora || "").localeCompare(b.hora || ""));
    d.capsulas.forEach(c => {
      const x = FICHAS[c.id] || {};
      if(!c.numero && !c.demo) c.numero = orden.indexOf(c) + 1;
      c.poster = c.poster || x.poster || ""; c.backdrop = c.backdrop || x.backdrop || ""; c.film = c.film || x.title || "";
    });
    const pub = c => c.date < hoy || (c.date === hoy && (!c.hora || c.hora <= hm));
    CAPSULAS = d.capsulas.filter(pub);
    PROX = d.capsulas.filter(c => !c.demo && !pub(c)).sort((a, b) => a.date.localeCompare(b.date) || (a.hora || "").localeCompare(b.hora || ""));
    init(); })
  .catch(() => { $("#latest").innerHTML = '<p class="empty" style="padding:32px">No se pudieron cargar las cápsulas. Probá recargar la página.</p>'; });

function init(){
  sorted = [...CAPSULAS].sort((a,b) => b.date.localeCompare(a.date) || (b.hora||"").localeCompare(a.hora||"") || (b.numero||0) - (a.numero||0));
  current = sorted[0];
  $("#lnkIg").href = $("#lnkIg2").href = SITE.instagramUrl; ["lnkRadio","lnkRadio2"].forEach(id => $("#"+id).href = SITE.radioUrl);
  $("#aboutText").textContent = SITE.about; $("#fraseFooter").textContent = SITE.footerPhrase;
  $("#year").textContent = new Date().getFullYear();
  const soc = [["Instagram",SITE.instagramUrl],["Radio Monk",SITE.radioUrl],["YouTube",SITE.youtubeUrl],["Spotify",SITE.spotifyUrl],["Apple Podcasts",SITE.appleUrl],["YouTube Music",SITE.youtubeMusicUrl],["Amazon Music",SITE.amazonUrl],["RSS","feed.xml"],["X",SITE.xUrl]].filter(x => x[1]);
  const lk = soc.map(([n,u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("");
  const em = SITE.podcast && SITE.podcast.email, ct = em ? `<a href="mailto:${esc(em)}">Contacto</a>` : "";
  $("#socialLinks").innerHTML = lk; $("#footLinks").innerHTML = lk + ct;
  if (SITE.goatcounter && /^[a-z0-9-]+$/i.test(SITE.goatcounter)) { const g = document.createElement("script"); g.async = true; g.src = "https://gc.zgo.at/count.js"; g.dataset.goatcounter = "https://" + SITE.goatcounter + ".goatcounter.com/count"; document.head.appendChild(g); }
  renderHero(); renderFeatured(); renderList(); renderCats(); renderCiclos(); renderProx(); renderStats(); renderCinta();
  fetch("data/proximos.json").then(r => r.ok ? r.json() : null).then(d => {
    if (!d || !d.items || !d.items.length) return;
    $("#estrList").innerHTML = d.items.map(m => `<li><a href="https://www.themoviedb.org/movie/${esc(m.id)}" target="_blank" rel="noopener"><img src="${esc(m.poster)}" alt="Póster de ${esc(m.title)}" loading="lazy" width="150" height="225"><b>${esc(m.title)}</b><time datetime="${esc(m.date)}">${new Date(m.date + "T12:00:00").toLocaleDateString("es-AR", {day: "numeric", month: "long"})}</time></a></li>`).join("");
    $("#estrenos").hidden = false;
    const ul = $("#estrList"), pv = $("#estrPrev"), nx = $("#estrNext");
    const paso = () => (ul.querySelector("li")?.offsetWidth || 150) + 16;
    const edge = () => { pv.hidden = ul.scrollLeft < 8; nx.hidden = ul.scrollLeft + ul.clientWidth >= ul.scrollWidth - 8; };
    const mover = dir => { const fin = ul.scrollLeft + ul.clientWidth >= ul.scrollWidth - 8; if (dir > 0 && fin) ul.scrollTo({left: 0}); else ul.scrollBy({left: dir * paso() * 2}); };
    pv.onclick = () => mover(-1); nx.onclick = () => mover(1);
    ul.addEventListener("scroll", edge, {passive: true}); window.addEventListener("resize", edge); edge();
    // avance automático lento: se frena al pasar el mouse, tocar, enfocar o si la persona prefiere menos movimiento
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      let pausa = false, visible = false, t;
      const w = ul.parentElement;
      ["mouseenter","focusin","touchstart"].forEach(e => w.addEventListener(e, () => pausa = true, {passive: true}));
      ["mouseleave","focusout"].forEach(e => w.addEventListener(e, () => pausa = false));
      w.addEventListener("touchend", () => setTimeout(() => pausa = false, 6000), {passive: true});
      new IntersectionObserver(en => visible = en[0].isIntersecting).observe(w);
      t = setInterval(() => { if (!pausa && visible && !document.hidden && ul.scrollWidth > ul.clientWidth + 8) mover(1); }, 4000);
    }
  }).catch(() => {});
}

function renderHero(){
  const c = sorted[0]; if(!c) return;
  if(!c.audio) $("#heroTxt").textContent = "Explorar las cápsulas";
  if(c.backdrop){
    const img = new Image(); img.alt = ""; img.decoding = "async";
    img.onload = () => {
      $("#heroBg").replaceChildren(img); $("#inicio").classList.remove("noimg");
      const y = fich(c)?.year;
      $("#heroCredit").innerHTML = "<em>" + esc(c.film) + (y ? " (" + esc(y) + ")" : "") + "</em><br>" + (c.numero ? "Cápsula #" + esc(c.numero) + " · " : "") + "Imagen: TMDB";
    };
    img.src = heroSize(c.backdrop);
  }
}

function score(f, small){ return f && f.vote_count >= 20 && f.vote_average ? `<span class="score" title="Puntaje de los usuarios de TMDB (${esc(f.vote_count)} votos)">★ ${Number(f.vote_average).toFixed(1)} <small>TMDB</small></span>` : ""; }
function charlaBox(c){ return c.charla && /^https:\/\//.test(c.charla) ? `<a class="charla" href="${esc(c.charla)}" target="_blank" rel="noopener"><span><b>¿Querés más?</b> Escuchá la charla completa sobre ${esc(c.film || c.title)}</span><em>Spotify ↗</em></a>` : ""; }
function listenRow(){
  const l = [["Spotify",SITE.spotifyUrl],["Apple Podcasts",SITE.appleUrl],["YouTube Music",SITE.youtubeMusicUrl],["Amazon Music",SITE.amazonUrl]].filter(x => x[1]);
  return `<div class="listen"><span>Escuchá en</span>${l.map(([n,u]) => `<a href="${esc(u)}" target="_blank" rel="noopener">${n}</a>`).join("")}<a href="feed.xml">RSS</a></div>`;
}
function renderFeatured(){
  const c = current, box = $("#latest");
  if(!c){ box.innerHTML = '<p class="empty" style="padding:32px">Todavía no hay cápsulas publicadas.</p>'; return; }
  const f = fich(c);
  box.className = "feat" + (f ? "" : " solo");
  const poster = (c.poster ? `<img src="${esc(c.poster)}" alt="Póster de ${esc(c.film)}">` : "<span>Póster no disponible</span>") + score(f) + (c.ciclo ? `<span class="ciclo">${esc(c.ciclo)}</span>` : "");
  const chips = [[I.cal, f?.year], [I.clock, `<span ${c.audio ? `data-dur="${esc(c.audio)}"` : ""}>${c.duration ? esc(c.duration) + " min" : ""}</span>`], [I.tag, (f?.genres || []).slice(0, 2).join(" / ")]].filter(x => x[1]).map(x => `<span>${ic(x[0])}${x[1]}</span>`).join("");
  const fh = f ? `<aside class="fh" aria-labelledby="fh-t"><h3 id="fh-t">Datos de la película <span>TMDB</span></h3><dl>
    ${[["Título original", f.original_title && f.original_title !== f.title ? f.original_title : "", I.film],["Título en español", f.title, I.lang],["Año", f.year, I.cal],["Duración", f.runtime ? Math.floor(f.runtime/60) + " h " + (f.runtime%60) + " min" : "", I.clock],["País", f.country, I.flag],["Director", f.director, I.award],["Reparto principal", f.cast, I.user],["Géneros", (f.genres||[]).join(", "), I.mask]].filter(r => r[1]).map(r => `<div class="r"><dt>${ic(r[2])}${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join("")}</dl>
    ${whBlock(f.watch)}
    ${f.tmdb_id ? `<a class="btn" href="https://www.themoviedb.org/movie/${esc(f.tmdb_id)}" target="_blank" rel="noopener">Ver en TMDB ↗</a>` : ""}</aside>` : "";
  box.innerHTML = `<div class="feat-main"><div class="poster">${poster}</div><div>
    <p class="label">${c === sorted[0] ? "Cápsula destacada" : "Cápsula"}${c.numero ? " · #" + esc(c.numero) : ""}</p>
    ${c.demo ? '<span class="badge">Contenido de ejemplo</span>' : ""}
    <h2 class="film">${page(c) ? `<a href="${page(c)}" style="text-decoration:none">${esc(c.title)}</a>` : esc(c.title)}</h2>
    ${(c.subtitle || c.film) && norm(c.subtitle || c.film) !== norm(c.title) ? `<p class="sub">${esc(c.subtitle || c.film)}</p>` : ""}
    <div class="chips">${chips}</div>
    <p class="desc">${esc(c.description).replace(/\*([^*\n]+)\*/g, "<em>$1</em>")}</p>
    <div class="bar" role="group" aria-label="Reproductor de ${esc(c.title)}">
      <button class="play" id="play" aria-pressed="false" aria-label="Reproducir">${I_PLAY}</button>
      <span class="time" id="cur">0:00</span>
      <div class="wavebox" id="wavebox"><canvas id="wave" aria-hidden="true"></canvas><input type="range" id="seek" min="0" max="100" step="0.1" value="0" aria-label="Posición del audio"></div>
      <span class="time" id="tot">${esc(c.duration || "--:--")}</span>
      <label class="vol" title="Volumen">${ic('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7"/>')}<input type="range" id="vol" min="0" max="1" step="0.05" value="1" aria-label="Volumen"></label>
    </div>
    <p class="note" id="note" role="status"></p>
    <div class="tools">
      ${page(c) ? `<a href="${page(c)}${c.transcript ? "#transcripcion" : ""}">${ic('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M9.5 12h5M9.5 16h5"/>')}${c.transcript ? "Guion" : "Ver cápsula"}</a>` : ""}
      ${f?.tmdb_id ? `<a href="https://www.themoviedb.org/movie/${esc(f.tmdb_id)}" target="_blank" rel="noopener">${ic('<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="15.5" cy="8.5" r="1.2"/>')}TMDB</a>` : ""}
      <button type="button" id="nextBtn" title="Reproducir la siguiente cápsula de la lista">Siguiente cápsula ${ic('<path d="M9 6l6 6-6 6"/>')}</button>
      <button type="button" id="autoBtn" role="switch" aria-checked="${autoNext}" title="Al terminar una cápsula, pasa sola a la siguiente de la lista"><span class="sw" aria-hidden="true"></span>Reproducción automática</button>
      <button type="button" id="shareBtn" aria-expanded="false" aria-controls="share">${ic('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>')}Compartir</button>
    </div>
    ${listenRow()}
    ${charlaBox(c)}
    <div class="share" id="share"></div>
    </div></div>${fh}`;
  $("#nextBtn").onclick = () => { const n = siguiente(); if(n){ track("siguiente-manual/" + n.id); listen(n.id, true); } };
  if(!siguiente()) $("#nextBtn").hidden = true;
  $("#autoBtn").onclick = () => { autoNext = !autoNext; track("autoplay/" + (autoNext ? "on" : "off")); $("#autoBtn").setAttribute("aria-checked", autoNext); try { localStorage.setItem("autoNext", autoNext ? "1" : "0"); } catch(e) {} };
  $("#shareBtn").onclick = () => { const o = $("#share").classList.toggle("open"); $("#shareBtn").setAttribute("aria-expanded", o); };
  renderShare(c); setupPlayer(c); fillDurations(); setBg(bgSmall(c.backdrop || c.poster));
}

function renderShare(c){
  const base = location.origin + location.pathname.replace(/[^/]*$/, "");
  const url = c.demo ? base : base + "capsulas/" + encodeURIComponent(c.id) + "/";
  const t = encodeURIComponent("Escuchá «" + c.film + "» en Minuto Cinéfilo"), u = encodeURIComponent(url);
  const links = [["WhatsApp","https://wa.me/?text=" + t + "%20" + u],["Telegram","https://t.me/share/url?url=" + u + "&text=" + t],["X","https://twitter.com/intent/tweet?text=" + t + "&url=" + u],["Facebook","https://www.facebook.com/sharer/sharer.php?u=" + u]];
  $("#share").innerHTML = links.map(([n,h]) => `<a href="${h}" target="_blank" rel="noopener">${n}</a>`).join("") + '<button type="button" id="copy">Copiar enlace</button>';
  $("#copy").onclick = async () => { try { await navigator.clipboard.writeText(url); $("#copy").textContent = "¡Copiado!"; } catch { prompt("Copiá el enlace:", url); } };
}

function setupPlayer(c){
  audio = $("#audio"); const play = $("#play"), seek = $("#seek"), cur = $("#cur"), tot = $("#tot"), note = $("#note"), vol = $("#vol");
  const peaks = ONDAS[c.audio]?.p, wb = $("#wavebox"), cv = $("#wave");
  const dw = () => { if(!peaks || !cv) return; const d = devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight; if(!w) return; cv.width = w * d; cv.height = h * d; const x = cv.getContext("2d"); x.scale(d, d); const n = peaks.length, s = w / n, f = seek.value / 100; for(let i = 0; i < n; i++){ const bh = Math.max(3, peaks[i] / 100 * h); x.fillStyle = (i + .5) / n <= f ? "#ef4d44" : "#3a424d"; x.beginPath(); x.roundRect ? x.roundRect(i * s + s * .18, (h - bh) / 2, s * .64, bh, 2) : x.rect(i * s + s * .18, (h - bh) / 2, s * .64, bh); x.fill(); } };
  if(peaks && wb){ wb.classList.add("on"); if(window.__dw) removeEventListener("resize", window.__dw); window.__dw = dw; addEventListener("resize", dw); }
  const setP = () => { seek.style.setProperty("--p", seek.value + "%"); dw(); };
  setP();
  if(!c.audio){ audio.pause(); audio.removeAttribute("src"); audio.load(); play.disabled = seek.disabled = true; note.textContent = "El audio de esta cápsula todavía no está disponible."; return; }
  audio.src = c.audio; mediaSession(c);
  play.onclick = () => audio.paused ? audio.play().catch(() => { note.textContent = "No se pudo reproducir el audio. Revisá la ruta del archivo."; }) : audio.pause();
  audio.onplay = () => { play.setAttribute("aria-pressed","true"); play.setAttribute("aria-label","Pausar"); };
  audio.onpause = audio.onended = () => { play.setAttribute("aria-pressed","false"); play.setAttribute("aria-label","Reproducir"); };
  audio.ontimeupdate = () => { if(audio.duration){ seek.value = audio.currentTime / audio.duration * 100; setP(); cur.textContent = fmtTime(audio.currentTime); } };
  audio.onloadedmetadata = () => tot.textContent = fmtTime(audio.duration);
  audio.onerror = () => { note.textContent = "No se pudo cargar el audio. Revisá la ruta del archivo."; play.disabled = true; };
  seek.oninput = () => { if(audio.duration) audio.currentTime = seek.value / 100 * audio.duration; setP(); };
  vol.oninput = () => { audio.volume = vol.value; };
}

function fillDurations(){
  // la duración sale de data/ondas.json (la calcula el build): no se descarga ningún audio para mostrarla
  document.querySelectorAll("[data-dur]").forEach(el => {
    const d = ONDAS[el.dataset.dur]?.d;
    if(d) el.textContent = fmtTime(d) + " min";
  });
}

function renderList(){
  const q = norm($("#q").value.trim());
  const rows = sorted.filter(c => ciclo || c !== current).filter(c => !ciclo || c.ciclo === ciclo).filter(c => !genre || (fich(c)?.genres || []).includes(genre)).filter(c => !q || norm(c.title + " " + c.film).includes(q));
  const full = q || genre || ciclo || showAll, shown = full ? rows : rows.slice(0, 7);
  $("#listTitle").textContent = q ? "Resultados" : ciclo ? "Ciclo " + ciclo : genre ? genre : "Últimas cápsulas";
  $("#list").innerHTML = shown.map(c => {
    const f = fich(c);
    return `<li class="item"><div class="thumb" data-id="${esc(c.id)}">${c.poster ? `<img src="${esc(thumb(c.poster))}" alt="" loading="lazy">` : "Sin imagen"}</div>
      <div>${c.numero || c.ciclo ? `<p class="no">${c.numero ? "#" + esc(c.numero) : ""}${c.numero && c.ciclo ? " · " : ""}${c.ciclo ? `<span style="color:var(--red-hi);font-weight:700;letter-spacing:.08em;text-transform:uppercase">${esc(c.ciclo)}</span>` : ""}</p>` : ""}<h4>${page(c) ? `<a href="${page(c)}">${esc(c.title)}</a>` : esc(c.title)}</h4>
      <p class="s"><span>${esc(c.film)}</span>${f?.year ? `<span>${esc(f.year)}</span>` : ""}${f && f.vote_count >= 20 && f.vote_average ? `<span class="rate">★ ${Number(f.vote_average).toFixed(1)}</span>` : ""}<span ${c.audio ? `data-dur="${esc(c.audio)}"` : ""}>${c.duration ? esc(c.duration) + " min" : ""}</span></p></div>
      <button class="rowplay" data-id="${esc(c.id)}" aria-label="Escuchar ${esc(c.title)}">${ic('<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>')}</button></li>`;
  }).join("");
  $("#empty").hidden = rows.length > 0; $("#more").hidden = full || rows.length <= shown.length;
  fillDurations();
}

function renderCats(){
  const m = {}; CAPSULAS.filter(c => !c.demo).forEach(c => (fich(c)?.genres || []).forEach(g => m[g] = (m[g] || 0) + 1));
  const gs = Object.keys(m).sort((a,b) => m[b] - m[a]);
  $("#catsPanel").hidden = !gs.length;
  $("#cats").innerHTML = gs.map(g => `<button class="cat${g === genre ? " on" : ""}" type="button" data-g="${esc(g)}" aria-pressed="${g === genre}">${esc(g)}<small>${m[g]}</small></button>`).join("");
}

function renderCiclos(){
  const m = {}; CAPSULAS.filter(c => !c.demo && c.ciclo).forEach(c => m[c.ciclo] = (m[c.ciclo] || 0) + 1);
  const cs = Object.keys(m).sort((a,b) => m[b] - m[a] || a.localeCompare(b));
  $("#ciclosPanel").hidden = !cs.length;
  $("#ciclos").innerHTML = cs.map(g => `<button class="cat${g === ciclo ? " on" : ""}" type="button" data-c="${esc(g)}" aria-pressed="${g === ciclo}">${esc(g)}<small>${m[g]}</small></button>`).join("");
}
function renderProx(){
  const box = $("#prox"), c = PROX[0];
  if(!c){ box.hidden = true; return; }
  const p = c.date.split("-").map(Number), [hh, mm] = c.hora ? c.hora.split(":").map(Number) : [null, null];
  const ini = c.hora ? new Date(c.date + "T" + c.hora + ":00-03:00") : null;
  if(c.date > new Date(Date.now() + 30*864e5).toISOString().slice(0,10)){ box.hidden = true; return; } // solo si falta menos de un mes
  const dia = new Date(c.date + "T12:00:00").toLocaleDateString("es-AR", {weekday:"long", day:"numeric", month:"long"});
  const cuando = dia.charAt(0).toUpperCase() + dia.slice(1) + (c.hora ? " · " + c.hora + " hs" : "");
  const z = n => String(n).padStart(2,"0"), fz = d => d.getUTCFullYear() + z(d.getUTCMonth()+1) + z(d.getUTCDate()) + "T" + z(d.getUTCHours()) + z(d.getUTCMinutes()) + "00Z";
  const dia8 = d => d.getUTCFullYear() + z(d.getUTCMonth()+1) + z(d.getUTCDate());
  let a, b;
  if(ini){ a = fz(ini); b = fz(new Date(ini.getTime() + 15*60000)); }
  else { const d0 = new Date(Date.UTC(p[0], p[1]-1, p[2])); a = dia8(d0); b = dia8(new Date(d0.getTime() + 864e5)); }
  const titulo = "Minuto Cinéfilo: " + c.title, det = "Nueva cápsula de Minuto Cinéfilo: " + c.title + ". " + location.origin + "/";
  const g = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(titulo) + "&dates=" + a + "/" + b + "&details=" + encodeURIComponent(det) + "&location=" + encodeURIComponent(location.origin + "/");
  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Minuto Cinefilo//ES","BEGIN:VEVENT","UID:" + c.id + "@minutocinefilo.com.ar","DTSTAMP:" + fz(new Date()),
    ini ? "DTSTART:" + a : "DTSTART;VALUE=DATE:" + a, ini ? "DTEND:" + b : "DTEND;VALUE=DATE:" + b,
    "SUMMARY:" + titulo.replace(/[,;]/g, " "), "DESCRIPTION:" + det.replace(/[,;]/g, " "), "URL:" + location.origin + "/", "END:VEVENT","END:VCALENDAR"].join("\r\n");
  box.innerHTML = `<div class="wrap pin"><p class="t"><span class="label">Próximamente</span><b>${esc(c.title)}</b><span class="w">${esc(cuando)}</span></p>
    <div class="acts"><a href="${esc(g)}" target="_blank" rel="noopener">Agregar a Google Calendar</a><a href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}" download="minuto-cinefilo.ics">Otro calendario (.ics)</a></div></div>`;
  box.hidden = false;
}

function setBg(url){
  const box = $("#featBg"); if(!box) return;
  if(!url){ [...box.children].forEach(x => x.classList.remove("on")); box.dataset.u = ""; return; }
  if(box.dataset.u === url) return; box.dataset.u = url;
  const i = document.createElement("i"); i.style.backgroundImage = "url(" + JSON.stringify(url) + ")"; box.appendChild(i);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    i.classList.add("on"); [...box.children].forEach(x => { if(x !== i) x.classList.remove("on"); });
    setTimeout(() => [...box.children].forEach(x => { if(!x.classList.contains("on")) x.remove(); }), 1400);
  }));
}
function renderStats(){
  const reales = CAPSULAS.filter(c => !c.demo), box = $("#stats"); if(!reales.length) return;
  let seg = 0; reales.forEach(c => { seg += ONDAS[c.audio]?.d || 0; });
  const cic = new Set(reales.map(c => c.ciclo).filter(Boolean));
  const it = [[reales.length, "cápsulas"], [Math.round(seg / 60), "minutos de cine"], [cic.size, cic.size === 1 ? "ciclo" : "ciclos"]].filter(x => x[0] > 0);
  if(it.length < 2) return;
  box.style.gridTemplateColumns = "repeat(" + it.length + ",auto)";
  box.innerHTML = it.map(([n, l]) => `<div><b data-n="${n}">${n}</b><span>${l}</span></div>`).join(""); box.hidden = false;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  const els = [...box.querySelectorAll("b")]; els.forEach(b => b.textContent = "0");
  new IntersectionObserver((en, ob) => { if(!en[0].isIntersecting) return; ob.disconnect(); const t0 = performance.now();
    const paso = t => { const k = Math.min(1, (t - t0) / 1100), e = 1 - Math.pow(1 - k, 3); els.forEach(b => b.textContent = Math.round(b.dataset.n * e)); if(k < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso); }, {threshold: .4}).observe(box);
}
function renderCinta(){
  const ps = sorted.filter(c => c.poster && !c.demo), sec = $("#cinta");
  if(SITE.cintaPosters !== true || ps.length < 6){ sec.hidden = true; return; } // se enciende con "cintaPosters": true en capsulas.json
  const una = (c, dup) => `<li${dup ? ' class="dup" aria-hidden="true"' : ""}><button type="button" data-id="${esc(c.id)}" title="${esc(c.title)}" aria-label="Escuchar ${esc(c.title)}"${dup ? ' tabindex="-1"' : ""}><img src="${esc(thumb(c.poster))}" alt="" loading="lazy" width="96" height="144"></button></li>`;
  const ul = $("#cintaList"); ul.innerHTML = ps.map(c => una(c, 0)).join("") + ps.map(c => una(c, 1)).join("");
  ul.style.setProperty("--dur", Math.round(ps.length * 110 / 38) + "s"); sec.hidden = false;
  ul.onclick = e => { const b = e.target.closest("button[data-id]"); if(b) listen(b.dataset.id); };
}

function anterior(){
  const lista = ciclo ? sorted.filter(c => c.ciclo === ciclo) : sorted, i = lista.indexOf(current);
  for(let j = i - 1; j >= 0; j--) if(lista[j].audio) return lista[j];
  return null;
}
function mediaSession(c){
  if(!("mediaSession" in navigator)) return;
  try {
    const f = fich(c), img = c.poster || f?.poster || "";
    navigator.mediaSession.metadata = new MediaMetadata({title: c.title, artist: "Minuto Cinéfilo", album: c.ciclo || "Minuto Cinéfilo", artwork: img ? [{src: new URL(img, location.href).href}] : []});
    const go = fn => () => { const n = fn(); if(n) listen(n.id, true); };
    navigator.mediaSession.setActionHandler("nexttrack", siguiente() ? go(siguiente) : null);
    navigator.mediaSession.setActionHandler("previoustrack", anterior() ? go(anterior) : null);
  } catch(e) {}
}
function siguiente(){
  const lista = ciclo ? sorted.filter(c => c.ciclo === ciclo) : sorted, i = lista.indexOf(current);
  for(let j = i + 1; j < lista.length; j++) if(lista[j].audio) return lista[j];
  return null;
}
function listen(id, silencio){
  if(audio) audio.pause();
  current = CAPSULAS.find(c => c.id === id) || current;
  renderFeatured(); renderList();
  if(!silencio) $("#capsulas").scrollIntoView({behavior:"smooth"});
  const p = $("#play"); if(p && !p.disabled) p.click();
}
$("#list").addEventListener("click", e => { const b = e.target.closest(".rowplay, .thumb[data-id]"); if(b) listen(b.dataset.id); });
$("#cats").addEventListener("click", e => { const b = e.target.closest(".cat"); if(!b) return; genre = genre === b.dataset.g ? "" : b.dataset.g; if(genre) track("filtro/genero/" + genre); renderCats(); renderList(); });
$("#ciclos").addEventListener("click", e => { const b = e.target.closest(".cat"); if(!b) return; ciclo = ciclo === b.dataset.c ? "" : b.dataset.c; if(ciclo) track("filtro/ciclo/" + ciclo); renderCiclos(); renderList(); });
/* ---- Medición de uso (GoatCounter): eventos sin cookies, invisibles para el público ---- */
const track = (p, t) => { try { window.goatcounter && window.goatcounter.count && window.goatcounter.count({path: p, title: t || p, event: true}); } catch(e) {} };
const vistos = new Set();
const unaVez = (k, t) => { if(vistos.has(k)) return; vistos.add(k); track(k, t); };
function clasifica(a){
  const h = a.href || "", id = current ? current.id : "";
  if(a.classList.contains("charla")) return "charla/" + id;
  if(a.hasAttribute("download") || /^data:text\/calendar/.test(h)) return "calendario/ics";
  if(/calendar\.google\.com/.test(h)) return "calendario/google";
  if(/wa\.me|whatsapp/.test(h)) return "compartir/whatsapp/" + id;
  if(/t\.me\//.test(h)) return "compartir/telegram/" + id;
  if(/(twitter|x)\.com\/intent/.test(h)) return "compartir/x/" + id;
  if(/facebook\.com\/sharer/.test(h)) return "compartir/facebook/" + id;
  if(a.classList.contains("ver")) return "donde-ver/" + (a.dataset.p || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if(/open\.spotify\.com/.test(h)) return "plataforma/spotify";
  if(/music\.youtube\.com|youtube\.com\/playlist/.test(h)) return "plataforma/youtube-music";
  if(/podcasts\.apple\.com/.test(h)) return "plataforma/apple-podcasts";
  if(/amazon\./.test(h)) return "plataforma/amazon-music";
  if(/youtube\.com|youtu\.be/.test(h)) return "plataforma/youtube";
  if(/instagram\.com/.test(h)) return "plataforma/instagram";
  if(/feed\.xml/.test(h)) return "plataforma/rss";
  try { if(SITE && SITE.radioUrl && new URL(h).hostname === new URL(SITE.radioUrl).hostname) return "plataforma/radio-monk"; } catch(e) {}
  if(/themoviedb\.org/.test(h)) return "tmdb/" + id;
  return null;
}
document.addEventListener("click", e => {
  if(e.target.closest("#copy")) { track("compartir/copiar/" + (current ? current.id : "")); return; }
  const a = e.target.closest("a[href]"); if(!a) return;
  const p = clasifica(a); if(p) track(p);
});
const segundosEscuchados = a => { let s = 0; for(let i = 0; i < a.played.length; i++) s += a.played.end(i) - a.played.start(i); return s; };
document.addEventListener("play", e => { if(e.target.id === "audio" && current) unaVez("play/" + current.id, "Play: " + current.title); }, true);
document.addEventListener("timeupdate", e => { const a = e.target; if(a.id === "audio" && current && a.duration && segundosEscuchados(a) / a.duration >= .5) unaVez("mitad/" + current.id, "Mitad: " + current.title); }, true);
document.addEventListener("ended", e => { if(e.target.id === "audio" && current) unaVez("fin/" + current.id, "Completo: " + current.title); }, true);
document.addEventListener("ended", e => { if(e.target.id !== "audio" || !autoNext) return; const n = siguiente(); if(n){ track("siguiente-automatico/" + n.id); listen(n.id, true); } }, true);
$("#more").addEventListener("click", () => { showAll = true; renderList(); });
let tq = null, ya = false;
$("#q").addEventListener("input", () => {
  clearTimeout(tq);
  tq = setTimeout(() => {
    const has = $("#q").value.trim(), lista = $("#list");
    if(has && !lista.style.minHeight) lista.style.minHeight = lista.offsetHeight + "px"; // evita que la página "salte" cuando la lista se achica
    if(!has) lista.style.minHeight = "";
    renderList();
    if(has) unaVez("busqueda", "Búsqueda");
    if(has && !ya){ ya = true; const r = $("#archivo").getBoundingClientRect(); if(r.top > innerHeight * 0.6 || r.bottom < 120) $("#archivo").scrollIntoView({behavior: "instant", block: "start"}); }
    if(!has) ya = false;
  }, 200);
});
document.querySelectorAll(".hero-play").forEach(b => b.addEventListener("click", () => {
  if(!sorted || !sorted[0]) return;
  if(current === sorted[0]){ $("#capsulas").scrollIntoView({behavior:"smooth"}); const p = $("#play"); if(p && !p.disabled && audio && audio.paused) p.click(); }
  else listen(sorted[0].id);
}));

/* ---- Mini reproductor flotante: aparece cuando el reproductor del destacado sale de la pantalla ---- */
(() => {
  const mini = $("#mini"), mPlay = $("#mPlay"), mSeek = $("#mSeek"), mTime = $("#mTime"), mName = $("#mName");
  mPlay.innerHTML = I_PLAY;
  let started = false, barVisible = true, io = null, last = null;
  const cur = () => document.getElementById("audio");
  const sync = () => { const on = started && !barVisible; mini.classList.toggle("on", on); document.body.classList.toggle("mini-on", on); };
  const watch = () => { if(io) io.disconnect(); const bar = document.querySelector(".bar"); if(!bar) return; io = new IntersectionObserver(e => { barVisible = e[0].isIntersecting; sync(); }); io.observe(bar); };
  new MutationObserver(() => { if(cur()){ started = false; barVisible = true; watch(); sync(); } }).observe($("#latest"), {childList: true});
  const st = on => { mPlay.setAttribute("aria-pressed", on); mPlay.setAttribute("aria-label", on ? "Pausar" : "Reproducir"); };
  document.addEventListener("play", e => { if(e.target.id !== "audio") return; started = true; mName.textContent = current ? current.title : ""; st(true); sync(); }, true);
  document.addEventListener("pause", e => { if(e.target.id === "audio") st(false); }, true);
  document.addEventListener("ended", e => { if(e.target.id === "audio") st(false); }, true);
  document.addEventListener("timeupdate", e => {
    const a = e.target; if(a.id !== "audio" || !a.duration) return;
    const p = a.currentTime / a.duration * 100;
    mSeek.value = p; mSeek.style.setProperty("--p", p + "%"); mini.style.setProperty("--pp", p + "%");
    mTime.textContent = fmtTime(a.currentTime) + " / " + fmtTime(a.duration);
  }, true);
  mPlay.onclick = () => { const a = cur(); if(a) a.paused ? a.play() : a.pause(); };
  mSeek.oninput = () => { const a = cur(); if(a && a.duration) a.currentTime = mSeek.value / 100 * a.duration; };
  mini.querySelector(".mt").onclick = () => $("#capsulas").scrollIntoView({behavior: "smooth"});
})();

/* Subrayado de la sección activa en el menú */
(function(){
  const links=[...document.querySelectorAll('nav[aria-label="Principal"] a[href^="#"]')].filter(a=>a.getAttribute('href').length>1);
  const items=links.map(a=>({a,el:document.getElementById(a.getAttribute('href').slice(1))})).filter(x=>x.el);
  if(!items.length)return;
  let tk=false;
  function marcar(){
    tk=false;
    const y=window.innerHeight*0.35;
    let act=items[0];
    for(const it of items){ if(it.el.getBoundingClientRect().top<=y) act=it; }
    if(window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-4) act=items[items.length-1];
    items.forEach(it=>it.a.classList.toggle('on',it===act));
  }
  addEventListener('scroll',()=>{if(!tk){tk=true;requestAnimationFrame(marcar)}},{passive:true});
  addEventListener('resize',marcar);
  marcar();
})();
document.querySelector(".hsearch")?.addEventListener("submit", e => e.preventDefault());
