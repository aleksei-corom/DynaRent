# Plantilla de anuncio de release (Slack/Teams)

Mensaje listo para pegar en un canal del equipo al publicar una versión nueva.
Las secciones «Versión larga» y «Versión corta» están **completadas con los
datos reales de la v1.0.15** (enlaces, sha256, conteos de tests) — copiar el
bloque elegido tal cual. Para una versión futura, actualizar los valores de
la «Referencia rápida» (versión, URLs de assets, sha256 y conteos de tests)
y reemplazarlos en el texto de las dos secciones.

---

## Versión larga (una pantalla)

```text
🚀 DynaRent ERP — v1.0.15 (SetUp Inicial con País y branding de la empresa)

La versión estable v1.0.15 ya está publicada en GitHub, construida por CI y
con el auto-update operativo (las instalaciones v1.0.3+ la detectan al
arrancar y piden instalarla).

📦 Descarga: release v1.0.15 → https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.15/DynaRent_1.0.15_x64-setup.exe
(~23 MB, NSIS · sha256 f32ef0041f6b31298e7b148add27d605096c5c6315907f760804fd39d322760b)
o el .msi (~33 MB · sha256 e8c25a68956886f9ea944a8ee62bd3c23c245b91d3b443b2a9721b8945f59703):
https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.15/DynaRent_1.0.15_x64_en-US.msi
Credenciales iniciales: admin / admin123 (cambio forzado al primer ingreso).
⚠️ No instalar la v1.0.0 (descontinuada: se colgaba en equipos sin BD previa).

🔧 Qué incluye esta versión:
  🏢 SetUp Inicial con País: la empresa configura su nombre, NIT, dirección,
     teléfonos de contacto y logo en /empresa; los teléfonos llevan el código
     del país donde se usa la app (p. ej. +57 para Colombia)
  📄 Branding en los documentos: Contrato de Renta, Orden de Renta y Orden de
     Reserva muestran los datos de la empresa (nombre, dirección, teléfonos
     con su código y logo) desde el SetUp Inicial
  ℹ️ Modal Acerca de (DynaRent ERP by CORJAR) con la versión real de la app
  🔄 Auto-actualización operativa (desde v1.0.3): firma minisign verificada
  🔍 Combos con búsqueda, IVA por renta, crear renta desde reserva, cálculo
     unificado de días/horas y las features previas

🔄 Para las instalaciones v1.0.2: actualízalas a esta versión UNA sola vez a
mano — desde aquí reciben las siguientes actualizaciones automáticamente.

🟢 CI verde en main: lint · 254 tests frontend (vitest) · svelte-check 0/0 ·
cargo (54 unit + integración completa con seed_ci, incluidos los tests del
flujo de SetUp Inicial) · test del importador (16 casos).

🛠️ Kit de operaciones (repo, scripts/):
  • verificar-despliegue.ps1 — verificación post-instalación por equipo
  • importar_autos_clientes.py — migrar Autos/Clientes desde SQL o Excel
    (PII cifrado, dry-run antes de aplicar)
  • check-simit.mjs / watch-simit.mjs — monitoreo del agente SIMIT
  • smoke test del instalador en Windows Sandbox (reproducible)

📄 Guías: INSTALACION_OPERACIONES.md (instalación) ·
DEPLOYMENT_CLIENTES.md (despliegue y rollback) ·
RESUMEN_EJECUTIVO.md (estado completo).

Resumen completo:
https://github.com/aleksei-corom/DynaRent/blob/main/RESUMEN_EJECUTIVO.md
```

## Versión corta (anuncio rápido, 2-3 líneas)

```text
🚀 DynaRent ERP v1.0.15 publicada — SetUp Inicial con País: la empresa
configura nombre, dirección, teléfonos (con el código del país) y logo, que
aparecen en el Contrato y las Órdenes de Renta y Reserva. Desde la v1.0.3 la
app se actualiza sola; las instalaciones v1.0.2 se actualizan una vez a mano.
Descarga solo desde la release v1.0.15 (la v1.0.0 está descontinuada):
https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.15
Guías y kit de operaciones en el repo:
RESUMEN_EJECUTIVO.md · INSTALACION_OPERACIONES.md · DEPLOYMENT_CLIENTES.md
```

## Referencia rápida para rellenar

- **Producto:** DynaRent ERP
- **Repo:** https://github.com/aleksei-corom/DynaRent
- **Assets de la v1.0.15:** `DynaRent_1.0.15_x64-setup.exe` (NSIS, ~23 MB, sha256 `f32ef004…`) y `DynaRent_1.0.15_x64_en-US.msi` (~33 MB, sha256 `e8c25a68…`)
- **Credenciales iniciales:** `admin` / `admin123` (cambio forzado)
- **URLs directas de assets v1.0.15:**
  - NSIS: https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.15/DynaRent_1.0.15_x64-setup.exe
  - MSI: https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.15/DynaRent_1.0.15_x64_en-US.msi
  - Release (con changelog automático de commits): https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.15
  - Firmas del updater: `DynaRent_1.0.15_x64-setup.exe.sig` / `DynaRent_1.0.15_x64_en-US.msi.sig`
  - Endpoint del auto-update (latest.json): https://github.com/aleksei-corom/DynaRent/releases/latest/download/latest.json
- **Conteos de tests** (actualizarlos si cambian): vitest 254 · svelte-check 0/0 · cargo 54 lib + integración completa (seed_ci, incluido el flujo de SetUp Inicial con país) · importador 16
- **Pasos al publicar:** crear tag `vX.Y.Z` → `release.yml` (CI) construye y publica → marcar versiones anteriores como pre-release/descontinuadas si aplica → pegar el anuncio.
- **Changelog automático:** `release.yml` genera el body de la release con los commits entre el tag anterior y el nuevo (`git log prev..tag`); el anuncio puede enlazar a la página de la release en lugar de repetir la lista de cambios.
- **Auto-actualización (v1.0.3+):** la app chequea GitHub Releases al arrancar (`latest.json`), muestra «Actualización disponible» y verifica la firma minisign contra la pubkey embebida antes de instalar. Las instalaciones **v1.0.2 no tienen updater**: se actualizan UNA vez a mano instalando la v1.0.3 encima; desde ahí reciben las siguientes automáticamente. El CI sube `latest.json` + los `.sig` con cada release (prerrequisito: secret `TAURI_SIGNING_PRIVATE_KEY`; ver RELEASE_CHECKLIST.md).
- **Assets de la v1.0.15 (publicada):** 5 assets en la release — los 2 instaladores (`DynaRent_1.0.15_x64-setup.exe` NSIS ~23 MB y `DynaRent_1.0.15_x64_en-US.msi` ~33 MB), sus firmas del updater (`*.exe.sig` / `*.msi.sig`) y `latest.json`. Sha256 de los instaladores (verificables con `Get-FileHash`):
  - NSIS: `f32ef0041f6b31298e7b148add27d605096c5c6315907f760804fd39d322760b`
  - MSI: `e8c25a68956886f9ea944a8ee62bd3c23c245b91d3b443b2a9721b8945f59703`
