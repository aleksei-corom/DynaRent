# 🖥️ Dynarent ERP - Sistema de Gestión de Flota (Tauri V2)

> Sistema de gestión de flota para renta de vehículos. Administración integral: flota, clientes, rentas, reservas, finanzas, taller y más.
> **Reescrito** utilizando Tauri V2, Rust, SvelteKit y Tailwind CSS.

---

## ⬇️ Descarga e instalación (usuarios finales)

> **Última versión estable: [v1.0.30](https://github.com/aleksei-corom/DynaRent/releases/tag/v1.0.30)** — con auto-update activo, modo de instalación flexible (per-user o per-machine), 30 mejoras técnicas aplicadas, fixes de seguridad y accesibilidad, y CI validando cada commit.

### 1. Descargar el instalador

Ve a la página de [releases de GitHub](https://github.com/aleksei-corom/DynaRent/releases) y descarga la **v1.0.30**:

| Instalador | Cuándo usarlo |
|---|---|
| `DynaRent_1.0.30_x64-setup.exe` (NSIS, ~21 MB) | **Recomendado** — instalación asistida con selección de modo (per-user / per-machine) |
| `DynaRent_1.0.30_x64_en-US.msi` (MSI, ~33 MB) | Despliegue empresarial / GPO (instalación silenciosa con `msiexec`) |

> ⚠️ **No uses la v1.0.0** (descontinuada): en equipos nuevos sin BD previa se colgaba antes de llegar al Login. Si ya la tienes instalada **con datos**, no necesitas desinstalar — la v1.0.30 abre tu BD actual tal cual.

### 2. Instalar

- Ejecuta el `.exe` (o despliega el `.msi`) en el equipo objetivo. **Windows x64**.
- El instalador NSIS te ofrecerá elegir entre **Solo para mí** (%LOCALAPPDATA%) o **Para todos los usuarios** (Program Files).
- En el primer arranque la app crea automáticamente en `%APPDATA%\com.corjar.dynarent\`:
  - `config.ini` — configuración inicial.
  - `dynarent_v3.fdb` — la base de datos Firebird Embedded (portable, no requiere instalación de servidor).
- **No hace falta instalar nada más**: el runtime de Firebird y el de Visual C++ viajan dentro del instalador, y WebView2 se instala automáticamente si el sistema no lo tiene.

### 3. Primer ingreso

En una instalación nueva el usuario por defecto es:

| Campo | Valor |
|---|---|
| Usuario | `admin` |
| Contraseña | `admin123` |

La app pedirá **cambiar la contraseña** en el primer ingreso. En una instalación que ya tenía BD (actualización desde versiones anteriores), se conservan tus usuarios y datos tal cual.

### 4. Actualizar desde versiones anteriores

Solo instala la v1.0.30 encima (o desinstala y reinstala conservando `%APPDATA%\com.corjar.dynarent\`): el arranque es idempotente y aplica únicamente las migraciones pendientes. **No se pierde ningún dato.**

---

## 📋 Configuración Rápida

### 1. Requisitos Previos
- [Node.js](https://nodejs.org/) (v18+) o [Bun](https://bun.sh/) (recomendado)
- [Rust](https://www.rust-lang.org/) (1.70+)
- Dependencias de sistema operativo para compilar Tauri (ver [documentación oficial](https://v2.tauri.app/start/prerequisites/)).

### 2. Instalar dependencias del Frontend
En la raíz del proyecto:
```bash
bun install
```

### 3. Ejecutar aplicación en modo desarrollo
Este comando iniciará el servidor de desarrollo del frontend (Vite) y lanzará la aplicación de escritorio de Tauri en modo debug:
```bash
bun run tauri dev
```

### 4. Compilar para producción
Para generar el instalador y el ejecutable final:
```bash
bun run tauri build
```

---

## 🏗️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend (UI)** | SvelteKit 2 + Svelte 5 (runes) + Tailwind CSS v4 |
| **Backend (Lógica)** | Rust (módulos `services/`) |
| **Acceso a datos** | `rsfbclient` (consultas explícitas) |
| **Base de datos** | **Firebird Embedded 5.0** (archivo portable `.fdb`) |
| **Proceso de escritorio** | Tauri V2 (WebView2 en Windows) |
| **Gestor de paquetes** | Bun |
| **CI/CD** | GitHub Actions (lint, clippy, tsc, svelte-check, vitest, cargo audit) |

---

## 📂 Estructura del Proyecto

```
DynaRent/
├── data/                   # Archivos de configuración (config.ini)
├── src/                    # Frontend (SvelteKit + Tailwind)
│   ├── routes/             # Vistas de la aplicación (Dashboard, Rentas, Flota, etc.)
│   ├── lib/                # Componentes Svelte, utils de UI y estilos
│   │   ├── api/            # Módulos de API (capa de abstracción sobre invoke)
│   │   ├── stores/         # Stores reactivos Svelte
│   │   └── components/     # Componentes reutilizables
│   └── app.html            # Template HTML principal
├── src-tauri/              # Backend (Rust + Tauri V2)
│   ├── src/
│   │   ├── commands/       # Comandos Tauri (puntos de entrada IPC)
│   │   ├── services/       # Lógica de negocio
│   │   ├── repositories/   # Acceso a BD (rsfbclient)
│   │   ├── core/           # Crypto, RBAC, migraciones, validadores
│   │   └── lib.rs          # Registro de comandos y setup Tauri
│   ├── migrations/         # Scripts SQL de esquema (0001–0027)
│   ├── tests/              # Tests de integración
│   ├── Cargo.toml          # Dependencias de Rust
│   └── tauri.conf.json     # Configuración de Tauri (ventana, NSIS, updater)
├── .github/workflows/      # CI (lint + check + tests + cargo audit + release)
├── dynarent-patches/       # Parches de mejoras aplicados secuencialmente
├── package.json            # Dependencias Node.js / scripts
└── bun.lock                # Lockfile de Bun
```

---

## 📚 Documentación

| Documento | Propósito |
|-----------|-----------|
| **[PLAN_IMPLEMENTACION_TAURI.md](PLAN_IMPLEMENTACION_TAURI.md)** | 📋 Plan completo de arquitectura y migración técnica desde Python a Tauri |
| **[Handsoff.md](Handsoff.md)** | 🤖 Registro de decisiones, automatizaciones y guías de desarrollo |
| **[INSTALACION_OPERACIONES.md](INSTALACION_OPERACIONES.md)** | 🚀 Guía de instalación de la v1.0.30 para operaciones: enlaces a los assets, credenciales iniciales y verificación |
| **[DEPLOYMENT_CLIENTES.md](DEPLOYMENT_CLIENTES.md)** | 🖥️ Plan de despliegue en equipos de clientes: instalación silenciosa, verificación post-instalación y rollback |
| **[RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)** | 🚢 Checklist para publicar una release: bump de versión, tag, verificación de assets y anuncio |
| **[SECURITY.md](SECURITY.md)** | 🔐 Manejo de secretos, rotación de clave PII y reporte de vulnerabilidades |
| **[RESUMEN_EJECUTIVO.md](RESUMEN_EJECUTIVO.md)** | 📊 Resumen ejecutivo del estado del proyecto: releases, CI y herramientas de operación |
| **[ANUNCIO_RELEASE_TEMPLATE.md](ANUNCIO_RELEASE_TEMPLATE.md)** | 📣 Plantilla de anuncio de release para Slack/Teams (reutilizable) |
| **[PLAN_FACTURACION_ELECTRONICA.md](PLAN_FACTURACION_ELECTRONICA.md)** | 📄 Plan del módulo de facturación electrónica DIAN Colombia |

*(Para documentación histórica sobre la lógica de negocio subyacente, consultar el repositorio original de la versión Python+PySide6).*

---

## 🔒 Seguridad Implementada

- **Criptografía de Contraseñas:** Soporte para hashes antiguos (PBKDF2-SHA256) con re-hasheo automático a **Argon2id** en el primer inicio de sesión.
- **Datos Sensibles (PII):** Cifrado en reposo para datos de clientes y licencias utilizando **AES-256-GCM** gestionado desde Rust.
- **Autorización:** Control de Acceso por Roles (RBAC) aplicado de forma estricta en los Comandos de Tauri.
- **Sin Motor de BD Expuesto:** Firebird Embedded 5.0 opera dentro del mismo proceso sin puertos de red abiertos.
- **Seguridad en CI:** `cargo audit` ejecutado en cada PR; `bun.lock` sincronizado automáticamente para PRs de Dependabot.
- **Branch Protection:** `main` requiere CI verde para merge; force push y delete bloqueados.

---

**Versión estable**: 1.0.30 (construida y validada por CI — ver [releases](https://github.com/aleksei-corom/DynaRent/releases)). La versión legacy de la migración Tauri V2 era 4.0.0-beta; desde la **v1.0.0** el versionado sigue el semver del proyecto (1.0.x).

---

## 🚀 Setup rápido

```bash
# 1. Configurar secrets (NUNCA commitear data/config.ini)
cp data/config.ini.example data/config.ini
# Editar data/config.ini y rellenar:
#   - database.password  -> contraseña strong de sysdba (dejar vacío en embedded)
#   - security.db_encryption_key -> generar con: openssl rand -base64 32

# 2. Generar clave PII (AES-256-GCM, base64 de 32 bytes)
openssl rand -base64 32
# Pegar el resultado en data/config.ini -> [security] db_encryption_key

# 3. Instalar dependencias frontend
bun install

# 4. Lanzar en modo desarrollo
bun run tauri dev
```

> ℹ️ Alternativamente las credenciales pueden pasarse por variables de entorno (ver `.env.example`) sin tocar `config.ini`.

> 🪝 **Scripts del proyecto y hook de pre-commit**: todos los comandos se ejecutan con `bun run <script>` — `dev`, `build`, `check`, `test`, `lint`, `tauri`, `check:simit`, `watch:simit`, `smoke:app`, `verificar:paginacion` — y el hook de husky ejecuta `bun run lint` (eslint sobre `src`) en cada `git commit`. `bun` queda en el PATH de usuario al instalarlo; si algún comando falla con `bun: command not found`, abre una **terminal nueva** (el PATH se refresca al iniciarla) o añade `C:\Users\<tu-usuario>\.bun\bin` al PATH de usuario. En casos excepcionales se puede omitir el hook con `git commit --no-verify`. Los scripts `.mjs` de `scripts/` (`check-simit`, `watch-simit`, `smoke-test-app`, `verificar-paginacion`) se ejecutan con `node` directo (`node scripts/check-simit.mjs`) y **no** requieren bun.

---

## 🗄️ Migraciones de base de datos

La base de datos es un `.fdb` portable de **Firebird Embedded 5.0**. El esquema se gestiona con un runner propio (`src-tauri/src/core/migrations.rs`) que aplica en orden los scripts de `src-tauri/migrations/` no ejecutados y registra cada versión en la tabla `schema_migrations`.

### Flujo de auto-reparación (idempotente)

- **Autocommit por sentencia**: cada sentencia va en su propia transacción. Si una migración falla, su versión **NO se registra** y el siguiente arranque la reintenta.
- **DDL idempotente**: todas las migraciones usan `EXECUTE BLOCK` con guard contra el catálogo (`RDB$RELATIONS`, `RDB$RELATION_FIELDS`, `RDB$INDICES`, `RDB$RELATION_CONSTRAINTS`, `RDB$GENERATORS`) o `RECREATE TRIGGER`. Si una instalación quedó a medias (crash, corte de luz), el próximo arranque **omite lo ya creado y crea lo que falta** — se auto-repara sola.
- **BDs existentes**: si la BD ya tiene el esquema inicial completo (`has_initial_schema` exige las 4 tablas núcleo **+** `pagos`, la última que crea 0001), `0001` se registra sin ejecutarse; el resto se aplica igual que en instalación nueva.
- **Consolidación con seguridad**: los `DROP INDEX` de 0010-0013 solo eliminan un índice si otro (compuesto de prefijo izquierdo o el automático de la FK) sigue cubriendo la columna — nunca se deja una búsqueda sin índice.

### Serie de migraciones

| Versión | Propósito |
|---|---|
| `0001_initial_schema.sql` | Esquema inicial: tablas, FKs, índices y unique canónicos |
| `0002_indices_optimizacion.sql` | Índices para el informe mensual y búsquedas por placa |
| `0003_no_contrato.sql` | Número de contrato secuencial global (`no_contrato` + generator + backfill + índice único) |
| `0004_no_contrato_anual.sql` | Numeración anual: `anio_contrato` y unicidad por `(anio_contrato, no_contrato)` |
| `0005_tema_usuario.sql` | Preferencia de tema por usuario (`usuarios.tema`: light/dark/auto) |
| `0006_soft_deletes.sql` | Soft deletes (`deleted_at` + índices) en rentas, pagos, gastos, comparendos y mantenimiento |
| `0007_triggers_updated_at.sql` | Triggers `updated_at` en las 9 tablas con auditoría (añade la columna a `rentas`) |
| `0008_check_constraints.sql` | CHECKs de estados (rentas, autos, clientes, reservas, comparendos) |
| `0009_indices.sql` | Índices faltantes detectados en el análisis de rendimiento |
| `0010_dedup_indices.sql` | Deduplica índices `IX_`/`IDX_` duplicados sobre las mismas columnas |
| `0011_consolidar_indices.sql` | Consolida índices redundantes con los automáticos de las FKs y alinea dev↔fresh |
| `0012_consolidar_indices_simples.sql` | Elimina índices de una columna subsumidos por compuestos (prefijo izquierdo) |
| `0013_consolidar_indices_auditoria.sql` | Elimina `IX_AUDITORIA_USUARIO` (último subsumido: lo cubre `IX_AUDITORIA_USUARIO_FECHA`) |
| `0014_limpiar_tablas_tests.sql` | Elimina tablas residuales de sesiones de test (PROBE_T, T2, T_TEST) |
| `0015_comparendo_numero_simit.sql` | Columna `comparendos.numero_comparendo` + índice (deduplicación del Agente SIMIT) |
| `0016_atribucion_comparendo_renta.sql` | DML idempotente: vincula comparendos sin renta/cliente con la renta que cubría el vehículo el día de la infracción (`renta_del_dia`) |
| `0017_empresa_config.sql` | Tabla de una fila con los datos de la empresa (setup inicial; el logo se guarda como archivo en `<data_dir>/logos/`) |
| `0018_empresa_ciudad.sql` | Columna `CIUDAD` explícita en `EMPRESA_CONFIG` (antes se derivaba de la dirección) |
| `0019_renta_cobra_iva.sql` | Flag `COBRA_IVA` por renta (checkbox; default 1 conserva el comportamiento de las existentes) |
| `0020_renta_valor_gasolina.sql` | Cargo por gasolina en la renta (`VALOR_GASOLINA`, default 0) |
| `0021_comparendo_origen_simit.sql` | Procedencia persistente (`origen` 'SIMIT'/'Manual') + `ultimo_visto_simit` + índice |
| `0021_empresa_pais.sql` | País de la empresa en `EMPRESA_CONFIG` (selector con catálogo geográfico) |
| `0022_agente_simit_ultimo_resultado.sql` | Último resultado del Agente SIMIT persistido (el filtro «Solo nuevos» sobrevive al reinicio) |
| `0023_renta_comision.sql` | Comisión por renta (`TIENE_COMISION`/`COMISION`/`VALOR_NETO`) + backfill `valor_neto = total` |
| `0024_extensiones_renta.sql` | Extensiones de renta: prórrogas con fechas y cálculo automático de días/horas extra |
| `0025_audit_inmutable.sql` | Tabla de auditoría inmutable: registros append-only con hash de integridad |
| `0026_cobrar_horas_extra.sql` | Configuración de cobro por horas extra (flag global + valor por hora) |
| `0027_soft_delete_entities.sql` | Soft deletes extendidos a entidades adicionales (empresa, usuarios, reservas) |

### Esquema canónico de índices (tras 0010-0013)

Principio de la consolidación: **una columna de búsqueda = un solo índice** — el compuesto de prefijo izquierdo o el automático de la FK. Ya no existen índices estrechos redundantes ni pares `IX_`/`IDX_` duplicados (mismo resultado en instalaciones nuevas y BDs migradas):

| Tabla | Índices de búsqueda canónicos |
|---|---|
| **RENTAS** | `IDX_RENTAS_ESTADO_FECHA_RETORNO`, `IDX_RENTAS_ESTADO_PLACA`, `IDX_RENTAS_FECHAS`, `IDX_RENTAS_PLACA`, `IX_RENTAS_NO_CONTRATO_ANIO` (único), `IX_RENTAS_DELETED` |
| **AUTOS** | `IX_AUTOS_ESTADO_TIPO`, `IX_AUTOS_TIPO` |
| **CLIENTES** | `IX_CLIENTES_ESTADO_NOMBRE`, `IX_CLIENTES_NOMBRE_COMPLETO`, `IX_CLIENTES_NO_DOC` (único) |
| **RESERVAS** | `IX_RESERVAS_ESTADO_FECHA` |
| **MANTENIMIENTO_VEHICULOS** | `IX_MANTENIMIENTO_PLACA_FECHA`, `IDX_MANTENIMIENTO_FECHA`, `IX_MANTENIMIENTO_DELETED` |
| **GASTOS** | `IX_GASTOS_PLACA_FECHA`, `IX_GASTOS_CATEGORIA_FECHA`, `IDX_GASTOS_FECHA`, `IX_GASTOS_DELETED` |
| **COMPARENDOS** | `IX_COMPARENDOS_PLACA_FECHA`, `IDX_COMPARENDOS_FECHA`, `IX_COMPARENDOS_DELETED` |
| **PAGOS** | `IX_PAGOS_RENTA_FECHA`, `IDX_PAGOS_FECHA`, `IX_PAGOS_DELETED` |
| **INSPECCIONES** | — (solo el índice automático de la FK `RDB$FOREIGN42`) |
| **USUARIOS** | `IX_USUARIOS_USERNAME` (único) |
| **AUDITORIA** | `IX_AUDITORIA_FECHA`, `IX_AUDITORIA_USUARIO_FECHA` |

> Los `RDB$PRIMARY*` (PK), `RDB$UNIQUE*` (unique) y `RDB$FOREIGN*` (FK) son automáticos y **no se dropean** (soportan constraints). El planner **prefiere el índice de la FK** para `WHERE placa = ?` (verificado con `SET PLAN ON`): RENTAS → `RDB$FOREIGN38`, MANTENIMIENTO_VEHICULOS → `RDB$FOREIGN34`, GASTOS → `RDB$FOREIGN36`.

> ℹ️ **Rendimiento**: tras 0010-0013 se validó con `SET PLAN ON` que las búsquedas por placa (RENTAS, MANTENIMIENTO_VEHICULOS, GASTOS) y por estado (RENTAS, AUTOS, CLIENTES, RESERVAS) siguen usando índices — la consolidación no degradó ningún plan (cero full scans nuevos).

---

## 🪟 Windows: exclusiones para builds estables (`os error 32` de cargo y `EBUSY` de Vite)

> Aplica solo en máquinas Windows con Defender / índice de búsqueda activos; en Linux/macOS no hace falta.

**Síntoma**: `error: failed to build archive at ...rlib ... (os error 32)` al compilar con cargo (típicamente en el crate `tauri`) dentro de `src-tauri\target`. La causa: Windows Defender (escaneo en tiempo real) y/o el índice de búsqueda (`SearchIndexer`) abren los archivos temporales `.tmp*.temp-archive` que `rustc` crea y borra, bloqueándolos un instante.

**Solución**: excluir la carpeta del proyecto de ambos componentes. Reemplazar `D:\DynaRent` por la ruta real del repo en cada máquina.

### 1) Windows Defender — exclusión de ruta

GUI: **Seguridad de Windows → Protección contra virus y amenazas → Administrar la configuración → Exclusiones → Agregar o quitar exclusiones → + Agregar exclusión → Carpeta** → `D:\DynaRent\src-tauri\target`.

O en PowerShell **como administrador**:

```powershell
Add-MpPreference -ExclusionPath 'D:\DynaRent\src-tauri\target'
# Opcional: excluir todo el proyecto (cubre target, node_modules y la BD)
Add-MpPreference -ExclusionPath 'D:\DynaRent'

# Verificar (requiere admin)
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
```

### 2) Windows Search (índice) — carpeta excluida

GUI: **Configuración → Privacidad y seguridad → Búsqueda en Windows → Excluir carpetas → Agregar** → `D:\DynaRent`.

O por PowerShell (por usuario, sin admin; escribe en el crawl scope del índice):

```powershell
$base = 'HKCU:\SOFTWARE\Microsoft\Windows Search\CrawlScopeManager\Windows\DefaultGatherManager\AppScope'
$guid = [Guid]::NewGuid().ToString('B').ToUpper()
New-Item -Path "$base\$guid" -Force | Out-Null
New-ItemProperty -Path "$base\$guid" -Name 'URLOrPath' -Value 'file:///D:\DynaRent\' -PropertyType String -Force | Out-Null
New-ItemProperty -Path "$base\$guid" -Name 'ScopeType' -Value 0 -PropertyType DWord -Force | Out-Null
New-ItemProperty -Path "$base\$guid" -Name 'Attributes' -Value 0 -PropertyType DWord -Force | Out-Null
# Reiniciar el índice para que aplique de inmediato (requiere admin):
# Restart-Service WSearch -Force
```

### 3) Verificación

Con ambas exclusiones aplicadas, el ciclo completo debe compilar sin el error:

```bash
cd src-tauri && cargo test   # build de tests + suite completa
cd .. && bun run tauri dev   # build + arranque de la app
```

> ℹ️ **Nota**: un `os error 32` en un *note* del directorio incremental (`target/debug/incremental`) es **no fatal** (cargo solo descarta ese caché y sigue); suele ser el índice tocando el directorio justo tras compilar. Para silenciarlo: `CARGO_INCREMENTAL=0 cargo build` (o `cargo test`).

### 4) Flacidez residual (aunque haya exclusiones) — loop de reintentos

Incluso con ambas exclusiones activas, el `os error 32` puede reaparecer **de forma intermitente** en el paso de archive de la lib (el primer `Compiling dynarent` de un build fresco):

**Workaround probado — loop de reintentos** (el fallo es raro y nunca persistente; el reintento limpio completa):

```bash
# desde src-tauri/
for i in 1 2 3 4 5; do
  echo "== intento $i =="
  CARGO_INCREMENTAL=0 cargo test -j 2 && break
  # limpiar restos del temp-archive que hayan quedado bloqueados
  find target/debug/deps -maxdepth 1 -name '.tmp*.temp-archive' -exec rm -rf {} + 2>/dev/null
  sleep 15
done
```

### 5) Vite dev server — crash del optimizer (`EBUSY` en `node_modules/.vite`)

**Solución**: la exclusión de todo el proyecto de las §1/§2 ya cubre `node_modules`; si solo se excluyó `src-tauri\target`, añadir:

```powershell
Add-MpPreference -ExclusionPath 'D:\DynaRent\node_modules'
```

Y limpiar el caché que quedó a medias tras el crash:

```bash
rm -rf node_modules/.vite && bun run dev
```

**Al relanzar Vite**: tras matar el proceso anterior (Ctrl+C, `taskkill` o cierre de terminal), espera **2-5 segundos** antes de lanzar `bun run dev` de nuevo para que los workers de esbuild liberen los handles de `node_modules/.vite` — o verifica que no quede ningún proceso del proyecto con `tasklist | findstr bun`.

---

## 🔒 Seguridad

El sistema cifra datos PII de clientes (cédula, teléfono, licencia) con **AES-256-GCM** y aplica **Argon2id** para hashes de contraseñas. Ver detalles técnicos y políticas en:

- **[SECURITY.md](SECURITY.md)** — manejo de secretos, rotación de clave PII, reporte de vulnerabilidades e historial del incidente de clave expuesta.

⚠️ **Importante**:
- `data/config.ini` **NO se commitea** — está en `.gitignore`. Usar `data/config.ini.example` como plantilla.
- La clave `db_encryption_key` debe rotarse al menos una vez al año (ver `SECURITY.md` §2).
- Si clonas este repo por primera vez, ejecuta `scripts/sanitize-repo.sh --yes` para limpiar artefactos del working tree (ver §Saneamiento abajo).

---

## 📦 Licencias de terceros

Dynarent ERP redistribuye binarios de Firebird 5.0.3 (licencia dual IDPL+IPL) y VCRedist 14.3 (EULA Microsoft) en `src-tauri/resources/firebird/`. El listado completo de dependencias y sus licencias está en:

- **[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md)**

---

## 🧹 Saneamiento del repositorio

El repo incluye un script para limpiar artefactos no commiteables del working tree y del índice Git:

```bash
# Ejecutar en seco (sin --yes, solo imprime qué haría)
bash scripts/sanitize-repo.sh

# Ejecutar de verdad
bash scripts/sanitize-repo.sh --yes
```

El script:
- Borra `Firebird-5.0.3.1683-0-windows-x64/` (copia duplicada, el bundle usa `src-tauri/resources/firebird/`).
- Hace `git rm --cached` de `data/dynarent_v3.fdb`, `data/config.ini`, `Contrato_Dinamo.docx`, `informe_*.xlsx`, `static/preview-shots/*.pdf` (sin borrar del disco).
- Imprime instrucciones para purgar el historial con `git filter-repo` (necesario tras el incidente de clave expuesta, ver `SECURITY.md` §4).
