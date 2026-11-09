# Conceptual Portfolio design

A light, editorial landing page for an independent UI/UX designer and software
engineer. Built with Astro as a static-first site, with the hero split into
layout, header, artwork, geometry and shader modules. The artwork uses a
lazy-loaded Three.js scene and keeps an SVG fallback available until WebGL is
ready.

## Development

```sh
npm install
npm run dev
npm run typecheck
```

## Production

```sh
npm run build
npm run preview
```

The hero is the current scope. Its fluid-inspired splash loads on the first
scroll, then circulates with scroll and respects the operating system's
reduced-motion preference. The display face is loaded from Google Fonts; a
local serif fallback is provided.
