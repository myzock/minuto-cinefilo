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
- `goatcounter`, `spotifyUrl`, `youtubeMusicUrl`, `appleUrl`, `amazonUrl`, `podcast.*`: estadísticas, plataformas y datos del feed.

## Servicios externos

- **TMDB**: fichas, pósters, puntajes y próximos estrenos. Necesita el secreto `TMDB_KEY` en GitHub (Settings → Secrets → Actions). Sin la clave, el build usa las copias guardadas en `data/tmdb/`. Las fichas se renuevan cada 30 días.
- **GoatCounter**: estadísticas de visitas, sin cookies.
- **Google Fonts**: tipografías.

Este producto usa TMDB y las API de TMDB, pero no está avalado, certificado ni aprobado por TMDB.
