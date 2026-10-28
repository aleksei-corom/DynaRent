# Checklist de publicación de release — Dynarent ERP

> Procedimiento operativo para publicar una versión nueva en
> `github.com/aleksei-corom/DynaRent`: el bump de versión, el tag que
> dispara el CI, la verificación de los assets y el anuncio. Complementa a
> `INSTALACION_OPERACIONES.md` (instalación + historial de versiones),
> `DEPLOYMENT_CLIENTES.md` (despliegue a clientes) y `ANUNCIO_RELEASE_TEMPLATE.md` (mensajes de anuncio).
>
> **✅ Última release: v1.2.9 — PUBLICADA (2026-10-28, tag `v1.2.9` sobre `be71b9f`; 5 assets firmados).**
> Mantenimiento y calidad: rentas/reservas/comparendos/usuarios/autos
> descompuestas en componentes (1946→750, 1248→328, 1147→507, 745→186,
> 712→190) sin cambios de comportamiento, `cancelarImpresion()` para el blanco
> total al cerrar la impresión, moneda del calendario según empresa, login async
> por fases, `gbak` sin contraseña en `argv`, `ts-rs` retirado, Vitest 5 y flake
> de comparendos cerrado. Cobertura 82.29 % (799 tests). Sin migraciones ni
> cambios de esquema.

---

**Estado de la v1.2.9 — publicada (28-10, tag `v1.2.9` sobre `be71b9f`):**

Publicada por CI desde el tag: **5 assets** (NSIS 22.831.594 B + MSI 34.195.151 B +
`.sig` ×2 + `latest.json`), `isDraft: false`, body con el changelog automático y
workflow `release.yml` en verde. **E2E del updater validada sin máquina**: un binario
v1.2.8 detecta la v1.2.9, la firma minisign valida contra la pubkey de producción y
los bytes descargados son idénticos al MSI publicado.

**Checklist v1.2.9 completada:**

- [x] CI verde en main antes del tag (lint, svelte-check 0/0, vitest 799, cargo 104 + 21 suites)
- [x] Bump a v1.2.9 en los 4 archivos (§2)
- [x] `scripts/verificar-despliegue.ps1 -DryRun` en verde (OK exit 0 / `-SimularFallo` exit 1)
- [x] Commit `chore(release): versión 1.2.9` + tag `v1.2.9` sobre `be71b9f` (§4-5)
- [x] E2E del updater sin máquina (§6) — pendiente la prueba de campo en equipo real
- [ ] Anuncio en canal del equipo (§8) — mensaje listo en `ANUNCIO_RELEASE_TEMPLATE.md`

---

## 0. Regla de oro

**El tag `vX.Y.Z` debe apuntar a un commit donde los cuatro archivos de versión
ya estén bumpeados.** El CI (`release.yml`) compila el código del commit del tag
y los instaladores se nombran con la versión de `src-tauri/tauri.conf.json`,
NO con el nombre del tag. Un tag sobre un commit sin bumpear publicaría una
release `v1.2.9` con instaladores `DynaRent_1.2.8_*` (si el bump quedara a medias).

---

## 1. Pre-requisitos

- [ ] `ci.yml` verde en el tope de `main` (lint, svelte-check, vitest, cargo test --lib +
      integración — incluye los tests de backups/restauración con gbak real contra la BD
      sembrada —, importador, test de paginación con el 4º caso: orden de reserva 1 página Carta).
      El workflow de release NO valida: un tag sobre un commit roto publicaría igual.
- [ ] `scripts/verificar-despliegue.ps1 -DryRun` en verde (caso OK exit 0 y `-SimularFallo` exit 1) —
      validado además por `ci.yml` en cada push (paso «Verificador de despliegue (-DryRun)»).
- [ ] Working tree limpio y `main` local = `origin/main`.
- [ ] El secret `TAURI_SIGNING_PRIVATE_KEY` está configurado en Settings → Secrets → Actions
      del repo (y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` solo si la clave tiene password).
      Sin él, `tauri build` NO firma los bundles y la release saldría sin `.sig`/`latest.json`
      → la app instalada no podría auto-actualizarse. La clave privada vive SOLO en
      `~/.tauri/dynarent.key` de la máquina que la generó: respáldala (si se pierde,
      las instalaciones v1.0.3+ dejarían de actualizarse).
      → Configurar y verificar por CLI: [`SECRET_FIRMA_UPDATER.md`](SECRET_FIRMA_UPDATER.md)
      → Gotcha del CLI de firma: el paso «Verificar que la clave…» de `release.yml` NO
        debe exportar `TAURI_SIGNING_PRIVATE_KEY` como env si además pasa `-f <archivo>`
        (clap aborta: «'--private-key-path' cannot be used with '--private-key'», exit 2
        — rompió el 1er intento de publicar v1.2.6). Volcar el secret a un archivo con un
        nombre de env arbitrario (`FIRMA_KEY`) y firmar solo con `-f`. Detalle en
        [`SECRET_FIRMA_UPDATER.md`](SECRET_FIRMA_UPDATER.md) §5.

## 2. Bump de versión

Editar la versión en los **cuatro** archivos (deben coincidir):

| Archivo | Campo |
|---|---|
| `package.json` | `"version": "1.2.9"` |
| `src-tauri/Cargo.toml` | `version = "1.2.9"` (crate `dynarent`) |
| `src-tauri/Cargo.lock` | `version = "1.2.9"` (entrada del paquete `dynarent`) |
| `src-tauri/tauri.conf.json` | `"version": "1.2.9"` |

Verificar la consistencia:

```bash
grep '"version"' package.json src-tauri/tauri.conf.json
grep -m1 '^version' src-tauri/Cargo.toml
grep -A1 'name = "dynarent"' src-tauri/Cargo.lock
```

Actualizar además (patrón del bump 43aa80b):

- [ ] `INSTALACION_OPERACIONES.md` — enlaces de descarga de la release nueva (título, tabla de assets, comandos silenciosos).
- [ ] `README.md` — "última versión estable" y enlaces de descarga.
- [ ] `ANUNCIO_RELEASE_TEMPLATE.md` — datos de referencia (assets, sha256, conteos de tests si cambiaron).

## 3. Verificación local (opcional pero recomendada)

```bash
bun run lint
bunx svelte-check --tsconfig ./tsconfig.json
bunx vitest run
cd src-tauri && cargo test --lib
```

Validar además el verificador de despliegue (sin tocar la máquina):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verificar-despliegue.ps1 -DryRun
# el caso FALLOS debe terminar con VEREDICTO: FALLOS y exit 1:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verificar-despliegue.ps1 -DryRun -SimularFallo
```

## 4. Commit del bump

Mensaje con el estilo del repo (español, prefijo `chore:`):

```text
chore(release): versión 1.2.9 — mantenimiento y calidad (rutas descompuestas, blanco al cerrar impresión, Vitest 5)
# (ajustar el resumen a lo que incluya la release al bumpear)
```

## 5. Publicar: push + tag

```bash
git push origin main
git tag v1.2.9
git push origin v1.2.9
```

El push del tag dispara `release.yml` (GitHub Actions, `windows-latest`):
`checkout` (fetch-depth 0) → **test de paginación** (orden 1 página Carta,
contrato 3-4 páginas con pie, informe A4 — bloquea la release si falla) →
changelog automático → `tauri build` (NSIS + MSI) → crea la release
**publicada** (no draft) y sube los assets. ~8-12 minutos (referencia v1.2.9:
7 min 52 s).

La **E2E del auto-update en máquina real** no puede correr en el CI (necesita la
release ya publicada): se valida en el §6 como contraparte de campo del test de
paginación.

> El body de la release se genera solo: lista los commits entre el tag anterior
> y el nuevo, con hash corto y mensaje. Si quieres verlo antes de publicar,
> cambia `releaseDraft: true` en `release.yml` y publícala a mano.

> **Auto-actualización (v1.0.3+):** la app instalada comprueba al arrancar si hay una
> release más nueva (endpoint `latest.json` de GitHub) y pide permiso para instalarla.
> Las instalaciones **v1.0.2 no tienen updater**: se actualizan UNA vez a mano con el
> instalador de la v1.0.3 y de ahí en adelante reciben las siguientes automáticamente.

## 6. Verificar la release (no confiar a ciegas en el CI)

- [ ] Release `v1.2.9` existe en <https://github.com/aleksei-corom/DynaRent/releases/tag/v1.2.9>
      con **5 assets**: los 2 instaladores (`DynaRent_1.2.9_x64-setup.exe` NSIS
      22.831.594 B y `DynaRent_1.2.9_x64_en-US.msi` 34.195.151 B), sus firmas del updater
      (`*.exe.sig` / `*.msi.sig`) y `latest.json`. Los `.sig` son de **minisign**
      (verificación del updater), NO firma de código Authenticode.
- [ ] `latest.json` existe y `platforms.windows-x86_64.url` apunta al instalador de esta
      release (el CI elige cuál sube al publicar — en la v1.2.9 fue el `.msi`) — es lo que la
      app instalada (v1.0.3+) consulta al arrancar para auto-actualizarse. En la v1.2.9 la app
      instalada debe DETECTAR la release nueva y ofrecer instalarla (prueba de campo del
      auto-update).
- [ ] **E2E del auto-update — validación sin máquina** (antes de la prueba de campo):
      desde un árbol dev **aún en v1.2.8** (antes del bump local o desde el commit previo),
      verificar que la release publicada se detecta, su firma valida y los bytes coinciden,
      con el binario de desarrollo `updater_e2e`:

      ```bash
      cd src-tauri && cargo run --features dev --bin updater_e2e -- \
        --endpoint https://github.com/aleksei-corom/DynaRent/releases/latest/download/latest.json \
        --expect-version 1.2.9 \
        --expect-file ./DynaRent_1.2.9_x64_en-US.msi
      ```

      Debe terminar con `[OK]` (check() detecta v1.2.9, firma minisign verificada contra
      la pubkey de producción y bytes idénticos al instalador).

      > ⚠️ El updater sirve por defecto la plataforma `windows-x86_64` = **MSI** — el
      > `--expect-file` debe ser el `.msi` (verificado el 28-10 contra la release real).
      > Para validar el NSIS en su lugar, usar `--expect-file ./DynaRent_1.2.9_x64-setup.exe`
      > apuntando el endpoint a una copia local del `latest.json` con `windows-x86_64-nsis`
      > como plataforma por defecto (o verificar el NSIS con `verificar-updater-e2e.sh`).
- [ ] **E2E del auto-update en máquina real** (la contraparte de campo del test de
      paginación de `release.yml`, que sí corre en CI): en un equipo con una **v1.0.14+
      instalada** (p. ej. la v1.2.8), abrir la app y confirmar que **detecta la v1.2.9**
      («Actualización disponible»), descarga con verificación de firma minisign, instala
      y **reinicia en la v1.2.9** — verificar la versión resultante (menú lateral / login
      o `scripts/verificar-despliegue.ps1` → VEREDICTO OK).
- [ ] **Paginación en máquina real** (contraparte de campo del test de `release.yml`): desde
      una renta real, «Ver contrato (Carta)» → contrato en **3-4 páginas Carta** con pie
      «Página X de Y», y la **orden de reserva en 1 página Carta** (sin cortes ni columnas
      desperdiciadas). Si se exporta el PDF se puede validar con
      `node scripts/verificar-paginacion.mjs contrato.pdf=3:4 --tamano carta --pie`.
- [ ] El **body contiene el changelog** (commits del rango).
- [ ] Los enlaces responden HTTP 200 y el tamaño coincide:

```powershell
# En el PC objetivo
Get-FileHash .\DynaRent_1.2.9_x64-setup.exe -Algorithm SHA256
# NSIS: 5D26FBF1877BC2ADDB11EF79DDCE1CCBCD5BDBBB750BA9B11C2ED34667E5F379
# MSI:  27ADA799560D1F70DC1B5DDAF826AA5E8494818A5D04F0901C4FBAC2FD3F1C49
# comparar contra el sha256 publicado por GitHub en la página de la release
```

- [ ] (Opcional) `scripts/verificar-despliegue.ps1` en un equipo de prueba → VEREDICTO OK
      (sin `-DryRun`: chequeos reales sobre la instalación; el modo `-DryRun` se valida
      en `ci.yml` y en el §3, no requiere máquina).

## 7. Actualizar la operación

Si el bump cambió algo de operación (p. ej. el check de versión del exe):

- [ ] `scripts/verificar-despliegue.ps1` — `Check "Version 1.2.9" ($ver -like '1.2.9*')`.
- [ ] `DEPLOYMENT_CLIENTES.md` — versión esperada e instaladores en la tabla de verificación.
- [ ] `RESUMEN_EJECUTIVO.md` — versión estable, assets, conteos.
- [ ] `Handsoff.md` — cabecera y nota de portada de la release nueva.
- [ ] Commitear estos ajustes y empujar.

## 8. Anunciar

- [x] Marcar releases anteriores si aplica (la v1.2.8 pasa a "estable anterior" en `RESUMEN_EJECUTIVO.md` §2; no se descontinúa salvo motivo).
- [ ] Pegar el mensaje de `ANUNCIO_RELEASE_TEMPLATE.md` (versión larga o corta, **ya con los
      sha256 reales** `5D26FBF1…`/`27ADA799…`) en Slack/Teams con los enlaces de descarga y
      el resumen de la release. **El bloque está listo para copiar tal cual** (18-08).

---

## Checklist exprés (resumen)

```
[ ] CI verde en main (incluye verificar-despliegue.ps1 -DryRun)
[ ] Bump en package.json + Cargo.toml + Cargo.lock + tauri.conf.json (idénticos, 1.2.9)
[ ] Docs de descarga actualizadas (INSTALACION_OPERACIONES.md, README.md, ANUNCIO)
[ ] commit chore(release): versión 1.2.9
[ ] git push origin main && git push origin v1.2.9
[ ] Release publicada por CI con changelog y 5 assets (NSIS + MSI + .sig x2 + latest.json)
[ ] sha256 verificado contra el publicado
[ ] verificar-despliegue.ps1 → OK (equipo de prueba)
[ ] E2E auto-update en máquina real → v1.2.9 detectada, instalada y reiniciada
[ ] Docs de operación al día (ps1, DEPLOYMENT_CLIENTES, RESUMEN, Handsoff)
[ ] Anuncio en Slack/Teams
```
