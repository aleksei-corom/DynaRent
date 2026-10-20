# Resumen Ejecutivo — Dynarent ERP

> **Fecha:** 2026-10-20 · **Estado general:** producción — release **v1.2.7 publicada** (tag verificado, 5 assets firmados, E2E del updater validada sin máquina: firma minisign y bytes comprobados contra la pubkey de producción), correcciones financieras y de seguridad del informe de revisión, y ~40 comandos Tauri async (UI sin bloqueos).

---

## 1. Estado actual (una mirada)

| Área | Estado |
|---|---|
| **Aplicación** | Todos los módulos operativos (rentas, comparendos + agente SIMIT, alertas, calendario, informes, reservas, contratos, backups, multi-moneda) |
| **Versión estable** | **v1.2.7** — publicada 2026-10-20 con auto-update activo |
| **Instalación limpia** | ✅ Validada E2E en Windows Sandbox (equipo sin nada): la app crea su BD, migra y arranca sin colgarse |
| **CI** | ✅ Verde en el tope de `main` (lint, svelte-check 0/0, vitest 785 tests, cargo 107 lib + 21 suites de integración con BD sembrada, importador, verificador de despliegue -DryRun) |
| **Repositorio** | Árbol limpio y sincronizado con `origin/main` |
| **Auto-actualización** | ✅ Activa desde la **v1.0.14** y **plenamente funcional desde la v1.2.5** (pubkey alineada) — la app chequea `latest.json` al arrancar y ofrece instalar (firma minisign verificada); E2E sin máquina ✅ |

## 2. Releases en GitHub

| Release | Estado | Para quién |
|---|---|---|
| **v1.2.7** | ✅ **Latest / estable** — construida íntegramente por CI (GitHub Actions) | **Única descarga recomendada** |
| v1.2.6 | ✅ Estable anterior (sigue funcionando) | Recibe v1.2.7 sola (auto-update) |
| v1.2.5 | ✅ Estable anterior | Recibe v1.2.7 sola (auto-update) |
| v1.0.14 – v1.2.4 | ⚠️ Actualizan a mano **una vez** (pubkey embebida errónea, saldada en v1.2.5) | Instalar v1.2.7 encima; desde ahí auto-update |
| v1.0.3 – v1.0.13 | ⚠️ Actualizan a mano (updater roto por ACL) | Instalar v1.2.7 encima |
| ≤ v1.0.2 | ⚠️ Sin updater | Instalar v1.2.7 encima |
| v1.0.0 | 🚫 **Descontinuada** (se colgaba en el Login sin BD) | **No instalarla** |

**Assets de la v1.2.7** (publicados 2026-10-20):

| Asset | Tamaño | sha256 |
|---|---|---|
| [`Dynarent_1.2.7_x64-setup.exe`](https://github.com/CORJAR-Computers/dynarent/releases/download/v1.2.7/Dynarent_1.2.7_x64-setup.exe) (NSIS, recomendado) | 22.793.189 B (~22 MB) | `D37B3796158F3E6C1453D185BE4F0AA8B4A4120DCF8D2CDB06E9C1D0DCA630B4` |
| [`Dynarent_1.2.7_x64_en-US.msi`](https://github.com/CORJAR-Computers/dynarent/releases/download/v1.2.7/Dynarent_1.2.7_x64_en-US.msi) (GPO/Intune) | 34.129.615 B (~33 MB) | `18B100A2520486F6A02BAB3F478E8EF2B1ED7C784F2C0B757E7054703C4D9F78` |

La release incluye además los `.sig` ×2 y el `latest.json` (plataforma `windows-x86_64` → MSI). Enlaces, historial de versiones y credenciales iniciales en [`INSTALACION_OPERACIONES.md`](INSTALACION_OPERACIONES.md).

**Qué corrige la v1.2.7** (informe de revisión del 20-10):

1. **[Crítico] Cierre de renta**: el recálculo omitía `valor_gasolina` de los extras — el total/saldo del contrato cerrado quedaba por debajo de lo pactado. Helper único `extras_de()` para que las 3 rutas de recálculo no vuelvan a divergir.
2. **Pagos**: montos cuantizados a 2 decimales (fin del drift half-even/half-up entre rust_decimal y el CAST de Firebird) y **anti-TOCTOU**: el saldo se relee y revalida dentro de la transacción con `FOR UPDATE WITH LOCK` y el UPDATE aplica aritmética SQL con guard.
3. **Seguridad PII**: cifrar con `db_encryption_key` vacía ahora **rechaza** (antes cifraba con `SHA-256("")`, derivable públicamente); descifrado de emergencia intacto.
4. **Sesiones**: `debe_cambiar_password` se enforce en el backend (antes solo el frontend); la contraseña semilla `admin123` ya no se escribe en `app.log`.
5. **Rendimiento**: ~40 comandos Tauri convertidos a `async` + `spawn_blocking` (helper `en_blocking`) — los LIKE que escanean tablas y las transacciones ya no congelan la UI.

## 2.1 Anexo — hitos históricos (detalle en `CHANGELOG.md`)

- **v1.0.17** (18-08): backups de la BD (Fase 8), edición de rentas cerradas, extensiones acumulables.
- **v1.0.21** (19-08): tracing, informes optimizados, auditoría inmutable, WCAG 2.1, ts-rs.
- **v1.0.30/31** (28-29-08): NSIS per-user/per-machine, multi-moneda.
- **v1.2.0/2** (sep): gestión integral de rentas, sync web bidireccional, ronda QA (fechas locales, doble cobro en extensiones).
- **v1.2.5** (06-10): fix crítico del updater (pubkey) — a partir de aquí el auto-update funciona en todas las instalaciones nuevas.
- **v1.2.6** (11-10): guard de firma en CI, modal stacking, 61 archivos de test.

## 3. CI (GitHub Actions)

- **`ci.yml`** (cada push/PR a main): eslint · svelte-check (0/0) · **vitest (785 tests en 63 archivos)** · vite build · **cargo test --lib (107)** + 21 suites de integración con BD sembrada por `seed_ci` (incluye backups/restauración con gbak real) · cargo check (all-targets + bins de mantenimiento) · **test del importador Python (16 casos)** · **verificador de despliegue `-DryRun` (caso OK y caso FALLOS)**.
- **`release.yml`** (por tag `v*`): construye y publica el instalador (NSIS + MSI) vía `tauri-action`, con **body de release generado automáticamente** (changelog con los commits entre el tag anterior y el nuevo). **Firma los bundles para el auto-update** (`.sig` + `latest.json`) con el secret `TAURI_SIGNING_PRIVATE_KEY` (configurado — la v1.0.3 salió firmada).
- **Nota de operación:** el CI usa `cancel-in-progress` por rama — en pushes consecutivos solo el run del **tope** de main queda completo (los intermedios salen `cancelled`). Para verificar, mirar el run del HEAD.

## 4. Herramientas de operación (`scripts/`)

| Herramienta | Para qué | Uso |
|---|---|---|
| **`importar_autos_clientes.py`** | Poblar Autos/Clientes desde dump SQL o Excel (upsert idempotente por placa/no_doc, PII cifrados con la clave del destino, dry-run por defecto, `--commit` transaccional) | `python scripts/importar_autos_clientes.py --sql dump.sql --commit` |
| **`test_importar_autos_clientes.py`** | Test de regresión del importador (16 casos, sin BD; corre en CI) | `python scripts/test_importar_autos_clientes.py` |
| **`verificar-despliegue.ps1`** | Post-instalación en el equipo del cliente: exe v1.2.7, arranque vivo 10 s, `config.ini` + BD del primer arranque — veredicto OK/FALLOS | `powershell -File scripts/verificar-despliegue.ps1` |
| **`updater_e2e`** (bin de dev) | Verificación E2E del updater contra la release publicada: detección de versión + firma minisign contra la pubkey de producción + bytes idénticos al instalador (ejecutado con éxito para la v1.2.7 el 20-10) | `cd src-tauri && cargo run --features dev --bin updater_e2e -- --endpoint <latest.json> --expect-version 1.2.7 --expect-file <msi>` |
| **`dynarent-sandbox.wsb` + `smoke-test-sandbox.ps1`** | Smoke test del instalador en Windows limpio (Sandbox) | abrir el `.wsb`; resultado en `smoke-result.txt` |
| **`verificar-despliegue-sandbox.ps1` + `dynarent-sandbox-verificar.wsb`** | Validar el verifier contra una instalación real en Sandbox | abrir el `.wsb` |
| **`check-simit.mjs` / `watch-simit.mjs` / `test-check-simit.mjs`** | Monitoreo del agente SIMIT: disponibilidad del portal, sonda E2E con token, alertas de total pendiente | `node scripts/check-simit.mjs` |
| **`backup-antes-rotacion.sh` / `verificar-rotacion.sh`** | Respaldo y verificación antes de rotar la clave PII | ver `SECURITY.md` |

## 5. Documentación clave

| Documento | Contenido |
|---|---|
| [`INSTALACION_OPERACIONES.md`](INSTALACION_OPERACIONES.md) | Guía de instalación para operaciones: enlaces directos a los assets, **historial completo de versiones (§0)**, credenciales iniciales, verificación, rollback y auto-actualización (§6) |
| [`DEPLOYMENT_CLIENTES.md`](DEPLOYMENT_CLIENTES.md) | Plan de despliegue en equipos de clientes: instalación silenciosa, verificación post-instalación (sha256 de la v1.2.7), backup y rollback — con las rutas de actualización por versión instalada |
| [`Handsoff.md`](Handsoff.md) | Registro técnico completo: módulos, decisiones, herramientas de operación (§6), bugs de instalación y CI |
| [`README.md`](README.md) | Descarga/instalación para usuarios finales + documentación de desarrollo |
| [`SECURITY.md`](SECURITY.md) | Secretos, rotación de clave PII, reporte de vulnerabilidades |

## 6. Veredicto

**El proyecto está en producción con la v1.2.7 publicada y verificada** (construida por CI, firmada para el auto-update, E2E del updater validada sin máquina — detección, firma minisign y bytes —, y suite completa en verde: 785 tests frontend, 107 lib + 21 suites de integración). El kit de operaciones (instalación con historial de versiones, verificación, importación de datos, monitoreo SIMIT, backups con restauración) está documentado y actualizado a la versión vigente. La **auto-actualización es plenamente funcional** (secret `TAURI_SIGNING_PRIVATE_KEY` + pubkey embebida alineadas desde la v1.2.5). Los pendientes conocidos son de mantenimiento fino (spawn_blocking para `login`, refactors de duplicación frontend, cifrado de `no_doc`/nombres), no bloqueos.
