# Plantilla de anuncio de release (Slack/Teams)

Mensaje listo para pegar en un canal del equipo al publicar una versión nueva.
Las secciones «Versión larga» y «Versión corta» están **completadas con los
datos reales de la v1.2.7** (enlaces, sha256, verificaciones) — copiar el
bloque elegido tal cual. Para una versión futura, actualizar los valores de
la «Referencia rápida» (versión, URLs de assets, sha256) y reemplazarlos en
el texto de las dos secciones.

---

## Referencia rápida (actualizar en cada release)

| Dato | Valor v1.2.7 |
|---|---|
| Tag / release | `v1.2.7` — <https://github.com/CORJAR-Computers/dynarent/releases/tag/v1.2.7> |
| NSIS | `Dynarent_1.2.7_x64-setup.exe` — 22.793.189 B |
| sha256 NSIS | `D37B3796158F3E6C1453D185BE4F0AA8B4A4120DCF8D2CDB06E9C1D0DCA630B4` |
| MSI | `Dynarent_1.2.7_x64_en-US.msi` — 34.129.615 B |
| sha256 MSI | `18B100A2520486F6A02BAB3F478E8EF2B1ED7C784F2C0B757E7054703C4D9F78` |
| Auto-update E2E | ✅ detecta v1.2.7 desde v1.2.6; firma minisign OK; bytes ídem |
| Tests | 785 frontend (63 archivos) · 107 lib + 21 suites de integración · CI verde |

---

## Versión larga (una pantalla)

```text
🚀 Dynarent ERP — v1.2.7 publicada (correcciones financieras + seguridad + UI sin bloqueos)

La versión v1.2.7 ya está publicada en GitHub, construida y firmada por CI
(auto-update plenamente funcional desde la v1.2.5).

📦 Descarga: https://github.com/CORJAR-Computers/dynarent/releases/download/v1.2.7/Dynarent_1.2.7_x64-setup.exe
(~22 MB, NSIS) o el .msi (~33 MB): https://github.com/CORJAR-Computers/dynarent/releases/download/v1.2.7/Dynarent_1.2.7_x64_en-US.msi
sha256 NSIS: D37B3796158F3E6C1453D185BE4F0AA8B4A4120DCF8D2CDB06E9C1D0DCA630B4
sha256 MSI:  18B100A2520486F6A02BAB3F478E8EF2B1ED7C784F2C0B757E7054703C4D9F78
Credenciales iniciales: admin / admin123 (cambio forzado al primer ingreso,
ahora también bloqueado en el backend hasta cambiarla).
⚠️ No instalar versiones anteriores descontinuadas.
ℹ️ Las instalaciones v1.0.14–v1.2.4 necesitan una reinstalación manual (bug de
pubkey saldado en v1.2.5); de v1.2.5+ en adelante todo llega solo.

🔧 Qué corrige esta versión (resultado del informe de revisión del 20-10):
  💰 CIERRE DE RENTA (crítico): el total del contrato cerrado ya incluye el
     cargo de gasolina — antes quedaba por debajo de lo pactado y divergía
     de crear/extender/editar. Helper único extras_de() para las 3 rutas.
  🛡️ PAGOS ANTI-TOCTOU: el saldo se revalida dentro de la transacción con
     FOR UPDATE WITH LOCK y el UPDATE aplica aritmética SQL con guard —
     dos pagos simultáneos ya no pueden pisarse ni superar el saldo.
  🪙 MONTOS A 2 DECIMALES: se rechaza precisión extra; fin del drift de
     redondeo entre rust_decimal y el CAST DECIMAL de Firebird.
  🔒 PII: cifrar sin db_encryption_key configurada ahora RECHAZA (antes
     cifraba con una clave derivada de cadena vacía, públicamente
     calculable). El descifrado de emergencia de datos previos sigue OK.
  🔑 admin/admin123: el cambio de contraseña obligatorio ahora se enforce
     en el backend y la contraseña semilla ya no se escribe en app.log.
  ⚡ UI SIN BLOQUEOS: ~40 comandos Tauri migrados a spawn_blocking — los
     listados con búsqueda y las transacciones dejan de congelar la ventana.
  📚 DOCS: INSTALACION_OPERACIONES con el historial completo de las 42
     releases y las rutas de actualización por versión instalada.

✅ Verificado: cargo test (107 lib + 21 suites de integración), vitest 785,
   clippy 0 warnings, E2E del updater contra la release publicada.
```

---

## Versión corta (tres líneas)

```text
🚀 Dynarent ERP v1.2.7 publicada: fix crítico del total en el cierre de renta (gasolina),
   pagos concurrentes seguros (anti-TOCTOU, 2 decimales), PII/sesiones endurecidas y
   UI sin bloqueos (~40 comandos async). Instaladores firmados y E2E del updater OK.
📦 https://github.com/CORJAR-Computers/dynarent/releases/tag/v1.2.7 · sha256 en el anuncio largo / DEPLOYMENT_CLIENTES.md §5
⚠️ De v1.0.14 a v1.2.4: reinstalación manual una vez (bug de pubkey); de v1.2.5+ llega sola.
```
