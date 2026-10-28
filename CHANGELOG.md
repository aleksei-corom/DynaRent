# Changelog

Historial de cambios de **Dynarent ERP** (Tauri V2 + Rust + Firebird Embedded).

Las versiones se publican como [releases en GitHub](https://github.com/aleksei-corom/DynaRent/releases) con instaladores NSIS/MSI firmados y auto-update vía `tauri-plugin-updater`.

---

## [Unreleased]

### Cambiado
- **`mantenimiento/+page.svelte` 646 → 234** líneas (`MantenimientoListado`,
  `ModalFormMantenimiento`), con el mismo patrón de orquestador de §7.7 del
  Handsoff. Sin cambios de comportamiento: los 31 tests de la página pasan sin
  tocarlos.
- **`gastos/+page.svelte` 579 → 221** líneas (`GastosListado`,
  `ModalFormGasto`), mismo patrón. Los 26 tests de la página pasan sin tocarlos:
  markup movido verbatim (solo cambian callbacks, el token `sesion` y
  `editando` → `modo`).
- **`informes/+page.svelte` 464 → 218** líneas (`InformesResumen`,
  `InformesGastosRentas`, `InformesUtilidad`). Los 18 tests de la página pasan
  sin tocarlos; el `.print-area` mantiene los tres bloques, así que imprimir/PDF
  no cambia.
- **`calendario/+page.svelte` 451 → 288** líneas (`CalendarioGrid`,
  `CalendarioDetalleDia`). Los 13 tests de la página pasan sin tocarlos; el
  índice `itemsPorDia` y el token anti-carrera de carga siguen en la página.
- **`alertas/+page.svelte` 428 → 189** líneas (`AlertasResumen`,
  `AlertasVencimientos`, `AlertasMantenimientoKm`, `AlertasRentas`,
  `AlertasComparendos`); los helpers de días/badges (`diasVencimiento`,
  `badgeClases`, `diasLabel`, `diasClases`) pasan a `#lib/utils/alertas.ts`
  porque los comparten las cuatro secciones. Los 16 tests de la página pasan
  sin tocarlos.

### Mantenimiento
- **Test de exportación a Excel de `comparendos` estabilizado**: fallaba solo en
  la corrida completa (798/799) con `createObjectURL` sin llamar. Se precarga
  `exceljs` una vez por archivo (el `import()` dinámico de la página podía tardar
  más que la espera del test bajo carga) y `clickDescargarExcel()` re-consulta el
  botón dentro del `waitFor` en vez de pulsar un nodo capturado antes del
  re-render del panel SIMIT. Sin tocar timeouts ni el piso del ratchet.
- Cobertura de ramas **82.38 %** (799 tests, 63 archivos; piso 81.9).

---

## [v1.2.9] — 2026-10-28

Versión de mantenimiento: descompone las cinco rutas más grandes en componentes
(sin cambios de comportamiento), cierra deuda técnica del backend y actualiza el
stack de pruebas. No hay cambios de esquema ni migraciones: la BD existente abre
tal cual.

### Corregido
- **Cerrar el modal de impresión dejaba la app en blanco**: si se cerraba durante
  la ventana de espera de fuentes/logo (hasta 1500 ms), `printing-clone` quedaba
  huérfano en el `body` y `app.css` ocultaba todo lo demás hasta completar el
  diálogo de impresión. Nuevo `cancelarImpresion()` (cancela los timers, evita el
  print fantasma y ejecuta la misma limpieza que `afterprint`), aplicado en
  rentas y reservas; +1 test de regresión con fake timers.
- **`confirm()` nativo → `ConfirmDialog`** en claves PII y truncado de logs: ahora
  hay focus trap, botón deshabilitado mientras procesa y Spinner (el `confirm()`
  de WebView2 permitía doble clic y disparaba dos truncados).
- **Calendario multi-moneda**: el panel de detalle formateaba siempre en COP con
  un `Intl.NumberFormat` propio; ahora usa `formatMoney()` (moneda del store de
  empresa). +1 test con `setCurrency('USD')`.
- **Exportación sin doble clic** en los informes; iconos del dashboard
  corregidos y el badge de reservas web ya no muestra un conteo obsoleto cuando
  la consulta falla (marca el error en vez de fingir «0 pendientes»).

### Rendimiento
- **Login async por fases** (H-3): `AuthService::login` se divide en
  `login_checks` → `login_verify` (Argon2id + re-hash legacy) → `login_finish`;
  el comando Tauri corre la verificación en `spawn_blocking`, así que los
  ~100-300 ms de cómputo ya no congelan la ventana de login. `login()` queda
  como composición síncrona para no romper los tests de integración.
- **`gbak` sin contraseña en `argv`**: backup y restauración la pasan por
  `ISC_PASSWORD` (entorno) — antes era legible por cualquier proceso local
  (Task Manager / WMI).

### Cambiado
- **Refactor de las cinco rutas más grandes**, sin cambios de comportamiento:
  - `rentas/+page.svelte` **1946 → 750** líneas (`ModalFormRenta`,
    `RentasListado`, `ModalImpresionRenta`).
  - `reservas/+page.svelte` **1248 → 328** (`ModalFormReserva`,
    `ReservasListado`, `ModalImpresionReserva`).
  - `comparendos/+page.svelte` **1147 → 507** (`ComparendosListado`,
    `PanelAgenteSimit`, `ModalFormComparendo`, `ModalImpresionComparendo`).
  - `usuarios/+page.svelte` **745 → 186** (`UsuariosListado`,
    `ModalFormUsuario`, `ModalForzarPassword`).
  - `autos/+page.svelte` **712 → 190** (`AutosListado`, `ModalFormAuto`).

  Las páginas quedan como orquestadores (datos, filtros con debounce, secuencia
  anti-carrera, confirmaciones); los formularios reinician el borrador con un
  token `sesion` no reactivo + `$effect` guardado, así que recargas de
  clientes/vehículos/listas ya no pisan lo que el usuario está escribiendo. El
  markup y los textos se movieron verbatim y los tests de cada página (33
  reservas, 60 comparendos, 16 usuarios, 20 autos) pasan sin tocarlos.
- **Debounce centralizado** en las 7 rutas que aún duplicaban el patrón manual
  (`useDebouncedEffect`); `immediateIf` agrupa los cambios del mismo tick en una
  sola recarga (antes «desde»+«hasta» en auditoría disparaban dos).

### Mantenimiento
- **`ts-rs` retirado**: generaba tipos en `src/lib/types/generated/`, carpeta que
  no existía y que ningún consumidor importaba. El contrato FE↔BE sigue manual
  en `src/lib/api.ts`, cubierto por `devGuard` y los tests de comportamiento.
- **SQL muerto eliminado** en `repositories/renta.rs`: 6 métodos sin llamadores
  cuyo SQL ya había divergido del servicio (no actualizaban `valor_neto`).
- **Dependencias**: Vitest 5.0.5 + `@vitest/coverage-v8` 5.0.5 (en pareja),
  testing-library/jsdom, `serial_test` 4.0.1, `@tauri-apps/api` y `cli` 2.12.x,
  stack Rust de Tauri emparejado con el JS (tauri 2.12.5 y plugins), `sha2`,
  `actions/cache` v6, `actions/upload-artifact` v7. `bun.lock` regenerado.
- **CI**: `cargo-audit` vía binario precompilado (~10 s en vez de 2-4 min por
  run); el smoke sube sus PDF/capturas con `include-hidden-files` y reintenta el
  clic de «Imprimir orden» cuando el listado se recarga tras el pago.
- **Flake de comparendos corregido en el test** (esperaba a que «Descargar
  Excel» estuviera habilitado, carrera contra `simit_sync_status`): suite
  paralela estable.
- Cobertura de ramas **82.29 %** (799 tests, 63 archivos; piso 81.9).

---

## [v1.2.8] — 2026-10-27

### Corregido
- **Bypass del cambio de contraseña obligatorio**: los gates de rol
  (`require_usuario_admin` / `require_informes` / `require_eliminacion`) validan vía
  `validate_role`, que no chequeaba `debe_cambiar_password` — un `admin/admin123` con el
  cambio pendiente podía alcanzar por IPC ~20 comandos administrativos (eliminar_*,
  backups, claves PII, empresa, informes, SIMIT) sin pasar por `require_session`. El
  chequeo vive ahora en `validate_role` (hallazgo H-1 de la revisión del 26-10).
- **Pagos**: el UPDATE con guard precede al INSERT del pago dentro de la transacción —
  si el guard de saldo fallara, ya no se habría escrito nada (endurecimiento H-2; antes
  un guard fallido tras el INSERT habría comiteado un pago huérfano sin descuento).
- **Montos con coma decimal (crítico financiero)**: los inputs de dinero son texto con
  `inputmode="decimal"` y la coma es entrada válida en es-CO, pero rust_decimal no la
  acepta y el backend la convertía en **0**. Nuevos helpers `parseMontoLocal` /
  `normalizarMonto`: las calculadoras en vivo de rentas y reservas muestran el total
  correcto con coma, y gastos/mantenimiento/rentas/reservas normalizan antes del IPC
  (lo validado = lo transmitido; los strings ya válidos como "150000.00" se preservan).
- **Sync web**: `consultarPendientes` rechaza con el código HTTP real si el servidor
  web responde `!ok` (antes `res.json()` sin chequear: un 500 no-JSON reventaba con
  SyntaxError y uno con JSON se aplanaba a «0 pendientes» escondiendo el fallo); y
  `valorDia` sin `Math.round` — `valorDia × días` vuelve a cuadrar con `totalAmount`.
- **Vulnerabilidades RUSTSEC-2026-0381/0382/0383/0385** del stack TLS/cripto:
  `rustls-webpki` 0.103.16, `webpki-roots`/`webpki-root-certs` 1.0.11, `ctutils`
  0.4.6 — afectaban la cadena del updater (rustls-tls), el agente SIMIT (ureq) y el
  stack RustCrypto. Solo cambia `Cargo.lock`.

### Rendimiento
- **`change_password` y comandos PII en `spawn_blocking`** (H-3): la verificación y el
  re-hash Argon2id (~100-500 ms) y el análisis PII (escaneo completo de clientes +
  descifrado por registro) ya no congelan la ventana.
- **Calendario O(1) por celda**: índice por día computado una vez por cambio de datos
  (antes se recorrían todas las rentas y reservas por cada una de las 42 celdas en
  cada render).

### Mantenimiento
- Dependabot: ignorados los minors/majors de `rsfbclient` hasta que `r2d2_firebird`
  publique soporte para 0.28+ (el PR #1 rompía la compilación con tipos duplicados).
- Cobertura de ramas al 82.05 % (795 tests, 63 archivos) con la tanda que cubre las
  ramas nuevas de montos, calendario y syncWeb.

---

## [v1.2.7] — 2026-10-20

### Corregido
- **Cierre de renta (crítico)**: el recálculo de totales omitía `valor_gasolina` de los
  extras — el total/saldo/valor_neto del contrato cerrado quedaba por debajo de lo
  pactado y divergía de crear/extender/editar-cerrada. Se extrajo el helper único
  `extras_de()` (`services/renta.rs`) para que las rutas de recálculo financiero no
  vuelvan a divergir.
- **Pagos**: el monto se cuantiza a 2 decimales (se rechaza precisión extra) para que
  el redondeo de rust_decimal (half-even) y el `CAST DECIMAL(12,2)` de Firebird
  (half-up) no diverjan entre `pagos.monto` y `rentas.abono/saldo_pendiente`. Mismo
  guard para el valor unitario de extensiones.
- **Pagos concurrentes (TOCTOU)**: el saldo se relee y revalida DENTRO de la
  transacción con `FOR UPDATE WITH LOCK` y el UPDATE aplica aritmética en SQL con
  guard `saldo_pendiente >= monto` — dos pagos simultáneos ya no pueden pisarse ni
  superar el saldo (antes se leía fuera y se escribían valores absolutos).
- **PII sin clave configurada**: cifrar con `db_encryption_key` vacía ahora RECHAZA la
  operación (antes cifraba con `SHA-256("")` — constante derivable públicamente — solo
  con un warn en el log). El descifrado de emergencia de datos `v1:` preexistentes
  sigue funcionando para no volver ilegible lo ya guardado.
- **Cambio de contraseña obligatorio**: ahora se enforce en el backend
  (`require_session` bloquea todos los comandos de negocio mientras esté pendiente) —
  antes solo lo controlaba el frontend, así que `admin/admin123` podía operar el ERP
  indefinidamente. `cambiar_password` desbloquea en caliente las sesiones del usuario
  en memoria y la contraseña semilla ya no se escribe en `app.log`.
- **Override por variable de entorno**: `AppConfig` lee `DYNARENT_DB_ENCRYPTION_KEY`
  (nombre actual) y acepta `DINAMO_DB_ENCRYPTION_KEY` como alias legacy — el override
  documentado en `SECURITY.md` ≤ v1.2.6 no tenía efecto en el código.

### Rendimiento
- **~40 comandos Tauri convertidos a `async` + `spawn_blocking`** (helper común
  `en_blocking` en `commands/mod.rs`): las consultas Firebird bloqueantes (filtros
  LIKE que escanean tablas, transacciones de pagos/creación, Argon2 de usuarios) ya
  no congelan la UI mientras corren. El patrón TAREA 3.4 (que solo cubría 5 comandos)
  se extiende a renta, clientes, autos, reservas, gastos, mantenimientos, comparendos,
  usuarios y auditoría. Quedan sync solo los comandos rápidos o con estado no-clonable
  (tema, desbloquear usuario, empresa por PK).

---

## [v1.2.6] — 2026-10-10

### Corregido
- **Pipeline de release**: el guard de firma del updater en `release.yml` exportaba
  `TAURI_SIGNING_PRIVATE_KEY` como env y además pasaba `-f` (private-key-path) al CLI de
  Tauri; clap detecta ambos y aborta con «the argument '--private-key-path' cannot be used
  with '--private-key'» (exit 2) — falló el primer intento de publicar v1.2.6. El paso ahora
  vuelca el secret a un archivo con un nombre de env arbitrario (`FIRMA_KEY`); ver
  `SECRET_FIRMA_UPDATER.md` § "Gotcha del CLI".
- **Modal stacking**: Escape y Tab ahora solo afectan al modal superior de la pila (antes el
  modal de abajo también reaccionaba y cerraba/desplazaba el foco por debajo del superior).
  Pulido general de UI/UX en diálogos.
- **Sync Web**: los errores de red se propagan a la página —antes fallaban en silencio— y los
  `ApiError` sin mensaje muestran un fallback «genérico» en lugar de un texto vacío.
- **Tests smoke**: se precalienta vite, se usa `data_dir` fresco y selectores del formulario
  actual (elimina el flaky del smoke E2E).

### Añadido
- **Migración a SvelteKit 3 + ESLint 10** (dev): rompe `svelte.config.js` y `$lib` a propósito —
  ver README para la guía de migración.
- **Manual de usuario** en PDF/HTML con script generador.
- **CI**: guard de la clave del updater y ignorados los majors de TypeScript en Dependabot.

### Cambiado
- **Cobertura de tests**: de 14 a 61 archivos de test (749 tests) — nuevas suites para api
  (gastos, mantenimiento, auditoría, syncWeb), stores (session, empresa, app), utils (format,
  geografia, debounce, timeline…), componentes (DataTable, Modal, SelectConNuevo,
  PaletaComandos…) y páginas (dashboard, logs, backups, cambiar-password). Gate de CI con
  ratchet de ramas al **82 %** (82.69 % medido; era 61.69 % al inicio de la campaña).

---

## [v1.2.5] — 2026-10-06

### Corregido
- **Auto-update**: la `pubkey` de `src-tauri/tauri.conf.json` quedó alineada con la clave
  que realmente firma los instaladores (`TAURI_SIGNING_PRIVATE_KEY` en GitHub Actions /
  `~/.tauri/dynarent.key`, key ID `73F96EF7F5E69FCE`). Todas las releases (v1.0.14 → v1.2.5)
  estaban firmadas con esa clave, pero los builds anteriores a esta versión embebían otra
  pubkey, así que su verificación de update fallaba.

### ⚠️ Importante — si vienes de v1.2.4 o anterior
- Esas instalaciones fallan el auto-update con:
  *"The signature was created with a different key than the one provided"* (la app vieja
  valida con la pubkey `4BB969BC7B0ED52F`, que nunca firmó ninguna release).
- **Solución (una sola vez): reinstalar manualmente** `DynaRent_1.2.5_x64-setup.exe` desde
  los assets de la release. A partir de v1.2.5 el auto-update vuelve a funcionar solo.
- No se puede automatizar a propósito: el updater de la app vieja solo acepta firmas de su
  pubkey original, que es exactamente lo que garantiza la firma.

---

## [v1.0.21] — 2026-08-20

### Corregido
- **Nombre de empresa** actualizado a "DINAMO RENT A CAR" en fallback, informes Excel y test
- Sección **Empresa ocultada** del sidebar (uso interno de Dynarent a Car)
- Cargo.lock sincronizado con la versión 1.0.21

---

## [v1.0.20] — 2026-08-20

### Corregido
- **Crash de tracing_subscriber** en Windows sin consola — cambiado a `try_init()` silencioso
- Resolución de conflicto entre `tracing_subscriber` y `tauri_plugin_log`

### Añadido
- **Sistema de logs** para diagnóstico de errores y bugs:
  - Comandos Tauri: `leer_logs`, `leer_errores_frontend`, `registrar_error_frontend`, `exportar_logs`, `limpiar_logs`
  - Captura global de errores JS (`window.onerror`, `unhandledrejection`) con debounce
  - Página `/logs` (admin only) con vista, exportación y truncado
  - Icono `logs` (terminal) en el sidebar

---

## [v1.0.19] — 2026-08-20

### Corregido
- **Crash en app GUI** — `tracing_subscriber::fmt().init()` causaba panic en Windows sin consola

### Añadido
- Documentación de los Bloques 1-4 en Handsoff.md

---

## [v1.0.18] — 2026-08-20

### Añadido

#### ⚡ Bloque 1 — Performance
- **Informes optimizados** con `UNION ALL` (13→5 round-trips a Firebird)
- **Store global `BusinessLists`** con TTL 5 min para listas de config
- **`async spawn_blocking`** en `listar_rentas` e `informe_mensual`

#### 🏗️ Bloque 3 — Code Quality
- **`core::repository`** centraliza helpers DRY (`map_fb_error`, `opt_str`, `parse_fecha/hora`, `params!`)
- **`domain/`** scaffold para value objects
- **Migración 0025** `audit_inmutable` (excepciones nombradas + triggers append-only)
- **`ts-rs`** para contratos TypeScript

#### ♿ Bloque 4 — Accesibilidad
- **Modal** focus trap + autofocus + restore
- **FormField** ARIA (label, `aria-describedby`, `aria-invalid`)
- **Skip-link** para naveación por teclado
- **Página de error global** (`+error.svelte`)
- **Tracing estructurado** (spans en login/cerrar/pago)

#### 🤖 Infraestructura
- **Dependabot** para npm, cargo y CI
- Verificador de despliegue `-DryRun` en CI

### Corregido
- **Normalización de fechas** en cálculo de vencimiento de rentas (medianoche local)
- **RBAC Informes**: solo Administrador (Supervisor ya no ve informes contables)

---

## [v1.0.17] — 2026-08-19

### Añadido
- **Edición de rentas cerradas** (solo Admin/Supervisor, auditoría ANTES→DESPUÉS)
- **Extensiones acumulables** de rentas (migración 0024, historial de horas/días extra)
- **Mayúsculas automáticas** en campos de texto (excepto email, rol, web)
- **Validación case-insensitive** en login y búsquedas

### Corregido
- Selects de **categoría/tipo** en mantenimiento y gastos alineados con la DB
- Tabla `extensiones_renta` asegurada en tests de integración

---

## [v1.0.16] — 2026-08-19

### Añadido
- **Versión real de la app** en el menú lateral y el login (comando `app_version`, antes mostraba v3.0)
- **Backups automáticos programados** (config `[backup]`: 4 horarios, rotación a 10 copias)
- **Cifrado AES-256-GCM** de backups (opcional, por chunks con salt PBKDF2)
- **Comando `backup_ahora`** + panel de backups en la UI (crear, listar, estado, restaurar)
- **Restauración de backups** (descifrar si cifrado, gbak -r, rename atómico con reintentos)
- **Verificador de despliegue** `-DryRun` (valida flujo sin tocar máquina real)
- Test de integración `app_version` (verifica que devuelve la versión de Cargo.toml)

### Corregido
- Compartición transitoria (Defender) en backups — reintentos automáticos
- Migración 0025 reescrita (excepciones nombradas Firebird, triggers append-only)

---

## [v1.0.15] — 2026-08-17

### Añadido
- **Comisión por renta** (checkbox + valor; neto = total − comisión) visible en:
  - Informe mensual con comisiones y valor neto
  - Balance general
  - Listado de rentas y timeline por vehículo
- **Comparendos con procedencia persistente** (origen SIMIT/Manual, `ultimo_visto_simit`)
- **Filtros de comparendos**: "No confirmadas por SIMIT" + "Solo nuevos de la última sincronización" (combinables)
- **Persistencia del último resultado** del Agente SIMIT en la BD (sobrevive al reinicio)
- **Verificador de despliegue** `-DryRun` en CI
- CI actualizado a Node 24

### Corregido
- Flaky test de SIMIT con servidor TCP local (elimina dependencia externa)

---

## [v1.0.14] — 2026-08-16

### Añadido
- **Botón "Buscar actualización"** — check manual del updater con feedback en la barra superior

### Corregido
- **Auto-update bloqueado por ACL** — permisos `updater:default` + `process:default` en capabilities
- Auto-update nunca funcionó en ≤v1.0.13, ahora funciona desde esta versión

---

## [v1.0.13] — 2026-08-16

### Añadido
- **Crear renta desde reserva** — acción en reservas y precarga del formulario con `?desdeReserva=<id>`
- **Completar reserva automáticamente** al crear la renta asociada (misma transacción)

### Corregido
- Cálculo unificado de días/horas entre rentas y reservas
- Formulario de reserva estilo renta (consistencia UX)
- Semilla CI determinista para tests de integración

---

## [v1.0.12] — 2026-08-15

### Corregido
- **Contrato de renta** — espacio amplio para firmar (44px sobre la línea) sin romper 2 hojas

---

## [v1.0.11] — 2026-08-15

### Corregido
- **Kilometraje impreso** sin cola de ceros (42000 en vez de 42000.000000000000)

---

## [v1.0.10] — 2026-08-15

### Corregido
- Etiqueta de versión en verificar-despliegue

---

## [v1.0.9] — 2026-08-15

### Corregido
- **Contrato a 2 hojas** — logo reducido (70px) y encabezado compacto

---

## [v1.0.8] — 2026-08-15

### Corregido
- **INSERT de rentas** con SQLCODE -804 — conteo exacto de placeholders al agregar `VALOR_GASOLINA`

---

## [v1.0.7] — 2026-08-15

### Corregido
- **Contrato de renta en 2 hojas** — tipografía final 6.2pt / interlineado 0.98

---

## [v1.0.6] — 2026-08-15

### Añadido
- **Contrato a 2 hojas** con cláusulas legales completas
- **Prefijo +57** automático en teléfonos colombianos
- **Multa en blanco** para comparendos sin valor
- **Pólizas** con valores configurables (40/50/70 mil)
- **Cargo de gasolina** en rentas (campo `valor_gasolina`)

### Corregido
- Orden de reserva más legible (sin firmas, tipografía amplia)

---

## [v1.0.5] — 2026-08-14

### Corregido
- **SQLCODE -303** al crear/editar rentas — montos vacíos ya no rompen el CAST DECIMAL

---

## [v1.0.4] — 2026-08-14

### Añadido
- **Errores de BD visibles** en la UI y en log de archivo

---

## [v1.0.3] — 2026-08-14

### Añadido
- **Auto-actualización** de la app con `tauri-plugin-updater` (vía `latest.json` en GitHub Releases)
- **Orden de renta más legible** — sin firmas, tipografía amplia
- Test E2E del flujo de auto-actualización

---

## [v1.0.2] — 2026-08-13

### Añadido
- **Rentas con IVA** por checkbox (19% configurable)
- **Auto-cálculo de días/horas** en rentas y reservas
- **Cambiar vehículo** en renta activa
- **Combos con búsqueda** (autos, clientes, reservas)
- **Setup inicial de la empresa** con branding dinámico (logo + datos, white-label)
- **Campo ciudad** de la empresa y cláusula compromisoria dinámica
- **Importador** de autos y clientes desde dump SQL o Excel
- Changelog automático en el body de las releases

---

## [v1.0.1] — 2026-08-12

### Corregido
- **Instalación limpia sin cuelgues** — `SetDllDirectoryW` para el runtime VC++ de Firebird
- **BD Firebird se crea** en instalación limpia (bug del release v1.0.0)
- Feature linking de `rsfbclient` desactivado en release build
- Migraciones embebidas (no dependen de archivos en disco)

### Añadido
- Workflows de validación (CI) y publicación automática de releases (GitHub Actions)
- Node 24 en workflows (jsdom 30 requiere Node ≥22.4)

---

## [v1.0.0] — 2026-08-12

Primera release estable. Migración completa de Python a Tauri V2 + Rust + Firebird Embedded.

### Módulos incluidos
- **Autos**: CRUD, estados, alertas de vencimientos (SOAT, técnico, extintor, batería, aceite)
- **Clientes**: CRUD con PII cifrado (AES-256-GCM)
- **Rentas**: CRUD, cálculo de días/horas, pagos, inspecciones, cierre con devolución
- **Reservas**: CRUD, confirmación, cancelación
- **Mantenimiento**: CRUD, alertas por kilometraje
- **Gastos** (Caja Menor): CRUD con categorías
- **Comparendos**: CRUD con atribución a renta/cliente
- **Informes**: Mensual consolidado (ingresos, gastos, balance)
- **Dashboard**: KPIs operacionales (rentas activas, vehículos disponibles, ingresos, alertas)
- **Usuarios**: CRUD con RBAC (Administrador, Supervisor, Operador)
- **Auditoría**: Trail de acciones por usuario
- **Alertas**: Panel consolidado de vencimientos, km y rentas por vencer
- **Calendario**: Vista de rentas/reservas en calendario

### Infraestructura
- Pool de conexiones Firebird Embedded (r2d2)
- Migraciones SQL idempotentes (EXECUTE BLOCK con guards)
- Backup de la BD con gbak
- Seed CI determinista para tests de integración
- Verificador de despliegue post-instalación

---

[v1.2.8]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.8
[v1.2.7]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.7
[v1.2.6]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.6
[v1.0.21]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.21
[v1.0.20]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.20
[v1.0.19]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.19
[v1.0.18]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.18
[v1.0.17]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.17
[v1.0.16]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.16
[v1.0.15]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.15
[v1.0.14]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.14
[v1.0.13]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.13
[v1.0.12]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.12
[v1.0.11]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.11
[v1.0.10]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.10
[v1.0.9]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.9
[v1.0.8]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.8
[v1.0.7]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.7
[v1.0.6]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.6
[v1.0.5]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.5
[v1.0.4]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.4
[v1.0.3]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.3
[v1.0.2]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.2
[v1.0.1]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.1
[v1.0.0]: https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.0
