# Plantilla de anuncio de release (Slack/Teams)

Mensaje listo para pegar en un canal del equipo al publicar una versión nueva.
Las secciones «Versión larga» y «Versión corta» están **completadas con los
datos reales de la v1.2.9** (enlaces, sha256, verificaciones) — copiar el
bloque elegido tal cual. Para una versión futura, actualizar los valores de
la «Referencia rápida» (versión, URLs de assets, sha256) y reemplazarlos en
el texto de las dos secciones.

> Los assets se llaman `DynaRent_x.y.z_*` (con **R** mayúscula, tal como los
> publica el bundle). Un `Dynarent_...` en la URL da 404.

---

## Referencia rápida (actualizar en cada release)

| Dato | Valor v1.2.9 |
|---|---|
| Tag / release | `v1.2.9` — <https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.9> |
| NSIS | `DynaRent_1.2.9_x64-setup.exe` — 22.831.594 B (22,8 MB) |
| sha256 NSIS | `5D26FBF1877BC2ADDB11EF79DDCE1CCBCD5BDBBB750BA9B11C2ED34667E5F379` |
| MSI | `DynaRent_1.2.9_x64_en-US.msi` — 34.195.151 B (34,2 MB) |
| sha256 MSI | `27ADA799560D1F70DC1B5DDAF826AA5E8494818A5D04F0901C4FBAC2FD3F1C49` |
| Auto-update E2E | ✅ binario v1.2.8 detecta v1.2.9; firma minisign OK contra la pubkey de producción; bytes ídem (34.195.151 B) |
| Tests | 799 frontend (63 archivos, 82.29 % ramas) · 104 lib + 21 suites de integración · CI verde |

---

## Versión larga (una pantalla)

```text
🚀 Dynarent ERP — v1.2.9 publicada (mantenimiento: rutas descompuestas + fixes de UI)

La versión v1.2.9 ya está publicada en GitHub, construida y firmada por CI
(auto-update plenamente funcional desde la v1.2.5).

📦 Descarga: https://github.com/aleksei-corom/DynaRent/releases/download/v1.2.9/DynaRent_1.2.9_x64-setup.exe
(~22,8 MB, NSIS) o el .msi (~34,2 MB): https://github.com/aleksei-corom/DynaRent/releases/download/v1.2.9/DynaRent_1.2.9_x64_en-US.msi
sha256 NSIS: 5D26FBF1877BC2ADDB11EF79DDCE1CCBCD5BDBBB750BA9B11C2ED34667E5F379
sha256 MSI:  27ADA799560D1F70DC1B5DDAF826AA5E8494818A5D04F0901C4FBAC2FD3F1C49
Credenciales iniciales: admin / admin123 (cambio forzado al primer ingreso;
bloqueado también en el backend hasta cambiarla).
⚠️ No instalar versiones anteriores descontinuadas.
ℹ️ Las instalaciones v1.0.14–v1.2.4 necesitan una reinstalación manual (bug de
pubkey saldado en v1.2.5); de v1.2.5+ en adelante todo llega solo.

🔧 Qué incluye esta versión (sin cambios de esquema ni migraciones):
  🖨️ IMPRESIÓN SIN PANTALLA EN BLANCO: cerrar la vista previa durante la
     espera de fuentes/logo dejaba la app oculta hasta terminar el diálogo;
     ahora se cancela limpiamente (rentas y reservas).
  ✅ DIÁLOGOS ACCESIBLES: eliminar claves PII y truncar logs usan el
     ConfirmDialog con foco gestionado y estado de carga (antes confirm()
     nativo, con doble clic posible).
  💱 CALENDARIO MULTI-MONEDA: el detalle usa la moneda configurada por la
     empresa, no COP fijo.
  ⚡ LOGIN SIN CONGELAR: la verificación Argon2id corre fuera del hilo de la
     ventana (antes ~100-300 ms de bloqueo al entrar).
  🧱 DEUDA TÉCNICA: rentas, reservas, comparendos, usuarios y autos descompuestas en
     componentes (sin cambios de comportamiento) y SQL muerto eliminado.
  🔐 BACKUPS: gbak recibe la contraseña por entorno, ya no en la línea de
     comandos (no visible en Task Manager / WMI).

✅ Verificado: cargo test (104 lib + 21 suites de integración), vitest 799,
   clippy 0 warnings, E2E del updater contra la release publicada.
```

---

## Versión corta (tres líneas)

```text
🚀 Dynarent ERP v1.2.9 publicada: mantenimiento y calidad — impresión que ya no deja la app
   en blanco, diálogos accesibles en PII/logs, calendario con la moneda de la empresa, login sin
   bloqueos y las cinco rutas más grandes descompuestas (sin cambios de comportamiento).
📦 https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.9 · sha256 en el anuncio largo / DEPLOYMENT_CLIENTES.md §5
⚠️ De v1.0.14 a v1.2.4: reinstalación manual una vez (bug de pubkey); de v1.2.5+ llega sola.
```
