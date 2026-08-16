# Plantilla de anuncio de release (Slack/Teams)

Mensaje listo para pegar en un canal del equipo al publicar una versión nueva.
Las secciones «Versión larga» y «Versión corta» están **completadas con los
datos reales de la v1.0.14** (enlaces, sha256, conteos de tests) — copiar el
bloque elegido tal cual. Para una versión futura, actualizar los valores de
la «Referencia rápida» (versión, URLs de assets, sha256 y conteos de tests)
y reemplazarlos en el texto de las dos secciones.

---

## Versión larga (una pantalla)

```text
🚀 DynaRent ERP — v1.0.14 (primera release pública, auto-update operativo)

La versión estable v1.0.14 ya está publicada en GitHub, construida por CI y
validada de punta a punta, incluido el auto-update contra el endpoint real.

📦 Descarga: release v1.0.14 → https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.14/DynaRent_1.0.14_x64-setup.exe
(~23 MB, NSIS · sha256 dfa02bc90f4c58f1f5e5685bc282c24a07bdf798c29ee0fa10130e02315fc7c2)
o el .msi (~33 MB · sha256 89ca531d27d74d2566e122e96d1fd9a29acb88977669156114dff2ff962b62b3):
https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.14/DynaRent_1.0.14_x64_en-US.msi
Credenciales iniciales: admin / admin123 (cambio forzado al primer ingreso).
⚠️ No instalar la v1.0.0 (descontinuada: se colgaba en equipos sin BD previa).

🔧 Qué incluye esta versión:
  🔄 Auto-actualización operativa: la app detecta al arrancar si hay una
     release nueva y pide instalarla (firma minisign verificada contra la
     clave embebida) — primera release pública del repo DynaRent
  📄 Documento mejorado: contrato en 2 hojas, +57 en los celulares del
     encabezado, multa de la cláusula 4 en blanco, póliza de lucro cesante
     40/50/70 mil y campo Gasolina en el formulario de renta
  🧾 IVA por renta y cálculo unificado de días/horas al cerrar
  🔁 Crear renta desde reserva y cambio de vehículo sin cerrar la renta
     (transaccional, con auditoría)
  🔍 Combos con búsqueda en rentas, reservas, comparendos, mantenimiento y gastos

🔄 Para las instalaciones v1.0.2: actualízalas a esta versión UNA sola vez a
mano — desde aquí reciben las siguientes actualizaciones automáticamente.

🟢 CI verde en main: lint · 242 tests frontend (vitest) · svelte-check 0/0 ·
cargo (51 unit + integración completa con seed_ci) · test del importador (16 casos).

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
🚀 DynaRent ERP v1.0.14 publicada (primera release pública, auto-update
operativo) y validada de punta a punta contra el endpoint real de GitHub.
Desde la v1.0.3 la app se actualiza sola; las instalaciones v1.0.2 se
actualizan una vez a mano. Descarga solo desde la release v1.0.14 (la v1.0.0
está descontinuada):
https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.14
Guías y kit de operaciones en el repo:
RESUMEN_EJECUTIVO.md · INSTALACION_OPERACIONES.md · DEPLOYMENT_CLIENTES.md
```

## Referencia rápida para rellenar

- **Producto:** DynaRent ERP
- **Repo:** https://github.com/aleksei-corom/DynaRent
- **Assets de la v1.0.14:** `DynaRent_1.0.14_x64-setup.exe` (NSIS, ~23 MB, sha256 `dfa02bc9…`) y `DynaRent_1.0.14_x64_en-US.msi` (~33 MB, sha256 `89ca531d…`)
- **Credenciales iniciales:** `admin` / `admin123` (cambio forzado)
- **URLs directas de assets v1.0.14:**
  - NSIS: https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.14/DynaRent_1.0.14_x64-setup.exe
  - MSI: https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.14/DynaRent_1.0.14_x64_en-US.msi
  - Release (con changelog automático de commits): https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.14
  - Firmas del updater: `DynaRent_1.0.14_x64-setup.exe.sig` / `DynaRent_1.0.14_x64_en-US.msi.sig`
  - Endpoint del auto-update (latest.json): https://github.com/aleksei-corom/DynaRent/releases/latest/download/latest.json
- **Conteos de tests** (actualizarlos si cambian): vitest 242 · svelte-check 0/0 · cargo 51 lib + integración completa (seed_ci) · importador 16
- **Pasos al publicar:** crear tag `vX.Y.Z` → `release.yml` (CI) construye y publica → marcar versiones anteriores como pre-release/descontinuadas si aplica → pegar el anuncio.
- **Changelog automático:** `release.yml` genera el body de la release con los commits entre el tag anterior y el nuevo (`git log prev..tag`); el anuncio puede enlazar a la página de la release en lugar de repetir la lista de cambios.
- **Auto-actualización (v1.0.3+):** la app chequea GitHub Releases al arrancar (`latest.json`), muestra «Actualización disponible» y verifica la firma minisign contra la pubkey embebida antes de instalar. Las instalaciones **v1.0.2 no tienen updater**: se actualizan UNA vez a mano instalando la v1.0.3 encima; desde ahí reciben las siguientes automáticamente. El CI sube `latest.json` + los `.sig` con cada release (prerrequisito: secret `TAURI_SIGNING_PRIVATE_KEY`; ver RELEASE_CHECKLIST.md).
- **Assets de la v1.0.14 (publicada):** 5 assets en la release — los 2 instaladores (`DynaRent_1.0.14_x64-setup.exe` NSIS ~23 MB y `DynaRent_1.0.14_x64_en-US.msi` ~33 MB), sus firmas del updater (`*.exe.sig` / `*.msi.sig`) y `latest.json`. Sha256 de los instaladores (verificables con `Get-FileHash`):
  - NSIS: `dfa02bc90f4c58f1f5e5685bc282c24a07bdf798c29ee0fa10130e02315fc7c2`
  - MSI: `89ca531d27d74d2566e122e96d1fd9a29acb88977669156114dff2ff962b62b3`
