# Plan: Módulo de Facturación Electrónica (DIAN Colombia) — DynaRent

> Investigado en agosto 2026 contra la normativa vigente de la DIAN y el estado
> actual del código (Tauri v2 + Rust + Firebird Embedded 5.0 + SvelteKit 5).
> Producto objetivo: **DynaRent** (Dinamo Rent a Car), persona jurídica
> colombiana → **obligada a emitir Factura Electrónica de Venta (FEV)**.

---

## 1. Marco normativo (resumen investigado)

| Aspecto | Detalle |
|---|---|
| Obligación | Personas jurídicas que venden bienes/servicios están obligadas a FEV (Res. DIAN 0042/2020 art. 6–7; consolidada por Res. DIAN 000165/2023). |
| Anexo Técnico | Versión **1.9** (Res. 000165/2023): XML **UBL 2.1**, firma digital **XAdES-EPES** con certificado digital vigente. |
| Validación previa | El documento se envía a la DIAN **antes** de expedirse: solo se entrega al cliente tras la validación exitosa. Ya no hay plazo de transmisión posterior (se eliminó el "48 horas / 10 días"). |
| CUFE | Código Único de Factura Electrónica: hash **SHA-384** de los datos de la factura + clave técnica; va impreso en la representación gráfica (PDF) junto al QR. |
| Numeración | Rangos de numeración autorizados/habilitados en el portal de la DIAN usando el **IFE** (Instrumento de Firma Electrónica). La numeración FEV es independiente de cualquier numeración interna. |
| Documentos relacionados | Notas crédito y débito electrónicas, eventos RADIAN (aceptación/título valor), documento soporte electrónico, y **reporte de facturas en papel por fallo tecnológico** (contingencia). |
| Requisitos previos de la empresa | RUT actualizado, responsable de IVA según régimen, habilitación como facturador electrónico, certificado/IFE de firma. |

Fuentes: micrositios DIAN (facturación electrónica), Edicom (guía Colombia,
actualizada jul-2026), Resolución DIAN 000165/2023 (Anexo Técnico v1.9).

### Implicación clave para una app de escritorio

La validación previa exige **conectividad**: DynaRent funciona con Firebird
embebido local y puede usarse sin internet. El diseño debe contemplar:

1. Cola de documentos pendientes de transmisión con reintentos automáticos.
2. Modo de contingencia: si no hay red, se permite imprimir la factura en papel
   (fallo tecnológico) y el módulo la reporta/transmite cuando vuelva la
   conexión, generando su equivalente electrónico.

---

## 2. Opciones de integración evaluadas

| Opción | Descripción | Veredicto para DynaRent |
|---|---|---|
| A. Portal gratuito DIAN | Software web de la DIAN. | ❌ No integrable con el ERP; doble digitación. |
| B. Directo contra la DIAN | Generar XML UBL 2.1 propio, firmar XAdES-EPES con el certificado .p12 del emisor y consumir los Web Services de habilitación/producción DIAN. Pasar el set de pruebas y la habilitación. | ⚠️ Máximo control y costo marginal ~0 por documento, pero exige implementar XAdES y el Anexo Técnico completo (no hay crate maduro en Rust; referencias open source existen en JS/PHP: `dian-kit`, SOENAC). Alto riesgo normativo ante cada cambio del Anexo Técnico. |
| C. Proveedor Tecnológico autorizado con API REST | Empresas habilitadas por la DIAN que exponen API REST: se envía JSON con la venta y devuelven CUFE, QR, PDF y estado de validación. Ejemplos investigados: **Factus**, **Alanube**, **Plemsi**, **MATIAS API**, Facturalatam (on-premise/API). Costo por documento o planes por volumen. | ✅ **Recomendada**: abstrae firma, UBL, cambios normativos y transmisión; la app solo necesita cliente HTTP (ya usa `ureq`) y almacenamiento de respuestas. |

**Decisión propuesta:** Opción C, con un trait `ProveedorFe` en Rust para poder
cambiar de proveedor sin tocar el resto del sistema (y conservar la opción B a
futuro como proveedor "propio").

> Pendiente de decisión comercial: cotizar Factus / Alanube / Plemsi / MATIAS
> según volumen mensual estimado de rentas cerradas. Criterios: precio por
> documento, soporte de notas crédito, sandbox estable, retención del XML/PDF,
> SLA y exigencia de certificado .p12 del emisor (algunos lo piden, otros no).

---

## 3. Diseño propuesto (alineado a la arquitectura actual)

### 3.1 Base de datos (migraciones nuevas, continúan desde `0027`)

```
src-tauri/migrations/
├── 0028_fe_configuracion.sql        -- parámetros del módulo FE
├── 0029_fe_documentos.sql           -- cola/registro de documentos electrónicos
└── 0030_fe_secuencias.sql           -- rangos de numeración FEV autorizados
```

**0028 — CONFIG_FE** (clave/valor tipado, cifrado donde aplique):
- `proveedor` (`factus` | `alanube` | `mock`), `ambiente` (`habilitacion` | `produccion`)
- credenciales del proveedor (client_id/secret/token) → **cifradas con PiiCipher**
- datos fiscales del emisor ya existentes en EMPRESA_CONFIG (NIT, dirección,
  teléfono) se reutilizan; se agregan: resolución/rango, régimen de IVA,
  código municipio DANE, actividad económica.

**0029 — FE_DOCUMENTOS** (cola + trazabilidad):
- `id`, `tipo_documento` (`FEV` | `NC` | `ND`), `id_origen` (renta/pago)
- `numero`, `prefijo`, `estado` (`PENDIENTE`, `EN_COLA`, `TRANSMITIDA`,
  `ACEPTADA_DIAN`, `RECHAZADA`, `CONTINGENCIA`, `CANCELADA`)
- `cufe`, `uuid_dian`, `respuesta_xml_path`, `pdf_path`, `error_msg`
- `intentos`, `proxima_reintentos_at`, `usuario`, `created_at`, `transmitted_at`
- índices por estado/fecha; FK a RENTAS (documento origen = cierre de renta)

**0030 — FE_RANGOS_NUMERACION**: prefijo, desde, hasta, vigencia, siguiente;
valida que el número asignado esté dentro del rango habilitado por la DIAN.

### 3.2 Backend Rust

```
src-tauri/src/
├── commands/fe.rs                  -- comandos Tauri
├── services/facturacion_electronica.rs   -- orquestador + cola/reintentos
├── services/proveedores/mod.rs     -- trait ProveedorFe
│   ├── factus.rs                   -- adaptador API REST
│   ├── alanube.rs                  -- adaptador API REST
│   └── mock.rs                     -- tests sin red
```

- **Trait `ProveedorFe`**: `emitir(doc) -> Result<RespuestaFe>` /
  `consultar(uuid)`; `RespuestaFe { cufe, uuid, estado, pdf, errores }`.
- **Cola asíncrona**: worker ligero (hilo/tokio task ya presente en la app)
  que procesa `PENDIENTE/RECHAZADA` con backoff exponencial y máximo N intentos.
- **Numeración**: transacción Firebird garantiza consecutivo único dentro del
  rango; nunca se reutiliza número rechazado (se marca `CANCELADA`).
- **Comandos Tauri**: `fe_emitir_para_renta`, `fe_estado`, `fe_reintentar`,
  `fe_listar_pendientes`, `fe_descargar_pdf`, `fe_configurar`.
- **RBAC**: nuevos permisos `fe:emitir`, `fe:configurar`, `fe:reenviar` en
  `core/rbac.rs` + capability del updater si aplica.
- **Auditoría**: cada emisión/reintento/rechazo registra en `log_audit`
  (infraestructura ya existente desde v1.0.25/26).
- **HTTP**: `ureq` (dependencia ya presente); timeout corto + reintentos.

### 3.3 Frontend SvelteKit

- Nueva ruta `/facturacion`: lista de documentos con `StatusBadge` por estado
  (componente existente), filtros por fecha/estado, acciones reintentar/descargar.
- En el cierre de renta (flujo actual `/rentas`): opción "Generar factura
  electrónica" que crea el registro `PENDIENTE`; badge de estado en la fila.
- Pantalla `/facturacion/configuracion`: elegir proveedor, ambiente, cargar
  credenciales (cifradas), rangos de numeración; visible solo con `fe:configurar`.
- Indicador global de conectividad: si está offline, la UI muestra el tamaño de
  la cola pendiente y ofrece marcar documentos como contingencia.

### 3.4 Representación gráfica (PDF)

El proveedor suele devolver el PDF validado; fallback: generar el PDF local
(reutilizando el pipeline de informes Excel/print existente) incluyendo CUFE,
QR, numeración y leyenda legal exigida por el Anexo Técnico.

---

## 4. Fases de implementación

### Fase 0 — Decisiones y requisitos externos (negocio, 1–2 semanas)
1. Cotizar y elegir proveedor tecnológico (sandbox incluido).
2. Trámites Dinamo Rent a Car: RUT actualizado, IFE, rangos de numeración FEV,
   definición de régimen IVA en config (ya existe flag `COBRA_IVA` por renta).
3. Definir qué evento genera factura: cierre de renta (y pagos/abonos si se
   requiere factura por pago parcial).

### Fase 1 — Modelo de datos y configuración (backend, ~1 semana)
- Migraciones 0028–0030 + repositorios con soft-delete/auditoría (estándar actual).
- CRUD de configuración FE cifrando secretos con PiiCipher.
- Tests: migraciones_integration + unit tests de repositorios.

### Fase 2 — Servicio FE con proveedor mock (~1–2 semanas)
- Trait `ProveedorFe` + orquestador de cola + reintentos + numeración.
- Comandos Tauri + RBAC + auditoría.
- Tests con `mock.rs` (sin red): ciclo completo emitir→aceptar, rechazo,
  reintento, contingencia.

### Fase 3 — Adaptador del proveedor real (~1 semana)
- Implementar adaptador del proveedor elegido contra su sandbox.
- Mapeo de totales: subtotal, descuento, IVA (porcentaje de config ×
  `cobra_iva` de la renta), retenciones si aplican.
- Pruebas de rechazos reales y reintentos.

### Fase 4 — Frontend (~1–2 semanas)
- Rutas `/facturacion` y configuración; integración en cierre de renta.
- Tests de store/ruta con mocks (patrón existente `*.test.ts`).

### Fase 5 — Habilitación y producción (1–2 semanas)
- Ambiente `habilitacion`: set de pruebas del proveedor/DIAN hasta aceptación.
- Paso a producción con rango real; monitoreo de la cola los primeros días.
- Capacitación: qué hace el usuario cuando un documento queda `RECHAZADA`.

### Criterios de aceptación globales
- Ningún documento queda silenciosamente sin transmitir (siempre hay estado +
  reintento o alerta).
- Toda acción FE queda auditada (quién, cuándo, resultado).
- La app sigue funcionando sin internet (cola + contingencia).
- `cargo check/test` + `svelte-check` + vitest en verde; CI relanza limpio.

---

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cambios del Anexo Técnico DIAN | Los absorbe el proveedor; versionar el adaptador. |
| Desktop sin internet en el momento del cierre | Cola persistente en Firebird + contingencia en papel reportable. |
| Certificado .p12 del emisor comprometido | Cifrado en reposo (PiiCipher), nunca en texto plano; rotación documentada como la clave PII existente. |
| Doble numeración (interna vs DIAN) | La numeración FE vive solo en `FE_RANGOS_NUMERACION`; la interna de rentas no cambia. |
| Vendor lock-in | Trait `ProveedorFe` + exportación de XML/PDF a disco local. |

---

## 6. Referencias

- Micrositio DIAN facturación electrónica: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/
- Resolución DIAN 000165 de 2023 (Anexo Técnico v1.9): https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0165_2023.htm
- Guía Edicom Colombia (jul 2026): https://edicomgroup.com/es/blog/como-es-la-factura-electronica-en-colombia
- Guía de integración a software propio (feb 2026): https://mytechsolutionsco.com/blog/facturacion-electronica-dian-integrar-software
- Proveedores con API REST investigados: Factus (factus.com.co), Alanube
  (alanube.co/colombia), Plemsi (plemsi.com), MATIAS API (matias-api.com),
  Facturalatam (facturalatam.com/api)
