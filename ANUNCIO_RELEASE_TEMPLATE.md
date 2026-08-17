# Plantilla de anuncio de release (Slack/Teams)

Mensaje listo para pegar en un canal del equipo al publicar una versión nueva.
Las secciones «Versión larga» y «Versión corta» están **completadas con los
datos reales de la v1.0.16** (enlaces, sha256, conteos de tests) — copiar el
bloque elegido tal cual. Para una versión futura, actualizar los valores de
la «Referencia rápida» (versión, URLs de assets, sha256 y conteos de tests)
y reemplazarlos en el texto de las dos secciones.

---

## Versión larga (una pantalla)

```text
🚀 DynaRent ERP — v1.0.16 (SetUp Inicial automático, auto-update corregido y versión real en la ventana)

La versión estable v1.0.16 ya está publicada en GitHub, construida por CI y
con el auto-update operativo (las instalaciones v1.0.3+ la detectan al
arrancar y piden instalarla; en esta versión se corrigieron los permisos ACL
del plugin updater, por lo que el chequeo manual y el automático ya funcionan).

📦 Descarga: release v1.0.16 → https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.16/DynaRent_1.0.16_x64-setup.exe
(~23 MB, NSIS · sha256 6d2353d371965da60580a747d1249a478843239f9939a0a7f7e93ee18d8278c5)
o el .msi (~33 MB · sha256 dc72e172e2bb8f000d81fc7a860c383a6d4684b453a6569b4846defdb205339a):
https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.16/DynaRent_1.0.16_x64_en-US.msi
Credenciales iniciales: admin / admin123 (cambio forzado al primer ingreso).
⚠️ No instalar la v1.0.0 (descontinuada: se colgaba en equipos sin BD previa).

🔧 Qué incluye esta versión:
  🏢 SetUp Inicial automático: en el primer ingreso la app lleva al
     Administrador a configurar la empresa (nombre, NIT, dirección,
     teléfonos de contacto con el código del país donde se usa la app,
     p. ej. +57 para Colombia, y el logo de los documentos)
  🔄 Auto-update corregido: permisos ACL del updater (check/download/
     install) y process (restart) habilitados — el botón «Buscar
     actualización» y el chequeo al arrancar ya funcionan
  ℹ️ Versión real en la ventana: el sidebar, el login y el modal Acerca de
     muestran la versión instalada (leída del binario, sin hardcodear)
  📄 Branding en los documentos: Contrato de Renta, Orden de Renta y Orden
     de Reserva con los datos de la empresa desde el SetUp Inicial
  🔍 Combos con búsqueda, IVA por renta, crear renta desde reserva, cálculo
     unificado de días/horas y las features previas

🔄 Para las instalaciones v1.0.2: actualízalas a esta versión UNA sola vez a
mano — desde aquí reciben las siguientes actualizaciones automáticamente.

🟢 CI verde en main: lint · 260 tests frontend (vitest) · svelte-check 0/0 ·
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
🚀 DynaRent ERP v1.0.16 publicada — SetUp Inicial automático: en el primer
ingreso la app pide configurar la empresa (nombre, dirección, teléfonos con
el código del país y logo). Auto-update corregido (permisos del updater) y
la ventana muestra la versión real instalada. Desde la v1.0.3 la app se
actualiza sola; las instalaciones v1.0.2 se actualizan una vez a mano.
Descarga solo desde la release v1.0.16 (la v1.0.0 está descontinuada):
https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.16
Guías y kit de operaciones en el repo:
RESUMEN_EJECUTIVO.md · INSTALACION_OPERACIONES.md · DEPLOYMENT_CLIENTES.md
```

## Referencia rápida para rellenar

- **Producto:** DynaRent ERP
- **Repo:** https://github.com/aleksei-corom/DynaRent
- **Assets de la v1.0.16:** `DynaRent_1.0.16_x64-setup.exe` (NSIS, ~23 MB, sha256 `6d2353d3…`) y `DynaRent_1.0.16_x64_en-US.msi` (~33 MB, sha256 `dc72e172…`)
- **Credenciales iniciales:** `admin` / `admin123` (cambio forzado)
- **URLs directas de assets v1.0.16:**
  - NSIS: https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.16/DynaRent_1.0.16_x64-setup.exe
  - MSI: https://github.com/aleksei-corom/DynaRent/releases/download/v1.0.16/DynaRent_1.0.16_x64_en-US.msi
  - Release (con changelog automático de commits): https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.16
  - Firmas del updater: `DynaRent_1.0.16_x64-setup.exe.sig` / `DynaRent_1.0.16_x64_en-US.msi.sig`
  - Endpoint del auto-update (latest.json): https://github.com/aleksei-corom/DynaRent/releases/latest/download/latest.json
- **Conteos de tests** (actualizarlos si cambian): vitest 260 · svelte-check 0/0 · cargo 54 lib + integración completa (seed_ci, incluido el flujo de SetUp Inicial con país) · importador 16
- **Pasos al publicar:** crear tag `vX.Y.Z` → `release.yml` (CI) construye y publica → marcar versiones anteriores como pre-release/descontinuadas si aplica → pegar el anuncio.
- **Changelog automático:** `release.yml` genera el body de la release con los commits entre el tag anterior y el nuevo (`git log prev..tag`); el anuncio puede enlazar a la página de la release en lugar de repetir la lista de cambios.
- **Auto-actualización (v1.0.3+):** la app chequea GitHub Releases al arrancar (`latest.json`), muestra «Actualización disponible» y verifica la firma minisign contra la pubkey embebida antes de instalar. Las instalaciones **v1.0.2 no tienen updater**: se actualizan UNA vez a mano instalando la v1.0.3 encima; desde ahí reciben las siguientes automáticamente. El CI sube `latest.json` + los `.sig` con cada release (prerrequisito: secret `TAURI_SIGNING_PRIVATE_KEY`; ver RELEASE_CHECKLIST.md). Desde la **v1.0.16** los permisos ACL del plugin (updater:default + process:default) están habilitados: el chequeo manual («Buscar actualización») y el automático ya funcionan.
- **Assets de la v1.0.16 (publicada):** 5 assets en la release — los 2 instaladores (`DynaRent_1.0.16_x64-setup.exe` NSIS ~23 MB y `DynaRent_1.0.16_x64_en-US.msi` ~33 MB), sus firmas del updater (`*.exe.sig` / `*.msi.sig`) y `latest.json`. Sha256 de los instaladores (verificables con `Get-FileHash`):
  - NSIS: `6d2353d371965da60580a747d1249a478843239f9939a0a7f7e93ee18d8278c5`
  - MSI: `dc72e172e2bb8f000d81fc7a860c383a6d4684b453a6569b4846defdb205339a`
