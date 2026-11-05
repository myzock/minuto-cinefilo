# Minuto Cinéfilo

Sitio web de **Minuto Cinéfilo**, cápsulas de audio de 2 a 4 minutos sobre cine (un proyecto de Vamos x Partes, emitido en Radio Monk).

Es una web estática: HTML, CSS y JavaScript sin frameworks, publicada con **GitHub Pages** en `https://minutocinefilo.com.ar/`.

## Cómo funciona

- **`capsulas.json`** es la única fuente de datos. Tiene `site` (links, redes, textos, interruptores) y `capsulas` (una entrada por episodio: `id`, `title`, `description`, `date`, `hora`, `audio`, `transcript`, `tmdb_id`, `ciclo`, etc.).
- **`index.html`** es la home. Lee `capsulas.json` y los archivos de `data/` y arma la portada, el destacado, la lista, los filtros, el reproductor y los estrenos.
- **`build.mjs`** (Node 20) genera todo lo demás, a partir del JSON:
  - `capsulas/<id>/index.html` y `og.jpg` (tarjeta para compartir), una por episodio;
  - `feed.xml` (podcast para Spotify y otros), `sitemap.xml` y `robots.txt`;
  - `data/fichas.json`, `data/proximos.json`, `data/ondas.json` y las cachés de TMDB;
  - la lista estática de episodios dentro de `<noscript>` en la home;
  - opcionalmente, páginas de ciclo (`ciclos/<nombre>/`).
- **`og.mjs`** dibuja las tarjetas para compartir (usa `sharp`, que se instala solo en el build) y **`ondas.mjs`** calcula la forma de onda y la duración de cada audio con ffmpeg.
- **`.github/workflows/build.yml`** corre el build cada hora y cuando cambian `capsulas.json`, `audio/`, `transcripciones/`, `build.mjs` o `index.html`, y publica lo generado. Tiene un límite de 10 minutos.

## Publicar una cápsula

1. Subir el audio a `audio/` (y el guion a `transcripciones/`, si lo hay).
2. Agregar el bloque de la cápsula en `capsulas.json`. `date` es `AAAA-MM-DD` y `hora` (opcional) es `HH:MM`, hora de Argentina. Hasta esa fecha y hora, el episodio queda agendado: no aparece en la home, el feed ni el sitemap.
3. El build corre solo. También se puede lanzar a mano desde la pestaña **Actions**.

Si `capsulas.json` tiene un error, el build se corta y la web publicada queda como estaba. Los avisos (numeración repetida o fuera de orden, ciclos casi iguales) aparecen en el resumen de Actions sin cortar el build.

## Campos opcionales de `site`

- `paginasCiclos`: `true` genera una página por ciclo.
- `cintaPosters`: `true` muestra la cinta de pósters (desde 6 cápsulas).
- `dondeVerla`: `true` muestra «Dónde verla en Argentina» en la ficha de cada película (TMDB watch/providers; los datos son de JustWatch y hay que citarlos: ya aparece «Fuente: JustWatch»). Se pide con `TMDB_KEY` cada 7 días y queda en `data/watch/<id>.json`; si el dato tiene más de 21 días sin renovar, se oculta. No hay links directos a cada plataforma: los botones llevan a la página de disponibilidad de TMDB/JustWatch. Con `false` no se pide ni se muestra nada.
- `goatcounter`, `spotifyUrl`, `youtubeMusicUrl`, `appleUrl`, `amazonUrl`, `podcast.*`: estadísticas, plataformas y datos del feed.

## Medición de uso (invisible para el público)

Además de las visitas, GoatCounter recibe eventos sin cookies, que se ven en su panel como rutas con estos prefijos:

- `play/<id>`, `mitad/<id>` (escuchó al menos la mitad, sin contar saltos) y `fin/<id>`: reproducciones de cada cápsula, una vez por visita.
- `siguiente-automatico/<id>` y `autoplay/on|off`: uso del botón "Seguir con el siguiente".
- `compartir/<red>/<id>` (whatsapp, telegram, x, facebook, copiar), `charla/<id>`, `tmdb/<id>`, `trailer/<id>`.
- `donde-ver/<plataforma>`: clics en los botones de «Dónde verla».
- `plataforma/<nombre>`: clics a Spotify, YouTube Music, Apple Podcasts, Amazon Music, RSS, Instagram y Radio Monk.
- `filtro/ciclo/<nombre>`, `filtro/genero/<nombre>`, `busqueda` (sin guardar el texto), `calendario/google|ics`, `navegacion/anterior|siguiente`.

Si GoatCounter no carga (por ejemplo por un bloqueador de anuncios), no pasa nada: la web funciona igual.

## Servicios externos

- **TMDB**: fichas, pósters, puntajes y próximos estrenos. Necesita el secreto `TMDB_KEY` en GitHub (Settings → Secrets → Actions). Sin la clave, el build usa las copias guardadas en `data/tmdb/`. Las fichas se renuevan cada 30 días.
- **GoatCounter**: estadísticas de visitas, sin cookies.
- **Google Fonts**: tipografías.

Este producto usa TMDB y las API de TMDB, pero no está avalado, certificado ni aprobado por TMDB.

## Seguridad
- **CSP**: la home (`index.html`) y `404.html` llevan una política de seguridad de contenido en un `<meta>`; las páginas generadas la reciben de `build.mjs` (los scripts en línea se autorizan por hash, calculado en cada build). La política solo deja cargar imágenes del propio sitio y de `image.tmdb.org`, fuentes de Google Fonts, el contador GoatCounter y el tráiler de `youtube-nocookie.com`. Si algún día agregás otra fuente (otro host de imágenes, otro servicio de estadísticas), hay que sumarla a esa política o el navegador la bloquea.
- La lógica de la home está en `app.js` (antes iba dentro de `index.html`), para no necesitar `unsafe-inline` en los scripts.
- Las acciones de GitHub del workflow están fijadas por código exacto (SHA). Para actualizarlas hay que cambiar el SHA a mano.
- **TMDB**: `TMDB_KEY` puede ser la clave v3 o el "Token de acceso de lectura de la API" (v4, empieza con `eyJ`); con el token la credencial viaja en una cabecera y no en la URL.
