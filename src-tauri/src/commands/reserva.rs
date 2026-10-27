//! commands/reserva.rs — Comandos Tauri del módulo de reservas (thin wrappers)

use crate::core::error::ErrorPayload;
use crate::repositories::reserva::{Reserva, ReservaDatos};
use crate::services::reserva::{ReservaCancelada, ReservaService};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_eliminacion, require_session};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista reservas con filtros opcionales (búsqueda o estado).
///
/// `async` + `en_blocking` (TAREA 3.4): filtros LIKE + rango de fechas que
/// pueden escanear la tabla completa.
#[tauri::command]
pub async fn listar_reservas(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
    estado: Option<String>,
    fecha_desde: Option<String>,
    fecha_hasta: Option<String>,
) -> Cmd<Vec<Reserva>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "listar_reservas", move |c| {
        ReservaService::listar(
            c,
            busqueda.as_deref(),
            estado.as_deref(),
            fecha_desde.as_deref(),
            fecha_hasta.as_deref(),
        )
    })
    .await
}

/// Próximas reservas (recogida hoy o en el futuro, no canceladas)
#[tauri::command]
pub async fn proximas_reservas(
    state: State<'_, AppState>,
    session_id: String,
    limit: Option<i64>,
) -> Cmd<Vec<Reserva>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "proximas_reservas", move |c| {
        ReservaService::proximas(c, limit.unwrap_or(10))
    })
    .await
}

/// Obtiene una reserva por id
#[tauri::command]
pub async fn obtener_reserva(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<Reserva> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "obtener_reserva", move |c| {
        ReservaService::obtener(c, id)
    })
    .await
}

/// Crea una reserva
#[tauri::command]
pub async fn crear_reserva(
    state: State<'_, AppState>,
    session_id: String,
    datos: ReservaDatos,
) -> Cmd<Reserva> {
    let session = require_session(&state, &session_id)?;
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "crear_reserva", move |c| {
        ReservaService::crear(c, &config, &username, datos)
    })
    .await
}

/// Actualiza una reserva por id
#[tauri::command]
pub async fn actualizar_reserva(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: ReservaDatos,
) -> Cmd<Reserva> {
    let session = require_session(&state, &session_id)?;
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "actualizar_reserva", move |c| {
        ReservaService::actualizar(c, &config, &username, id, datos)
    })
    .await
}

/// Cancela una reserva (no se puede cancelar una ya completada)
#[tauri::command]
pub async fn cancelar_reserva(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<ReservaCancelada> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "cancelar_reserva", move |c| {
        ReservaService::cancelar(c, id)
    })
    .await
}

/// Elimina una reserva
#[tauri::command]
pub async fn eliminar_reserva(state: State<'_, AppState>, session_id: String, id: i64) -> Cmd<()> {
    let session = require_eliminacion(&state, &session_id)?;
    let username = session.username;
    en_blocking(&state, "eliminar_reserva", move |c| {
        ReservaService::eliminar(c, &username, id).map(|_| ())
    })
    .await
}
