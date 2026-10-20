//! commands/auto.rs — Comandos Tauri del módulo de vehículos (thin wrappers)

use crate::core::error::ErrorPayload;
use crate::repositories::auto::{Auto, AutoDatos};
use crate::services::auto::{AlertaVencimiento, AutoService};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_eliminacion, require_session};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista vehículos con filtros opcionales (búsqueda o estado).
///
/// `async` + `en_blocking` (TAREA 3.4): el filtro de búsqueda hace `LIKE`
/// sobre placa/marca/modelo que puede escanear la tabla completa.
#[tauri::command]
pub async fn listar_autos(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
    estado: Option<String>,
) -> Cmd<Vec<Auto>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "listar_autos", move |c| {
        AutoService::listar(c, busqueda.as_deref(), estado.as_deref())
    })
    .await
}

/// Obtiene un vehículo por placa
#[tauri::command]
pub async fn obtener_auto(
    state: State<'_, AppState>,
    session_id: String,
    placa: String,
) -> Cmd<Auto> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "obtener_auto", move |c| AutoService::obtener(c, &placa)).await
}

/// Crea un vehículo
#[tauri::command]
pub async fn crear_auto(
    state: State<'_, AppState>,
    session_id: String,
    datos: AutoDatos,
) -> Cmd<Auto> {
    let session = require_session(&state, &session_id)?;
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "crear_auto", move |c| {
        AutoService::crear(c, &config, &username, datos)
    })
    .await
}

/// Actualiza un vehículo por placa
#[tauri::command]
pub async fn actualizar_auto(
    state: State<'_, AppState>,
    session_id: String,
    placa: String,
    datos: AutoDatos,
) -> Cmd<Auto> {
    let session = require_session(&state, &session_id)?;
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "actualizar_auto", move |c| {
        AutoService::actualizar(c, &config, &username, &placa, datos)
    })
    .await
}

/// Elimina un vehículo por placa
#[tauri::command]
pub async fn eliminar_auto(
    state: State<'_, AppState>,
    session_id: String,
    placa: String,
) -> Cmd<()> {
    let session = require_eliminacion(&state, &session_id)?;
    let username = session.username;
    en_blocking(&state, "eliminar_auto", move |c| {
        AutoService::eliminar(c, &username, &placa).map(|_| ())
    })
    .await
}

/// Alertas de vencimientos (SOAT, técnico, extintor, batería, aceite)
#[tauri::command]
pub async fn alertas_autos(state: State<'_, AppState>, session_id: String) -> Cmd<Vec<AlertaVencimiento>> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "alertas_autos", move |c| {
        AutoService::alertas_vencimiento(c, &config)
    })
    .await
}
