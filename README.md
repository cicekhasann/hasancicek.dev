# hasancicek.dev

> Production portfolio of **Hasan Çiçek** — Systems & Backend Engineer.  
> Live at: [https://hasancicek.dev](https://hasancicek.dev)

A zero-framework, high-performance systems engineering portfolio built with Vanilla WebGL, mathematical flow fields, real-time pendulum physics, and self-hosted container infrastructure.

---

## Architecture & Technology Stack

### 1. Frontend & Graphics Engineering (Zero Frameworks)
- **Vanilla HTML5 & Modern CSS3:** No React, Vue, Next.js, or heavy bundlers. Native CSS custom properties, grid/flexbox layouts, responsive fluid typography (`clamp()`), and GPU-accelerated compositing.
- **WebGL 3D Harf-Pencere Pipeline (`hasan-scene.js`):**
  - Custom triangulated glyph meshes derived from Anton typography (`geometry.json`).
  - Strict ASCII GLSL vertex and fragment shaders with per-pixel atmospheric lighting.
  - Multi-pass post-processing pipeline: Full resolution FBO $\to$ Dual-pass separable Gaussian blur FBOs $\to$ Composite shader with cinematic Depth-of-Field (DoF) and dynamic background chromatic tinting.
  - 8-directional contour outline offset rendering for razor-sharp edge contrast.
  - Complete viewport culling and `document.hidden` GPU sleep state (0% GPU when offscreen or in background tabs).
- **Mathematical Living Flow Field (`ascii-field.js`):**
  - High-performance character wave canvas running at locked ~25–30 FPS.
  - Zero Garbage Collection (GC) footprint with pre-allocated color palette lookup tables.
  - Interactive cursor proximity gravity field and scroll wave displacement.
- **Continuous Catenary Rope & Pendulum Swing (`script.js`):**
  - SVG catenary curve tension lines spanning across grid columns.
  - Physically synchronized pendulum physics (`transform-origin: 50% -24px`) with independent harmonic phase offsets, spring damping, and scroll inertia ("scroll wind").
- **Dynamic 4-Color Theme Engine:**
  - Integrated header palette dock supporting Amethyst (Default), Crimson & Copper, Royal Sapphire, and Titanium Platinum modes with persistent state and dynamic rim-lit portrait swaps.

---

### 2. Infrastructure, Security & Delivery
- **Containerized Edge Runtime:**
  - Multi-stage Alpine-based Nginx (`nginx:1.29-alpine`) container running inside an isolated Docker network.
  - Hardened Nginx configuration with strict HTTP security headers: `X-Frame-Options`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and restricted `Permissions-Policy`.
  - Built-in lightweight health check endpoint (`GET /health`) returning application status for edge router probes.
- **Reverse Proxy & Routing:**
  - Cloudflare Edge Proxy with strict TLS 1.3 termination (`AEAD-CHACHA20-POLY1305`), automatic Brotli/Gzip compression, and HTTP/2 multiplexing.
  - Cache-busted static asset versioning (`?v=...`) ensuring zero stale cache collisions on deployments.
- **Platform Architecture:**
  - Deployed on **Oracle Cloud Infrastructure (OCI)** ARM64 (`aarch64`, Ampere Altra) bare-metal/VM compute.

---

## Directory Structure

```text
hasancicek.dev/
├── Dockerfile              # Production Nginx container definition (ARM64 & x86_64 multi-arch)
├── docker-compose.yml      # Local and production container orchestration
├── nginx.conf              # Hardened web server config, error pages, and gzip/cache rules
├── public/                 # Production static web assets
│   ├── index.html          # Main application surface
│   ├── 404.html            # Custom route not found edge fallback page
│   ├── 403.html            # Custom zero-trust access restricted page
│   ├── 500.html            # Custom circuit breaker / supervisor fault page
│   ├── styles.css          # Production design system and layout styling
│   ├── script.js           # Progressive enhancement, pendulum physics, and theme switcher
│   ├── ascii-field.js      # Zero-GC ASCII living flow field canvas
│   ├── hasan-scene.js      # WebGL 3D glyph showcase and 4-pass DoF engine
│   └── assets/             # Compressed WebP imagery, vector icons, and geometry meshes
│       ├── hasan/          # Triangulated 3D glyph geometry.json and letter textures
│       ├── og-image.jpg    # 1200x630 OpenGraph and Twitter card preview
│       └── logo-white.png  # Handcrafted brand glyph
└── README.md
```

---

## Local Development

You can run the portfolio locally without installing any frontend build dependencies:

### Using Python:
```bash
python3 -m http.server 4600 --directory public
# Open http://localhost:4600 in your browser
```

### Using Docker Compose:
```bash
docker compose up --build
# Open http://localhost in your browser
```

---

## Production Deployment

The site is packaged into a minimal container image (~2.1 MB total assets) and orchestrated via Docker Compose:

```bash
docker compose build
docker compose up -d --force-recreate
```

Container health status can be verified with:
```bash
docker inspect -f "{{.State.Health.Status}}" app-portfolio
```

---

## License & Attribution

Copyright © 2026 Hasan Çiçek. All rights reserved.  
Open-source code and experiments are released under individual repository licenses on [github.com/cicekhasann](https://github.com/cicekhasann).

