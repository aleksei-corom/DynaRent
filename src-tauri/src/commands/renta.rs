//! commands/renta.rs — Comandos Tauri del módulo de rentas (thin wrappers)

use crate::core::error::ErrorPayload;
use crate::repositories::extension::ExtensionRentaRepository;
use crate::repositories::renta::{
    ExtensionDatos, Inspeccion, InspeccionDatos, Pago, PagoDatos, Renta, RentaCierreDatos,
    RentaCierreEditDatos, RentaDatos,
};
use crate::services::renta::{RentaCancelada, RentaService};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_eliminacion, require_session};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista rentas con filtros opcionales (búsqueda, estado o placa).
///
/// TAREA 3.4 (Bloque 3 — Performance): el comando es `async` y corre la
/// consulta en `tauri::async_runtime::spawn_blocking` para no bloquear el
/// event loop de Tauri. `listar_rentas` puede aplicar filtros LIKE sobre
/// `nombre_cliente` y `placa` que escanean la tabla completa si no hay índice
/// funcional — conviene no retener el hilo del runtime mientras Firebird
/// resuelve el WHERE.
#[tauri::command]
pub async fn listar_rentas(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
    estado: Option<String>,
    placa: Option<String>,
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
) -> Cmd<Vec<Renta>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "listar_rentas", move |c| {
        RentaService::listar(
            c,
            busqueda.as_deref(),
            estado.as_deref(),
            placa.as_deref(),
            fecha_desde.as_deref(),
            fecha_hasta.as_deref(),
        )
    })
    .await
}

/// Obtiene una renta por id (con pagos e inspecciones).
#[tauri::command]
pub async fn obtener_renta(state: State<'_, AppState>, session_id: String, id: i64) -> Cmd<Renta> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "obtener_renta", move |c| RentaService::obtener(c, id)).await
}

/// Crea una renta
#[tauri::command]
pub async fn crear_renta(
    state: State<'_, AppState>,
    session_id: String,
    datos: RentaDatos,
) -> Cmd<Renta> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "crear_renta", move |c| {
        RentaService::crear(c, &config, datos)
    })
    .await
}

/// Actualiza una renta (no cerradas)
#[tauri::command]
pub async fn actualizar_renta(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: RentaDatos,
) -> Cmd<Renta> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "actualizar_renta", move |c| {
        RentaService::actualizar(c, &config, id, datos)
    })
    .await
}

/// Cambia el vehículo asignado a una renta activa sin cerrarla
#[tauri::command]
pub async fn cambiar_auto_renta(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    placa: String,
) -> Cmd<Renta> {
    let sesion = require_session(&state, &session_id)?;
    let username = sesion.username;
    en_blocking(&state, "cambiar_auto_renta", move |c| {
        RentaService::cambiar_auto(c, id, &placa, &username)
    })
    .await
}

/// Cierra una renta con la devolución real y recalcula los totales.
#[tauri::command]
pub async fn cerrar_renta(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: RentaCierreDatos,
) -> Cmd<Renta> {
    let sesion = require_session(&state, &session_id)?;
    let config = state.config.clone();
    let username = sesion.username;
    en_blocking(&state, "cerrar_renta", move |c| {
        RentaService::cerrar(c, &config, id, &username, datos)
    })
    .await
}

/// Cancela una renta activa
#[tauri::command]
pub async fn cancelar_renta(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<RentaCancelada> {
    let sesion = require_session(&state, &session_id)?;
    let username = sesion.username;
    en_blocking(&state, "cancelar_renta", move |c| {
        RentaService::cancelar(c, id, &username)
    })
    .await
}

/// Extiende una renta activa agregando horas o días extras
#[tauri::command]
pub async fn extender_renta(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: ExtensionDatos,
) -> Cmd<Renta> {
    let sesion = require_session(&state, &session_id)?;
    let config = state.config.clone();
    let username = sesion.username;
    en_blocking(&state, "extender_renta", move |c| {
        RentaService::extender(c, &config, id, &username, datos)
    })
    .await
}

/// Lista extensiones de una renta
#[tauri::command]
pub async fn listar_extensiones(
    state: State<'_, AppState>,
    session_id: String,
    id_renta: i64,
) -> Cmd<Vec<crate::repositories::extension::ExtensionRenta>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "listar_extensiones", move |c| {
        ExtensionRentaRepository::listar_por_renta(c, id_renta)
    })
    .await
}

/// Edita campos financieros de una renta cerrada (solo Administrador).
#[tauri::command]
pub async fn editar_renta_cerrada(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: RentaCierreEditDatos,
) -> Cmd<Renta> {
    let sesion = require_eliminacion(&state, &session_id)?;
    let config = state.config.clone();
    let username = sesion.username;
    en_blocking(&state, "editar_renta_cerrada", move |c| {
        RentaService::editar_cerrada(c, &config, id, &username, datos)
    })
    .await
}

/// Elimina una renta (pagos e inspecciones en cascada)
#[tauri::command]
pub async fn eliminar_renta(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<()> {
    let sesion = require_eliminacion(&state, &session_id)?;
    let username = sesion.username;
    en_blocking(&state, "eliminar_renta", move |c| {
        RentaService::eliminar(c, id, &username).map(|_| ())
    })
    .await
}

/// Registra un pago contra una renta activa (actualiza abono/saldo)
#[tauri::command]
pub async fn registrar_pago_renta(
    state: State<'_, AppState>,
    session_id: String,
    id_renta: i64,
    datos: PagoDatos,
) -> Cmd<Pago> {
    let sesion = require_session(&state, &session_id)?;
    let username = sesion.username;
    en_blocking(&state, "registrar_pago_renta", move |c| {
        RentaService::registrar_pago(c, id_renta, &username, datos)
    })
    .await
}

/// Registra una inspección (Salida/Entrada) de una renta
#[tauri::command]
pub async fn registrar_inspeccion_renta(
    state: State<'_, AppState>,
    session_id: String,
    id_renta: i64,
    datos: InspeccionDatos,
) -> Cmd<Inspeccion> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "registrar_inspeccion_renta", move |c| {
        RentaService::registrar_inspeccion(c, id_renta, datos)
    })
    .await
}

/// Rentas activas (para el calendario y el dashboard)
#[tauri::command]
pub async fn rentas_activas(state: State<'_, AppState>, session_id: String) -> Cmd<Vec<Renta>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "rentas_activas", RentaService::activas).await
}
