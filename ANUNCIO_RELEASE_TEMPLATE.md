# Plantilla de anuncio de release (Slack/Teams)

Mensaje listo para pegar en un canal del equipo al publicar una versión nueva.
Las secciones «Versión larga» y «Versión corta» están **completadas con los
datos reales de la v1.2.8** (enlaces, sha256, verificaciones) — copiar el
bloque elegido tal cual. Para una versión futura, actualizar los valores de
la «Referencia rápida» (versión, URLs de assets, sha256) y reemplazarlos en
el texto de las dos secciones.

---

## Referencia rápida (actualizar en cada release)

| Dato | Valor v1.2.8 |
|---|---|
| Tag / release | `v1.2.8` — <https://github.com/CORJAR-Computers/dynarent/releases/tag/v1.2.8> |
| NSIS | `Dynarent_1.2.8_x64-setup.exe` — 22.801.659 B |
| sha256 NSIS | `8A5308B5BB7F9169D08EAAB33DF52F364006BE389E824858A19FE89C164A0085` |
| MSI | `Dynarent_1.2.8_x64_en-US.msi` — 34.145.999 B |
| sha256 MSI | `BCC75CCB1151CB4ECE5BC272B37A57F8FD331AFD97183FEABBD92C41D619F9D8` |
| Auto-update E2E | ✅ detecta v1.2.8 desde v1.2.7; firma minisign OK; bytes ídem |
| Tests | 795 frontend (63 archivos, 82.05% ramas) · 108 lib + 21 suites de integración · CI verde |

---

## Versión larga (una pantalla)

```text
🚀 Dynarent ERP — v1.2.8 publicada (seguridad de sesiones + montos con coma + TLS parcheado)

La versión v1.2.8 ya está publicada en GitHub, construida y firmada por CI
(auto-update plenamente funcional desde la v1.2.5).

📦 Descarga: https://github.com/CORJAR-Computers/dynarent/releases/download/v1.2.8/Dynarent_1.2.8_x64-setup.exe
(~22 MB, NSIS) o el .msi (~33 MB): https://github.com/CORJAR-Computers/dynarent/releases/download/v1.2.8/Dynarent_1.2.8_x64_en-US.msi
sha256 NSIS: 8A5308B5BB7F9169D08EAAB33DF52F364006BE389E824858A19FE89C164A0085
sha256 MSI:  BCC75CCB1151CB4ECE5BC272B37A57F8FD331AFD97183FEABBD92C41D619F9D8
Credenciales iniciales: admin / admin123 (cambio forzado al primer ingreso;
bloqueado también en el backend hasta cambiarla).
⚠️ No instalar versiones anteriores descontinuadas.
ℹ️ Las instalaciones v1.0.14–v1.2.4 necesitan una reinstalación manual (bug de
pubkey saldado en v1.2.5); de v1.2.5+ en adelante todo llega solo.

🔧 Qué incluye esta versión (revisión del 26-10):
  🔑 BYPASS CERRADO: el cambio de contraseña obligatorio ahora bloquea
     también los comandos administrativos (eliminar_*, backups, claves
     PII, informes) — antes solo el frontend lo controlaba.
  💰 MONTOS CON COMA SEGUROS: escribir "85000,50" ya no llega como 0 al
     backend; las calculadoras de rentas/reservas muestran el total
     correcto y lo validado es lo que se transmite.
  🛡️ PAGOS: el descuento con guard precede al registro — imposible
     comitear un pago huérfano si el saldo cambió a medias.
  🔄 SYNC WEB: los errores HTTP del servidor web son visibles (antes un
     500 se mostraba como «0 pendientes») y valorDia cuadra con el total.
  ⚡ SIN BLOQUEOS: el cambio de contraseña (Argon2) y la gestión de
     claves PII ya no congelan la ventana; calendario O(1) por celda.
  🔒 4 VULNERABILIDADES RUSTSEC del stack TLS/cripto parcheadas
     (rustls-webpki, webpki-roots, webpki-root-certs, ctutils).

✅ Verificado: cargo test (108 lib + 21 suites de integración), vitest 795,
   clippy 0 warnings, E2E del updater contra la release publicada.
```

---

## Versión corta (tres líneas)

```text
🚀 Dynarent ERP v1.2.8 publicada: bypass del cambio de contraseña cerrado en comandos admin,
   montos con coma decimal seguros (financiero), sync web con errores visibles y 4 RUSTSEC
   TLS parcheadas. Instaladores firmados y E2E del updater OK.
📦 https://github.com/CORJAR-Computers/dynarent/releases/tag/v1.2.8 · sha256 en el anuncio largo / DEPLOYMENT_CLIENTES.md §5
⚠️ De v1.0.14 a v1.2.4: reinstalación manual una vez (bug de pubkey); de v1.2.5+ llega sola.
```
