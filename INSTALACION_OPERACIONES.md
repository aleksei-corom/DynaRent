# Instalación de DynaRent ERP — v1.2.9 (estable)

> Guía para el equipo de operaciones. **Última versión estable: v1.2.9** — release de
> mantenimiento y calidad **sin cambios de esquema**: las cinco rutas más grandes
> (`rentas`, `reservas`, `comparendos`, `usuarios`, `autos`) quedan descompuestas en
> componentes sin cambiar el comportamiento, cerrar la vista previa de impresión ya no
> deja la app en blanco, el calendario usa la moneda configurada por la empresa, el
> login no congela la ventana y el stack de pruebas sube a Vitest 5. La **BD existente
> abre tal cual**. Construida y validada por CI.
>
> Los enlaces de esta guía corresponden a la release v1.2.9, publicada el
> 2026-10-28 (<https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.9>).

---

## 0. Historial de versiones

Todas las releases publicadas (tags de git + `CHANGELOG.md`). La columna «Ruta a la
versión actual» indica cómo actualiza **ese** equipo (detalle en la sección 6).

| Versión | Fecha | Novedades | Ruta a la versión actual |
|---|---|---|---|
| **v1.2.9** | 2026-10-28 | Mantenimiento y calidad: cinco rutas descompuestas sin cambios de comportamiento (`rentas` 1946→750, `reservas` 1248→328, `comparendos` 1147→507, `usuarios` 745→186, `autos` 712→190); `cancelarImpresion()` evita el blanco al cerrar la vista previa; `ConfirmDialog` en claves PII; calendario con la moneda de la empresa; login async por fases; `gbak` sin contraseña en `argv`; Vitest 5. **Sin migraciones** | Auto desde v1.2.8 |
| v1.2.8 | 2026-10-27 | Bypass del cambio de contraseña cerrado en los gates de rol (H-1); pagos: UPDATE con guard antes del INSERT; **montos con coma decimal seguros** (antes "85000,50" llegaba como 0 al backend); sync web: errores HTTP visibles y valorDia sin redondeo; change_password y PII en spawn_blocking; calendario O(1); 4 RUSTSEC TLS parcheadas | Auto desde v1.2.7 |
| v1.2.7 | 2026-10-20 | Fix crítico: cierre de renta incluye `valor_gasolina`; pagos anti-TOCTOU y cuantizados a 2 decimales; PII rechaza cifrar sin clave; cambio de contraseña obligatorio enforce en backend; ~40 comandos async (UI sin bloqueos) | Auto desde v1.2.6 (≤v1.2.4: manual 1 vez) |
| v1.2.6 | 2026-10-11 | Guard de firma del updater en CI, modal stacking (Escape/Tab), sync web con errores propagados, 61 archivos de test (749 tests) | Auto (≤v1.2.4: manual 1 vez) |
| v1.2.5 | 2026-10-06 | **Fix crítico del updater**: la pubkey embebida se alinea con la clave que realmente firma. Las instalaciones ≤v1.2.4 fallaban el auto-update | Auto desde v1.2.5+ (≤v1.2.4: manual 1 vez) |
| v1.2.4 | 2026-10-06 | Tailwind CSS v4, a11y universal en botones, telemetría/resiliencia Firebird | Manual 1 vez (pubkey errónea) |
| v1.2.3 | 2026-09-17 | Guardrail IPC decimal, smoke E2E automatizado, estabilidad de CI | Manual 1 vez |
| v1.2.2 | 2026-09-16 | QA: fechas locales en 8 pantallas, doble cobro en extensiones, salvaguardas de restauración; sync web bidireccional con dedupe de clientes | Manual 1 vez |
| v1.2.1 | 2026-09-02 | Documentación de seguridad y dependencias | Manual 1 vez |
| v1.2.0 | 2026-09-02 | Gestión integral de rentas (backend + UI + tests), reporte de contrato, modal de cierre | Manual 1 vez |
| v1.1.1 | 2026-08-27 | km_final actualiza el kilometraje del auto al cerrar (migración 0028) | Manual 1 vez |
| v1.1.0 | tag 2026-10-06 | Nuevos iconos de marca, configuración de tests | Manual 1 vez |
| v1.0.31 | 2026-08-29 | Multi-moneda (MONEDA + LOCALE en la empresa); costo de lavado en reservas | Manual (updater roto) |
| v1.0.30 | 2026-08-28 | NSIS con modo dual: per-user o per-machine a elección | Manual |
| v1.0.29 | 2026-08-28 | 30 parches (bugs, seguridad, a11y, rendimiento); dependencia vulnerable eliminada | Manual |
| v1.0.28 | 2026-08-28 | Rebrand dinamo-rent → dynarent en todo el código | Manual |
| v1.0.27 | 2026-08-28 | Mejoras técnicas heredadas + limpieza de lint/tipos | Manual |
| v1.0.26 | 2026-08-23 | Hardening SQL, transacciones y auditoría completa | Manual |
| v1.0.25 | 2026-08-23 | Soft-delete completo con auditoría (migración 0027) | Manual |
| v1.0.24 | 2026-08-22 | Fix hora real de cierre en la tabla de rentas + tipos generados | Manual |
| v1.0.23 | 2026-08-22 | Checkbox «Cobrar Horas Extra» (migración 0026) | Manual |
| v1.0.22 | 2026-08-22 | Fix edición de renta cerrada (campos numéricos) | Manual |
| v1.0.21 | 2026-08-19 | Tracing estructurado, informes optimizados, auditoría inmutable, WCAG 2.1 | Manual |
| v1.0.18–v1.0.20 | 2026-08-18/19 | Correcciones del ciclo de release v1.0.17 | Manual |
| v1.0.17 | 2026-08-18 | **Backups de BD** (automáticos, cifrados, restauración), edición de rentas cerradas, extensiones acumulables, mayúsculas automáticas | Manual |
| v1.0.16 | 2026-08-16 | Versión real del binario en la ventana (menú/login/Acerca de) | Manual |
| v1.0.15 | 2026-08-16 | País en el setup inicial, pie de contacto en las órdenes | Manual |
| v1.0.14 | 2026-08-16 | **Rebrand DynaRent + primer auto-update operativo** (hasta aquí llega la transición manual) | Manual (transición) |
| v1.0.13 | 2026-08-15 | Crear renta desde reserva + completado automático + cálculo unificado de días/horas | Manual (updater roto) |
| v1.0.12 | 2026-08-14 | Contrato: espacio de firma (44px) sin romper las 2 hojas | Manual |
| v1.0.11 | 2026-08-14 | Kilometraje impreso sin cola de decimales | Manual |
| v1.0.10 | 2026-08-14 | Contrato 2 hojas sin cortes (margen 16 mm) | Manual |
| v1.0.9 | 2026-08-14 | Contrato: logo y encabezado compactos | Manual |
| v1.0.8 | 2026-08-14 | Fix SQLCODE -804 (placeholder de VALOR_GASOLINA) | Manual |
| v1.0.7 | 2026-08-14 | Contrato: tipografía final 6.2 pt | Manual |
| v1.0.6 | 2026-08-14 | Contrato 2 hojas, +57 en celulares, póliza 40/50/70 mil, gasolina en rentas | Manual |
| v1.0.5 | 2026-08-14 | Fix SQLCODE -303 (montos vacíos en CAST DECIMAL) | Manual |
| v1.0.4 | 2026-08-14 | Errores de BD visibles en la UI y en el log de archivo | Manual |
| v1.0.3 | 2026-08-14 | Llega el updater de Tauri v2 (feature; aún no operativo por ACL) | Manual |
| v1.0.2 | 2026-08-13 | Última versión **sin updater** | Manual (sin updater) |
| v1.0.1 | 2026-08-12 | Parche inicial | Manual (sin updater) |
| v1.0.0 | 2026-08-11 | **DESCONTINUADA**: se colgaba en el Login sin BD previa | No instalar |

> Resumen operativo por grupos (sección 6): **≤ v1.0.2** sin updater · **v1.0.3–v1.0.13**
> updater roto (ACL) · **v1.0.14–v1.2.4** updater activo pero pubkey embebida errónea ·
> **v1.2.5+** auto-update plenamente funcional.

---

## 1. Descarga de los instaladores

Página de la release: <https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.9>

| Instalador | Enlace directo | Tamaño | Uso |
|---|---|---|---|
| **NSIS** (`DynaRent_1.2.9_x64-setup.exe`) | <https://github.com/aleksei-corom/DynaRent/releases/download/v1.2.9/DynaRent_1.2.9_x64-setup.exe> | 22.831.594 B (~22,8 MB) | **Recomendado** — instalación asistida, elige per-user o per-machine |
| **MSI** (`DynaRent_1.2.9_x64_en-US.msi`) | <https://github.com/aleksei-corom/DynaRent/releases/download/v1.2.9/DynaRent_1.2.9_x64_en-US.msi> | 34.195.151 B (~34,2 MB) | Despliegue empresarial / GPO |

**Verificación de integridad** (descargados desde la release y comprobados el 28-10):

- sha256 NSIS: `5D26FBF1877BC2ADDB11EF79DDCE1CCBCD5BDBBB750BA9B11C2ED34667E5F379`
- sha256 MSI: `27ADA799560D1F70DC1B5DDAF826AA5E8494818A5D04F0901C4FBAC2FD3F1C49`

> ⚠️ **No usar la v1.0.0** (descontinuada): falla en equipos sin BD previa. Si un equipo
> ya la tiene instalada **con datos**, no hay que desinstalar — la v1.2.9 abre la BD
> existente tal cual (arranque idempotente, solo aplica migraciones pendientes).

---

## 2. Requisitos del equipo objetivo

- **Windows x64** (Windows 10 1803+ / Windows 11). Windows 7/8 **no** son soportados.
- **Sin requisitos previos de instalación**: el runtime de Firebird y el de Visual C++
  viajan dentro del instalador (`firebird/`), y WebView2 Runtime se instala
  automáticamente si el sistema no lo tiene (requiere conexión a internet en el primer
  arranque del instalador en ese caso).
- **No** se necesita servidor de base de datos: Firebird Embedded usa un archivo `.fdb`
  local en `%APPDATA%\com.corjar.dynarent\`.

---

## 3. Instalación

### Opción A — Asistida (NSIS, recomendada)
1. Ejecutar `DynaRent_1.2.9_x64-setup.exe` como usuario normal.
2. Elegir **Solo para mí** (%LOCALAPPDATA%) o **Para todos los usuarios** (Program Files).
3. Seguir el asistente (siguiente → instalar → finalizar).

### Opción B — Silenciosa (NSIS)
```powershell
# Instala sin interacción, sin atajo ni ejecución al final
DynaRent_1.2.9_x64-setup.exe /S
```

### Opción C — Silenciosa (MSI, para GPO/Intune)
```powershell
msiexec /i DynaRent_1.2.9_x64_en-US.msi /qn /norestart
```

---

## 4. Primer arranque (instalación nueva)

La app crea automáticamente en el primer arranque:

```
%APPDATA%\com.corjar.dynarent\
├── config.ini            # configuración inicial
└── dynarent_v3.fdb    # base de datos Firebird Embedded (portable)
```

**Credenciales iniciales** (instalación nueva):

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Contraseña | `admin123` |

> La app **obliga a cambiar la contraseña** en el primer ingreso — desde la v1.2.8 el
> bloqueo se aplica también en el backend: mientras el cambio esté pendiente, ningún
> comando de negocio responde aunque se salte la pantalla. Registrar la nueva credencial
> en el gestor de contraseñas del cliente y **rotarla** según la política de
> `SECURITY.md` (la clave PII `db_encryption_key` se rota al menos una vez al año).

En una instalación que ya tenía BD (actualización desde v1.0.0), se conservan **todos**
los usuarios y datos — solo se aplican las migraciones pendientes.

---

## 5. Verificación post-instalación

1. La app abre el **Login** sin colgarse (el bug del v1.0.0 se manifestaba justo aquí).
2. Confirmar la versión **v1.2.9** en el menú lateral / login (o con
   `scripts\verificar-despliegue.ps1` → VEREDICTO OK).
3. Ingresar con `admin` / contraseña ya cambiada.
4. Confirmar en el Dashboard que la flota, clientes y rentas aparecen (datos existentes)
   o que la app funciona con la BD nueva.
5. (Opcional) El agente SIMIT aparece operativo en la sección de Comparendos.

---

## 6. Actualizar / rollback

### Auto-actualización (a partir de la v1.0.14)

A partir de la **v1.0.14** la app incorpora el **updater de Tauri v2 funcional** (la feature llegó en la v1.0.3, pero el permiso ACL del plugin faltaba hasta la v1.0.13 — el check fallaba en silencio y el modal nunca aparecía): al arrancar comprueba
en GitHub Releases si hay una versión más nueva (`latest.json`) y, si existe, muestra el
diálogo **«Actualización disponible — vX.Y.Z»** con las notas y los botones **Instalar ahora /
Más tarde** (descarga con progreso, verifica la **firma minisign** contra la clave pública
embebida y reinicia la app al terminar).

**Rutas de actualización por versión instalada** (detalle en la sección 0):

| Instalación con… | Cómo llega a la v1.2.9 |
|---|---|
| **v1.2.8** | Sola: el diálogo de auto-update la detecta e instala al arrancar |
| **v1.2.7** | Sola (auto-update) |
| **v1.2.6** | Sola (auto-update) |
| **v1.2.5** | Sola (auto-update) |
| **v1.0.14 – v1.2.4** | **Manual una sola vez**: esas builds embebían una pubkey del updater errónea y rechazan cualquier firma («The signature was created with a different key…», bug saldado en v1.2.5). Instalar la v1.2.9 encima (idempotente, sin pérdida de datos); desde ahí el auto-update vuelve a funcionar solo |
| **v1.0.3 – v1.0.13** | **Manual** (el diálogo nunca aparece: updater roto por ACL hasta la v1.0.13). Instalar la v1.2.9 encima |
| **≤ v1.0.2** | **Manual** (sin updater). Instalar la v1.2.9 encima |

Notas comunes:

- Cada release publicada incluye los instaladores, sus firmas (`.sig`) y el `latest.json`;
  la clave privada de firma vive solo en el secret `TAURI_SIGNING_PRIVATE_KEY` del repo
  (nunca en el instalador). Publicación: ver `RELEASE_CHECKLIST.md`.
- El chequeo de actualización requiere internet al arrancar; sin conexión la app funciona
  igual y reintenta en el siguiente arranque.
- **Rollback**: si algo fallara, desinstalar y reinstalar la versión anterior conservando
  `%APPDATA%\com.corjar.dynarent\` (los datos están ahí, no en la carpeta de programa).
  Un rollback manual funciona igual tras un auto-update (desinstalar la versión actual e
  instalar la anterior).
- **Desinstalar**: Panel de control → Programas → Dynarent ERP (o `uninstall.exe` en
  `%LOCALAPPDATA%\Dynarent\`).

---

## 7. Soporte

- Issues del proyecto: <https://github.com/aleksei-corom/DynaRent/issues>
- Historial técnico por versión: `CHANGELOG.md`; políticas de seguridad: `SECURITY.md`;
  decisiones de desarrollo: `Handsoff.md`.
