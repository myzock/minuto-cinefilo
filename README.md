# Minuto Cinéfilo

Sitio web de **Minuto Cinéfilo**, cápsulas de audio de 2 a 4 minutos sobre cine (un proyecto de Vamos x Partes, emitido en Radio Monk).

Es una web estática: HTML, CSS y JavaScript sin frameworks, publicada con **GitHub Pages** en `https://minutocinefilo.com.ar/`.

## Cómo funciona

- **`capsulas.json`** es la única fuente de datos. Tiene `site` (links, redes, textos, interruptores) y `capsulas` (una entrada por episodio: `id`, `title`, `description`, `date`, `hora`, `audio`, `transcript`, `tmdb_id`, `ciclo`, etc.).
- **`index.html`** es la estructura y el estilo de la home. **`app.js`** es toda su lógica: lee `capsulas.json` y los archivos de `data/` y arma la portada, el destacado, la lista, los filtros, el buscador, el reproductor (con la forma de onda y la Media Session), el aviso «Próximamente», los estrenos y la medición de uso. Es el único JavaScript propio de la home.
- **`build.mjs`** (Node 20) genera todo lo demás, a partir del JSON:
  - `capsulas/<id>/index.html` y `og.jpg` (tarjeta para compartir), una por episodio;
  - `prensa/index.html`, la página de prensa (`/prensa/`, con el material y el contacto para invitaciones a estrenos y eventos); su texto está dentro de `build.mjs`;
  - `feed.xml` (podcast para Spotify y otros), `sitemap.xml` (incluye `/prensa/`) y `robots.txt`;
  - `data/fichas.json`, `data/proximos.json`, `data/ondas.json` y las cachés de TMDB;
  - la lista estática de episodios dentro de `<noscript>` de la home y la clase `hay-prox` del `<body>` (reserva el lugar del aviso «Próximamente» para que la página no salte al cargar);
  - opcionalmente, páginas de ciclo (`ciclos/<nombre>/`).
- **`og.mjs`** dibuja las tarjetas para compartir con `sharp` y **`ondas.mjs`** calcula la forma de onda y la duración de cada audio con ffmpeg.
- **`.github/workflows/build.yml`** corre el build cada hora y publica lo generado. Tiene un límite de 10 minutos. Además del horario, se dispara cuando cambia alguno de estos archivos: `capsulas.json`, `transcripciones/**`, `audio/**`, `build.mjs`, `og.mjs`, `ondas.mjs`, `index.html`, `app.js`, `package.json` o `package-lock.json`. Si el push de lo generado choca con otro push, se reintenta hasta 4 veces.

### Otros archivos y carpetas

| Ruta | Para qué sirve |
|---|---|
| `og.png` | Tarjeta genérica (1200×630) para compartir la home y las páginas sin tarjeta propia. |
| `data/og-cache.json` | Recuerda con qué datos (número, título, imagen) se dibujó cada `og.jpg`, para no rehacer las tarjetas en cada build horario. |
| `firma/` | Logos (`logo-completo.png`, `logo-carrete.png`) de la firma de correo del proyecto. No los usa la web. |
| `prensa/` | La página de prensa generada y los logos descargables (fondo blanco y transparente). |
| `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `podcast.jpg`, `tmdb-logo.svg` | Íconos, portada del podcast y logo de TMDB. |
| `404.html`, `CNAME` | Página de error (con `noindex`) y dominio personalizado de GitHub Pages. |
| `package.json`, `package-lock.json` | Fijan la única dependencia (`sharp`). |

## Dependencias

La única dependencia es **`sharp`** (dibuja las tarjetas `og.jpg`), fijada en `package.json` y `package-lock.json`. El workflow la instala con `npm ci`; para probar el build en tu computadora hacé lo mismo (`npm ci`, con Node 20 o más nuevo, y `ffmpeg` instalado). Para actualizarla: `npm install sharp@<versión>`, probar el build y subir los dos archivos. Si `sharp` no está instalado o falla al dibujar una tarjeta, el build no se detiene pero lo informa con un error en el log y un apartado en el resumen de Actions («Tarjetas para compartir sin generar»); esa página se comparte con una imagen de reserva.

## Publicar una cápsula

1. Subir el audio a `audio/` (y el guion a `transcripciones/`, si lo hay).
2. Agregar el bloque de la cápsula en `capsulas.json`. `date` es `AAAA-MM-DD` (tiene que ser una fecha que exista: se rechazan cosas como `2026-02-31`) y `hora` (opcional) es `HH:MM`, hora de Argentina.
3. Subir los cambios. El build corre solo y, si no hay errores, publica. También se puede lanzar a mano desde la pestaña **Actions**.
4. Cuando llega la fecha y hora, el próximo build horario (minuto 5 de cada hora; GitHub a veces lo atrasa) la publica sola: aparece en la home, el feed y el sitemap, y su página deja de tener `noindex`.

Si `capsulas.json` tiene un error, el build se corta y la web publicada queda como estaba. Los avisos (numeración repetida o fuera de orden, ciclos casi iguales) aparecen en el resumen de Actions sin cortar el build.

## Cápsulas programadas

Podés cargar episodios con anticipación: mientras su fecha y hora no llegaron están **agendados**.

- **Qué se oculta:** no aparecen en la lista de la home, el destacado, el feed, el sitemap ni la lista `<noscript>`, y su página lleva `noindex`. La home muestra solo el aviso «Próximamente» (título, fecha y hora, con botones de calendario) del más próximo.
- **Qué NO se oculta:** el sitio se publica desde este repositorio, que es público, y GitHub Pages sirve todo lo que está subido. Mientras un episodio está agendado, **su página (con el guion completo), el MP3, la transcripción, la tarjeta `og.jpg` y su entrada en `capsulas.json` y `data/*.json` son accesibles para quien conozca la dirección** (por ejemplo `/capsulas/<id>/` o `/audio/<archivo>.mp3`), y también se pueden ver en el repositorio de GitHub. No hay ningún enlace público que lleve a ellos, pero no están protegidos. **No subas con anticipación material bajo embargo** sin resolver esto antes.
- **Vista previa:** el build genera la página de un episodio agendado (con `noindex`), útil para revisarla antes de la fecha.

## Límites de GitHub Pages y almacenamiento

Según la [documentación de GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits): el sitio publicado no puede superar **1 GB**, el repositorio de origen tiene un límite recomendado de **1 GB**, el ancho de banda es de **100 GB por mes** (límite blando) y hay un límite blando de 10 compilaciones por hora (no aplica si se publica con un workflow propio de Actions).

- Cada cápsula pesa unos **3 MB** de MP3 (promedio actual: 3,2 MB, unos 3 minutos y medio) más ~35 KB de HTML y ~50 KB de tarjeta. Con ese tamaño, el límite de 1 GB se alcanzaría **cerca de las 300 cápsulas**. El historial de Git crece al menos lo mismo.
- Para estirarlo: exportar los MP3 con un bitrate más bajo (voz: 64–96 kbps mono alcanza), y no reemplazar MP3 ya subidos (cada versión queda en el historial).
- El resto escala bien: con 500 cápsulas, el build tarda unos 50 s la primera vez y ~10 s con las cachés, y `capsulas.json` pesa ~280 KB.

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
