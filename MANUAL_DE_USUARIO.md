# 📖 Manual de Usuario y Operaciones — DynaRent ERP

> **Sistema Integral de Gestión de Flota y Alquiler de Vehículos**  
> **Versión del Sistema:** v1.0.30+ | **Motor de Base de Datos:** Firebird Embedded 5.0  
> **Tecnología:** Tauri V2 + Rust + SvelteKit + Tailwind CSS  

---

## 📑 Tabla de Contenidos

1. [Introducción y Arquitectura del Sistema](#1-introducción-y-arquitectura-del-sistema)
2. [Acceso al Sistema y Primeros Pasos](#2-acceso-al-sistema-y-primeros-pasos)
3. [Navegación General y Menú de Opciones](#3-navegación-general-y-menú-de-opciones)
4. [Panel de Control (Dashboard)](#4-panel-de-control-dashboard)
5. [Gestión de Flota de Vehículos](#5-gestión-de-flota-de-vehículos)
6. [Operación de Rentas y Contratos](#6-operación-de-rentas-y-contratos)
7. [Gestión de Reservas y Disponibilidad](#7-gestión-de-reservas-y-disponibilidad)
8. [Calendario de Ocupación](#8-calendario-de-ocupación)
9. [Módulo de Mantenimiento y Taller](#9-módulo-de-mantenimiento-y-taller)
10. [Comparendos y Sincronización SIMIT](#10-comparendos-y-sincronización-simit)
11. [Gastos Operativos y Caja Menor](#11-gastos-operativos-y-caja-menor)
12. [Centro de Alertas del Sistema](#12-centro-de-alertas-del-sistema)
13. [Informes Contables y Balance Financiero](#13-informes-contables-y-balance-financiero)
14. [Administración de Usuarios y Permisos (RBAC)](#14-administración-de-usuarios-y-permisos-rbac)
15. [Auditoría de Acciones](#15-auditoría-de-acciones)
16. [Configuración de la Empresa](#16-configuración-de-la-empresa)
17. [Glosario y Preguntas Frecuentes (FAQ)](#17-glosario-y-preguntas-frecuentes-faq)

---

## 1. Introducción y Arquitectura del Sistema

**DynaRent ERP** es una solución de escritorio de alto rendimiento diseñada específicamente para empresas de alquiler de vehículos y administración de flotas de transporte.

### Principales Características:
- **Operación Local Segura:** Utiliza **Firebird Embedded 5.0**, lo que significa que la base de datos corre de forma interna sin requerir servidores abiertos en red local que expongan los datos a ataques externos.
- **Protección de Datos Personales (PII):** Los datos sensibles de clientes y conductores (números de identificación, licencias y teléfonos) se almacenan protegidos bajo cifrado de grado militar **AES-256-GCM**.
- **Autenticación Fuerte:** Contraseñas hasheadas con **Argon2id** y políticas de expiración y cambio forzoso.
- **Control de Acceso Basado en Roles (RBAC):** Tres niveles de autorización:
  1. **Administrador:** Acceso ilimitado a usuarios, informes contables, auditoría, configuración de empresa y eliminación de datos.
  2. **Supervisor:** Control operativo completo, aprobación de rentas, gestión de taller, comparendos y capacidad de eliminación autorizada.
  3. **Operador:** Gestión de mostrador día a día (crear clientes, abrir contratos, registrar pagos y mantenimientos), con bloqueo de borrado de registros e informes financieros confidenciales.

---

## 2. Acceso al Sistema y Primeros Pasos

### 2.1 Pantalla de Inicio de Sesión (Login)

Para ingresar a DynaRent ERP, inicie la aplicación desde el acceso directo del escritorio o el menú de inicio de Windows.

![Inicio de Sesión en DynaRent ERP](screen%20Shots/Login-DynaRent%20ERP.png)

#### Pasos para iniciar sesión:
1. Ingrese su **Nombre de usuario**.
2. Escriba su **Contraseña**.
3. Haga clic en el botón **Iniciar Sesión**.

> [!NOTE]
> **Credenciales en Instalaciones Nuevas:**
> - **Usuario:** `admin`
> - **Contraseña predeterminada:** `admin123`
> 
> En el primer ingreso con credenciales de fábrica, el sistema solicitará obligatoriamente el **cambio de contraseña** antes de permitir el acceso a los módulos operativos.

> [!WARNING]
> Tras 5 intentos fallidos consecutivos de ingreso con una contraseña incorrecta, la cuenta se bloqueará automáticamente por seguridad. Solo un usuario con rol de **Administrador** podrá desbloquearla desde el módulo de usuarios.

---

## 3. Navegación General y Menú de Opciones

Una vez autenticado, DynaRent ERP presenta una barra de navegación lateral izquierda que organiza todos los módulos según los permisos del usuario activo.

![Menú de Navegación de DynaRent ERP](screen%20Shots/Menu-DynaRent.png)

### Secciones del Menú:
- **Operaciones:** Dashboard, Rentas, Reservas, Calendario.
- **Activos:** Flota de Vehículos, Mantenimiento de Taller.
- **Control y Tráfico:** Comparendos (Multas SIMIT), Centro de Alertas.
- **Finanzas:** Gastos (Caja Menor), Informes Mensuales.
- **Administración:** Clientes, Usuarios, Auditoría, Configuración de Empresa.
- **Pie de menú:** Indicador del usuario activo, rol del sistema y botón de **Cerrar Sesión**.

---

## 4. Panel de Control (Dashboard)

El **Dashboard** es el centro de comando diario del negocio. Ofrece visibilidad en tiempo real del estado de la flota, las operaciones en curso y las tareas inmediatas por atender.

![Dashboard Principal de DynaRent ERP](screen%20Shots/Dashboard-DynaRent%20ERP.png)

### Componentes Clave:
1. **Tarjetas de Estado de Flota (KPIs):**
   - **Vehículos Disponibles:** Listos en patio para entrega inmediata o nuevas reservas.
   - **Vehículos Rentados:** Actualmente en manos de clientes con contrato abierto.
   - **En Mantenimiento:** Unidades fuera de servicio por reparaciones o revisiones periódicas.
   - **En Reserva:** Separados para contratos que inician en las próximas horas o días.
2. **Entregas y Devoluciones del Día:** Listado priorizado con las horas programadas para recepción y entrega de vehículos.
3. **Indicadores Financieros Rápidos:** Total facturado en el mes, depósitos en garantía retenidos y cuentas por cobrar pendientes.

---

## 5. Gestión de Flota de Vehículos

El módulo de **Flota** permite registrar, consultar, editar y supervisar el ciclo de vida de cada automóvil o camioneta de la empresa.

![Módulo de Gestión de Flota](screen%20Shots/Modulo%20de%20Flota.png)

### 5.1 Registro de un Nuevo Vehículo

Para incorporar una nueva unidad a la flota, pulse el botón **`+ Nuevo Vehículo`**. El proceso se divide en dos secciones detalladas:

#### A. Información Básica y Tarifas
![Formulario Nuevo Vehículo - Información Básica](screen%20Shots/FormNuevo_vehiculo-DynaRent.png)

- **Placa:** Identificador único del vehículo (ej: `XYZ-123`).
- **Marca y Modelo:** Fabricante y referencia comercial.
- **Año / Modelo:** Año de fabricación.
- **Tipo de Vehículo:** Sedán, SUV, Camioneta, Hatchback, etc.
- **Color y Transmisión:** Características para el cliente (Automático / Mecánico).
- **Kilometraje Actual:** Odómetro al momento del ingreso.
- **Tarifa Diaria Base ($):** Valor estándar por bloque de 24 horas.
- **Valor Depósito de Garantía ($):** Monto retenido como fianza durante el alquiler.

#### B. Documentación Legal y Pólizas
![Formulario Nuevo Vehículo - Documentación Legal](screen%20Shots/FormNuevo_vehiculoB-DynaRent.png)

- **Número y Vencimiento del SOAT:** Fecha límite para renovación del seguro obligatorio.
- **Revisión Técnico-Mecánica:** Fecha de vencimiento del certificado técnico.
- **Póliza Todo Riesgo:** Aseguradora, número de contrato y vigencia.
- **Estado Inicial:** `Disponible`, `Mantenimiento` o `Inactivo`.

> [!TIP]
> Registrar con precisión las fechas de SOAT y Tecnomecánica alimenta automáticamente el **Centro de Alertas**, avisándole con 30 y 15 días de antelación antes de que el vehículo circule de forma irregular.

---

## 6. Operación de Rentas y Contratos

El módulo de **Rentas** es el corazón operativo de la rentadora. Administra el flujo completo desde la cotización y entrega hasta la liquidación final y devolución.

![Panel Principal de Rentas](screen%20Shots/panel%20de%20Renta-DynaRent%20ERP.png)

### 6.1 Crear un Nuevo Contrato de Renta

Al hacer clic en **`+ Nueva Renta`**, se abre el asistente de formalización de contrato:

![Formulario de Creación de Renta](screen%20Shots/formNueva%20Renta-DynaRent%20ERP.png)

#### Pasos para formalizar la renta:
1. **Selección del Cliente:** Busque por nombre o cédula/NIT. Si el cliente es nuevo, utilice el botón rápido para crearlo sin salir del flujo.
2. **Selección del Vehículo:** Solo se desplegarán unidades en estado `Disponible`.
3. **Fechas y Horas:**
   - **Fecha y Hora de Recogida (Salida):** Momento exacto de entrega de llaves.
   - **Fecha y Hora de Retorno (Devolución acordada):** Fecha estipulada de devolución.
4. **Kilometraje Inicial:** Lectura del odómetro en patio.
5. **Nivel de Combustible:** Marcación del tanque de salida (Full, 3/4, 1/2, 1/4).

---

### 6.2 Alta Rápida de Clientes desde la Renta

Si el cliente no se encuentra registrado en la base de datos, el asistente permite darlo de alta instantáneamente:

![Registro Rápido de Cliente](screen%20Shots/nuevocliente%20desderenta-DynaRent.png)

- **Tipo y Número de Documento:** Cédula de Ciudadanía, Cédula de Extranjería, Pasaporte o NIT.
- **Nombres y Apellidos:** Datos completos del titular.
- **Teléfono y Correo Electrónico:** Vías de contacto para facturación y notificaciones.
- **Número y Categoría de Licencia:** Verificación de idoneidad para conducir.
- **Vencimiento de Licencia:** Control de vigencia legal.

---

### 6.3 Servicios Adicionales, Combustible e Impuestos

DynaRent ERP permite configurar conceptos extra en cada contrato para reflejar con exactitud la propuesta comercial:

![Cargos Adicionales de Renta](screen%20Shots/adicionales%20Renta-DynaRent%20ERP.png)

- **Cargos por Combustible:** Cobro por tanque incompleto o paquete prepagado de combustible.
- **Servicios Opcionales:** Conductor adicional, silla de bebé, GPS, coberturas de protección deducible cero.
- **Impuesto sobre las Ventas (IVA 19%):** Casilla verificable (`Cobra IVA`). Si el cliente o el tipo de contrato está exento, puede desmarcarse para calcular el valor neto sin impuesto.
- **Comisiones de Intermediación:** Registro de comisiones para agencias de viajes o brokers de renta.
- **Depósito de Garantía:** Monto y método de recepción (Efectivo, Tarjeta de Crédito, Transferencia).

---

### 6.4 Modelo de Liquidación y Reglas de Facturación

El sistema implementa la formulación matemática estándar de la industria de alquiler automotriz:

$$\text{Tiempo Total} = \text{Fecha/Hora Retorno} - \text{Fecha/Hora Recogida}$$

1. **Bloques de 24 Horas:** Cada bloque completo se computa como un día completo de renta a la tarifa pactada.
2. **Periodo de Gracia (*Grace Period*):** Margen de tolerancia configurable (habitualmente 29 a 59 minutos) tras el cual no se generan cobros adicionales por retraso menor.
3. **Horas Extra:** Si el retorno supera el periodo de gracia pero no excede el umbral máximo de horas extra, se liquida la tarifa por hora configurada en la empresa.
4. **Día Adicional Completo:** Si el tiempo remanente sobrepasa el umbral máximo de horas extra, se liquida un día base adicional completo.
5. **Indivisibilidad de Coberturas:** Los servicios y coberturas adicionales se facturan siempre por días enteros completos.

---

### 6.5 Devolución, Inspección y Cierre de Contrato

Cuando el vehículo retorna a la sede:
1. Abra el contrato desde la tabla de rentas y elija **Cerrar Renta**.
2. **Inspección de Entrada:** Verifique y registre el kilometraje de retorno y el nivel de gasolina.
3. **Chequeo de Daños:** Si existen rayones, golpes o faltantes, regístrelos en el acta de inspección para liquidar los cargos contra el depósito de garantía.
4. **Balance Final:** El sistema calcula el saldo a favor o en contra del cliente y genera el recibo de liquidación.

---

## 7. Gestión de Reservas y Disponibilidad

El módulo de **Reservas** previene la sobreventa de flota y asegura que los vehículos solicitados con anticipación no sean asignados a otros clientes.

![Módulo de Reservas de Vehículos](screen%20Shots/modulo%20reservas-DynaRent%20ERP.png)

### Flujo de Estados de una Reserva:
- **Pendiente:** Registrada pero sin confirmación de anticipo.
- **Confirmada:** Con depósito de apartado verificado. El vehículo queda bloqueado en el inventario para ese rango horario.
- **Convertida en Renta:** Al llegar la fecha y presentarse el cliente, un solo clic en **`Convertir a Renta`** traslada todos los datos de la reserva directamente a un nuevo contrato sin reescribir información.
- **Cancelada:** Liberación del vehículo para retornar al estado `Disponible`.

---

## 8. Calendario de Ocupación

El **Calendario** ofrece una vista visual tipo diagrama de Gantt que ilustra la ocupación temporal de cada vehículo de la flota a lo largo de los días y semanas.

![Calendario de Disponibilidad de Flota](screen%20Shots/Calendario-DynaRent%20ERP.png)

### Beneficios del Calendario:
- Permite detectar de inmediato qué vehículos tienen periodos libres entre contratos para ofrecerlos a clientes sin reserva previa (*walk-in*).
- Facilita programar paradas de mantenimiento preventivo en huecos de baja demanda.
- Codificación por colores según el estado: Verde (Disponible), Azul (Renta activa), Amarillo (Reserva confirmada), Rojo (Mantenimiento).

---

## 9. Módulo de Mantenimiento y Taller

Garantiza la operatividad mecánica y la seguridad vial de los vehículos mediante el control exhaustivo de servicios preventivos y correctivos.

![Módulo de Mantenimiento](screen%20Shots/Modulo_Mantenimiento-DynaRent%20ERP.png)

### 9.1 Registrar una Orden de Mantenimiento

Haga clic en **`+ Nuevo Mantenimiento`** para registrar el ingreso al taller:

![Formulario de Registro de Mantenimiento](screen%20Shots/FrmRegistro_Mantenimiento-DynaRent%20ERP.png)

#### Campos a diligenciar:
- **Vehículo:** Seleccione la placa intervenida.
- **Tipo de Mantenimiento:** Preventivo (cambio de aceite, filtros, pastillas) o Correctivo (reparación de motor, suspensión, chapa y pintura).
- **Taller / Proveedor:** Nombre del centro de servicio automotriz.
- **Kilometraje del Servicio:** Odómetro al momento del ingreso.
- **Costo Total:** Monto facturado por repuestos y mano de obra.
- **Fecha y Número de Factura:** Soporte contable del gasto.
- **Próximo Mantenimiento (Km/Fecha):** Establece el disparador para la siguiente alerta técnica.

---

## 10. Comparendos y Sincronización SIMIT

DynaRent ERP cuenta con integración especializada para el rastreo y administración de fotomultas y comparendos de tránsito en Colombia a través del portal **SIMIT**.

![Módulo de Comparendos y Fotomultas](screen%20Shots/modulo_comparendos-DynaRent%20ERP.png)

### 10.1 Agente de Sincronización SIMIT
- **Monitoreo Automático:** Consulta periódicamente el estado de infracciones de todas las placas registradas en la flota.
- **Atribución Inteligente de Infracción:** Cuando se detecta un comparendo nuevo, el sistema cruza la fecha y hora de la infracción con el histórico de contratos y **asocia automáticamente la multa al cliente** que conducía el automóvil en ese instante.

### 10.2 Registro Manual de Comparendos
Para infracciones notificadas en físico o impuestas en vía pública por agentes de tránsito:

![Formulario de Registro Manual de Comparendo](screen%20Shots/FrmRegistroComparendo-DynaRent%20ERP.png)

- **Número de Comparendo:** Código único nacional de la infracción.
- **Placa y Conductor Infractor:** Vehículo y persona responsable.
- **Código de Infracción:** Tipo de falta (ej: `C02`, `C29` exceso de velocidad).
- **Valor de la Multa:** Monto a liquidar.
- **Estado de Pago:** `Pendiente`, `En Cobro al Cliente` o `Pagado`.

---

## 11. Gastos Operativos y Caja Menor

Permite asentar todos los desembolsos menores del día a día que no corresponden directamente a compras de taller mayor.

![Módulo de Gastos y Caja Menor](screen%20Shots/Modulo_Gastos(Caja_Menor)-DynaRent%20ERP.png)

### Tipos de Gastos Habituales:
- Lavado y alistamiento de vehículos.
- Peajes y combustible de traslado entre sucursales.
- Parqueaderos y grúas.
- Papelería y suministros de oficina.

Cada gasto puede vincularse opcionalmente a una placa particular para calcular con precisión el costo real de posesión de cada unidad de la flota.

---

## 12. Centro de Alertas del Sistema

El **Centro de Alertas** centraliza todos los eventos que requieren atención inmediata o preventiva por parte del personal operativo.

![Centro de Alertas de DynaRent ERP](screen%20Shots/Modulo_Alertas-DynaRent%20ERP.png)

### Clasificación de Alertas:
| Nivel | Tipo de Alerta | Criterio de Activación |
|---|---|---|
| 🔴 **Crítico** | SOAT o Tecnomecánica Vencido | La fecha actual es posterior al vencimiento. El auto no debe salir a renta. |
| 🟡 **Advertencia** | Documento por Vencer | Faltan menos de 15 días para la expiración de la póliza o certificado. |
| 🟡 **Advertencia** | Mantenimiento por Kilometraje | El auto superó el umbral de kilometraje pactado para cambio de aceite/frenos. |
| 🟠 **Operativo** | Retorno de Renta Atrasado | El cliente superó la hora de retorno pactada sin haber solicitado extensión formal. |

---

## 13. Informes Contables y Balance Financiero

> 🔒 *Módulo restringido para usuarios con rol de Administrador.*

Proporciona la visión global del rendimiento económico de la rentadora, permitiendo tomar decisiones estratégicas de precios y renovación de unidades.

![Módulo de Informes y Balance](screen%20Shots/Modulo_Informes-DynaRent%20ERP.png)

### Métricas y Reportes Disponibles:
- **Ingresos Brutos por Rentas:** Desglose mensual y comparativo por categorías de vehículos.
- **Egresos Totales:** Suma de mantenimientos, compras de repuestos y caja menor.
- **Utilidad Neta Operativa:** Margen resultante por periodo.
- **Rentabilidad por Vehículo (*RevPVD*):** Rendimiento financiero específico de cada placa (ingresos generados menos gastos de mantenimiento acumulados).
- **Exportación:** Generación de resúmenes en formatos estándar para contabilidad externa.

---

## 14. Administración de Usuarios y Permisos (RBAC)

> 🔒 *Módulo restringido para usuarios con rol de Administrador.*

Permite gestionar los accesos del personal al software, salvaguardando la integridad de los datos de la compañía.

![Módulo de Usuarios del Sistema](screen%20Shots/Modulo_Usuarios-DynaRent%20ERP.png)

### 14.1 Crear un Nuevo Usuario

Al presionar **`+ Nuevo Usuario`**:

![Formulario de Registro de Usuario](screen%20Shots/FrmNuevo_Usuario-DynaRent%20ERP.png)

- **Nombre de Usuario (`username`):** Identificador alfanumérico único para iniciar sesión.
- **Nombre Completo y Correo Electrónico:** Identificación personal del funcionario.
- **Contraseña Inicial:** Clave temporal que el colaborador deberá actualizar en su primer inicio.
- **Asignación de Rol:**
  - `Administrador`: Acceso total.
  - `Supervisor`: Operación, taller, comparendos y borrado de registros de mostrador.
  - `Operador`: Registro diario sin privilegios de eliminación ni acceso financiero.
- **Estado:** Activo / Inactivo.
- **Desbloqueo de Cuenta:** Si un usuario bloqueó su cuenta por intentos fallidos de clave, el administrador puede desbloquearlo desde esta pantalla.

---

## 15. Auditoría de Acciones

> 🔒 *Módulo restringido para usuarios con rol de Administrador.*

DynaRent ERP incorpora un sistema de registro de auditoría estricto e inmutable para garantizar la trazabilidad de cada acción relevante en el negocio.

![Módulo de Auditoría de Acciones](screen%20Shots/Modulo_de_Auditoria-DynaRent%20ERP.png)

### Datos Registrados por Evento:
- **Fecha y Hora Exacta:** Timestamp generado por el motor de base de datos.
- **Usuario Responsable:** Identificador del colaborador que realizó la operación.
- **Acción Realizada:** `CREAR`, `MODIFICAR`, `ELIMINAR`, `CERRAR_RENTA`, `PAGO_REGISTRADO`, etc.
- **Módulo y Entidad:** Tabla afectada (ej. `RENTAS`, `AUTOS`, `CLIENTES`).
- **Detalle de la Operación:** Valores previos y nuevos campos modificados.

---

## 16. Configuración de la Empresa

Permite personalizar los datos corporativos que se imprimen en los contratos de alquiler, comprobantes de pago y actas de entrega/devolución.

![Módulo de Configuración de Empresa](screen%20Shots/Modulo_Config_Empresa-DynaRent%20ERP.png)

### Parámetros Configurables:
- **Razón Social y NIT:** Identificación tributaria de la rentadora.
- **Dirección Principal, Ciudad y País:** Ubicación de la sede principal.
- **Teléfonos y Correo de Contacto:** Canales de atención impresos en el encabezado de los contratos.
- **Logotipo de la Empresa:** Carga de imagen oficial (PNG/JPG) que se inserta en los documentos PDF e impresiones térmicas.
- **Políticas de Renta:**
  - Tolerancia de entrega (minutos de periodo de gracia).
  - Cobro automático de horas extra y valor estándar por hora.
  - Cargo predeterminado por faltante de combustible.

---

## 17. Glosario y Preguntas Frecuentes (FAQ)

### Glosario de Términos
- **PII (*Personally Identifiable Information*):** Información personal sensible de los clientes resguardada bajo cifrado AES-256-GCM.
- **SIMIT:** Sistema Integrado de Información sobre Multas y Sanciones por Infracciones de Tránsito de Colombia.
- **SOAT:** Seguro Obligatorio de Accidentes de Tránsito.
- **Odómetro:** Contador de kilometraje total recorrido por el vehículo.
- **Check-in / Check-out:** Proceso de inspección física y técnica al entregar (out) y recibir (in) el vehículo.
- **Depósito de Garantía:** Valor bloqueado o recibido en fianza para cubrir posibles daños, faltantes de gasolina o multas imputables al cliente.

---

### Preguntas Frecuentes

#### ¿Qué debo hacer si un cliente devuelve el vehículo con retraso?
Si el retraso no fue notificado con antelación, al momento de cerrar la renta el sistema evaluará el tiempo transcurrido:
- Si está dentro del periodo de gracia (ej. menos de 30 minutos), no aplicará recargo.
- Si supera el margen, liquidará automáticamente las horas extra configuradas o un día base adicional según la política establecida.

#### ¿Cómo extiendo un contrato si el cliente solicita más días de alquiler?
Abra el contrato desde el listado de rentas activas y seleccione la opción **Extender Renta**. Indique la nueva fecha y hora de entrega convenida; el sistema recalculará el total pactado y los días extra a facturar.

#### ¿Puedo borrar un contrato o un vehículo registrado por error?
La acción de eliminación requiere el rol de **Supervisor** o **Administrador**. Además, el sistema utiliza *Soft Deletes* (borrado lógico), preservando la integridad histórica y registrando el evento en el módulo de auditoría.

#### ¿Dónde se guardan las copias de seguridad de los datos?
Al ser una base de datos Firebird Embedded, la información reside en un único archivo portable `dynarent_v3.fdb` ubicado en `%APPDATA%\com.corjar.dynarent\`. Puede respaldar este archivo con la aplicación cerrada o utilizar la opción de exportación en el menú administrativo.
