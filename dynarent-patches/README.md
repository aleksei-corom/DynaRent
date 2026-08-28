# DynaRent — Patches de Mejora

Revisión del repositorio **https://github.com/aleksei-corom/DynaRent.git**
commit base: `ec2a133` (`fix: CI pass - empresa pais, backup tests, costoLavado, clippy, prettier, svelte-check`)

## Cómo aplicar

```bash
# 1. Clonar el repo a revisar
git clone https://github.com/aleksei-corom/DynaRent.git
cd DynaRent

# 2. Aplicar TODOS los parches en orden
git am /ruta/a/dynarent-patches/0*.patch

# — o, si no se quiere crear commits —
for p in /ruta/a/dynarent-patches/0*.patch; do git apply "$p"; done
```

> Todos los parches pasan `git apply --check` tanto individualmente como
> aplicados de forma secuencial sobre `ec2a133`. No hay conflictos entre
> ellos. El archivo `000-ALL-combined.patch` contiene todos los cambios en
> un único diff (útil para revisión rápida).

## Resumen

**30 mejoras** distribuidas en tres frentes:

| Frente | Rango | Cantidad |
|---|---|---|
| Backend Rust (`src-tauri/`) | 001–011 | 11 |
| Frontend Svelte/TS (`src/`) | 020–029 | 10 |
| Seguridad / Config / CI | 040–048 | 9 |

Categorías: `bug` (corrección), `sec` (seguridad), `perf` (rendimiento),
`a11y` (accesibilidad), `types` (tipado), `quality` (calidad de código),
`ci` (CI/CD), `config`, `build`, `pii`.

---

## 001–011 · Backend Rust

| # | Archivo | Problema → Solución |
|---|---|---|
| 001 | `services/dashboard.rs` | **bug**: `rentas_activas` contaba solo `estado = 'Activo'` pero el sistema persiste tanto `'Activa'` como `'Activo'`. El dashboard sub-reportaba rentas activas. **Fix**: `estado IN ('Activa','Activo')`. |
| 002 | `services/informe.rs` | **bug**: `utilidad_por_vehiculo` ordenaba por la **cadena** decimal (`"9.00" > "100.00"` lexicográfico). **Fix**: comparar como `Decimal`. |
| 003 | `services/renta.rs` | **bug**: `completar_cliente` usaba `if let Ok(Some(c)) = ...` y tragaba errores de BD, persistiendo la renta con datos stale del frontend. **Fix**: devolver `Result` y propagar con `?`. |
| 004 | `services/reserva.rs` | **bug**: mismo patrón silencioso que 003, en `reserva::completar_cliente`. Misma corrección. |
| 005 | `services/cliente.rs` | **bug**: `recientes(limit)` pasaba el `i64` directo a `SELECT FIRST {limit}` sin clampear. `limit=0` devolvía 0 filas, negativos producían semántica rara de Firebird. **Fix**: `limit.max(1)`. |
| 006 | `repositories/renta.rs` | **bug**: `RentaRepository::eliminar` hacía 2 UPDATEs (soft-delete renta + cascada pagos) sin transacción. Si el 2.º fallaba, la renta quedaba marcada borrada pero sus pagos activos → estado huérfano. **Fix**: `with_transaction(...)`. |
| 007 | `repositories/renta.rs` | **quality**: `insertar_pago` no tenía llamadores (el servicio implementa su propia versión que también escribe auditoría). Método muerto y además sin transacción. **Fix**: eliminado. |
| 008 | `repositories/gasto.rs` | **quality**: último repositorio con helpers locales `map_fb_error`, `opt_str`, `parse_fecha` y macro `params!` duplicados de `core::repository` (~50 LOC). **Fix**: importar del core. |
| 009 | `repositories/comparendo.rs` | **quality**: ídem 008, más `parse_hora` local (~65 LOC). **Fix**: importar del core. |
| 010 | `services/informe.rs` | **bug**: `informe_mensual` pasaba strings de fecha crudos a queries sobre columnas DATE; fechas inválidas daban error genérico de BD. **Fix**: parsear con `NaiveDate` y validar `inicio <= fin` temprano. |
| 011 | `commands/auditoria.rs` | **perf**: `listar_auditoria` era `#[tauri::command]` síncrono y bloqueaba el event loop de Tauri con 2 queries Firebird + LIKE sobre `auditoria`. **Fix**: `async` + `spawn_blocking`, patrón ya usado en `listar_rentas` e `informe_mensual`. |

## 020–029 · Frontend Svelte 5 / TypeScript

| # | Archivo | Problema → Solución |
|---|---|---|
| 020 | `routes/alertas/+page.svelte` | **bug**: `diasVencimiento` era `$derived.by` sin deps reactivas; `hoy` se computaba al montar y nunca se refrescaba. Si la app pasaba la medianoche abierta, los badges “vence en N días” quedaban stale. **Fix**: convertir a función que recomputa `hoy` en cada llamada. |
| 021 | `routes/calendario/+page.svelte` | **bug**: `cargar()` se disparaba por `onMount` y por un `$effect` sobre `mesActual`; la navegación rápida entre meses disparaba calls solapadas y la respuesta vieja podia sobreescribir la nueva, dejando el spinner colgado. **Fix**: token monotónico `cargaId`. |
| 022 | `lib/stores/empresa.svelte.ts` | **bug**: `cargarPublica()` guardaba con `if (cargado) return`, pero `cargado` se setea en `finally` (post-await). Layout y login montando en el mismo tick generaban 2 requests duplicados a `empresaApi.publica()`. **Fix**: cachear la promise en vuelo (mismo patrón que `BusinessListsStore.ensure`). |
| 023 | `routes/usuarios/+page.svelte` | **bug**: el modal de crear/editar usuario y el de forzar reset de password usaban `dismissible=true` por defecto; el backdrop/Esc cerraba el modal a mitad de guardado, `guardando` quedaba en `true` y el form mostraba estado stale al reabrir. **Fix**: `dismissible={!guardando}` / `!forcando`. |
| 024 | `routes/clientes/+page.svelte` | **a11y**: botones Editar/Eliminar de la tabla de clientes solo tenían `title` (soporte inconsistente en screen readers). **Fix**: `aria-label="Editar cliente {nombre}"`. |
| 025 | `routes/autos/+page.svelte` | **a11y**: ídem 024 en la tabla de vehículos. **Fix**: `aria-label="Editar vehículo {placa}"`. |
| 026 | `lib/components/SearchSelect.svelte` | **bug**: el timer de 120 ms de `onBlurInput` solo miraba `abierto`, no si el foco realmente salió del componente. Re-enfocar dentro de 120 ms cerraba el dropdown mientras se escribía. **Fix**: `rootRef.contains(document.activeElement)`. |
| 027 | `lib/api/base.ts` | **types**: la rama de error estructurado de `invokeCmd` castaba cualquier objeto con `kind` a `ApiErrorPayload` sin verificar `message`. Si Tauri rechazaba con `{kind}` sin `message` string, el constructor recibía `undefined` → toast vacío. **Fix**: validar `kind` y `message` (string) antes del cast. |
| 028 | `routes/+layout.svelte` | **a11y**: el toggle de sidebar y el botón de logout solo tenían `title`. **Fix**: `aria-label` (el del toggle cambia con el estado: “Contraer menú lateral” / “Expandir menú lateral”). |
| 029 | `lib/components/Toast.svelte` | **a11y**: todos los toasts usaban `role="status"` + `aria-live="polite"`. Los de error deben interrumpir. **Fix**: errores con `role="alert"` + `aria-live="assertive"`; success/info/warning se mantienen en `status`/`polite`. |

## 040–048 · Seguridad / Config / CI / Build

| # | Archivo | Problema → Solución |
|---|---|---|
| 040 | `src-tauri/tauri.conf.json` | **sec**: el CSP no tenía `form-action` ni `upgrade-insecure-requests`. Un futuro form podría exfiltrar datos a una URL externa si un XSS bypasea `script-src`. **Fix**: `form-action 'self'; upgrade-insecure-requests`. |
| 041 | `src-tauri/src/core/config.rs` | **sec**: `DEFAULTS` y el fallback de `load()` hardcodeaban `"masterkey"` (credencial Firebird por defecto conocida). En primer arranque, el `config.ini` generado contenía `password = masterkey`. **Fix**: default `""` (Firebird embedded no usa password). |
| 042 | `src-tauri/src/core/config.rs` | **sec**: `AppConfig` derivaba `Debug` y exponía `db_password`, `db_encryption_key`, `backup_encryption_password`. Un futuro `log::debug!("{:?}", config)` los volcaría en claro al log. **Fix**: `Debug` manual que imprime `"<redacted>"` para los 3 campos secretos. |
| 043 | `.github/workflows/ci.yml` | **ci**: CI verificaba formato, clippy, tests y build, pero nunca escaneaba CVEs de dependencias Cargo. **Fix**: job `security-audit` con `cargo audit --deny warnings` sobre `src-tauri/Cargo.lock`. |
| 044 | `.github/workflows/ci.yml` | **ci**: sin escaneo de vulnerabilidades npm. **Fix**: paso `npm audit --audit-level=high --omit=dev` tras el prettier check. |
| 045 | `eslint.config.js` | **config**: `@typescript-eslint/no-explicit-any` estaba en `'warn'`; los `any` entraban a producción con solo un warning. **Fix**: `'error'` (verificado: 0 `any` en código de producción). |
| 046 | `vite.config.ts` | **build**: `build.sourcemap` por defecto es `false` pero implícito. Un futuro cambio de plugin/config podía habilitar source maps y enviar el TS/Svelte original al bundle de Tauri. **Fix**: `build: { sourcemap: false }` explícito. |
| 047 | `.npmrc` | **config**: las dependencias nuevas se guardan con rangos semver (`^x.y.z`), permitiendo upgrades silenciosos minor/patch. **Fix**: `save-exact=true` (lo respetan tanto `npm` como `bun`). |
| 048 | `src-tauri/src/services/pii.rs` | **pii**: `guardar_clave` aceptaba cualquier string no vacío como clave PII; una clave débil (“password”) se usaba en silencio para derivar la llave AES-256-GCM que protege PII de clientes. **Fix**: `validar_clave_pii()` exige base64 de exactamente 32 bytes (lo que produce `openssl rand -base64 32`, como documenta `SECURITY.md` §1.2). |

---

## Verificación

- Base: `ec2a133` (HEAD de `origin/main` al momento de la revisión).
- `git apply --check` → **30/30 PASS individual**.
- Aplicación secuencial de los 30 → **30/30 PASS** sin conflictos inter-parche.
- Cada parche toca **un único archivo** (excepto el combined) y **una única preocupación**.
- Sin dependencias de orden entre parches (se pueden aplicar en cualquier orden o cherry-pick selectivo).

## Notas / No incluido

- **`noUncheckedIndexedAccess`**: se consideró pero se descartó; requiere una migración TS dedicada porque rompería `svelte-check` en CI.
- **Pinning de GitHub Actions por SHA**: el CI usa `@v7`/`@v2` (no SHA-pinned). No se parcheó porque requiere verificar hashes reales de commit. Dependabot ya actualiza las actions mensualmente.
- **Session token en localStorage**: para una app Tauri de escritorio con CSP estricta (`script-src 'self'`, sin `unsafe-inline`), el riesgo XSS es mínimo; mover a `sessionStorage` perdería persistencia entre reinicios.
- **`scripts/*.mjs`**: revisados, sin hallazgos accionables.
- Algunas rutas (9) todavía definen `const sid = () => session.token ?? ''` localmente en vez de importar el helper compartido (TAREA E3 ya anotada en los comentarios del código) — se deja para una refactorización mayor.
