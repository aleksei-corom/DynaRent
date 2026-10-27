//! commands/mantenimiento.rs — Comandos Tauri del módulo de mantenimiento (thin wrappers)

use crate::core::error::ErrorPayload;
use crate::repositories::mantenimiento::{Mantenimiento, MantenimientoDatos};
use crate::services::mantenimiento::{AlertaKm, MantenimientoService, TotalesMantenimiento};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_eliminacion, require_session};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista mantenimientos con filtros opcionales (búsqueda, placa o tipo).
///
/// `async` + `en_blocking` (TAREA 3.4): filtros LIKE que pueden escanear la
/// tabla completa.
#[tauri::command]
pub async fn listar_mantenimientos(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
    placa: Option<String>,
    tipo: Option<String>,
) -> Cmd<Vec<Mantenimiento>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "listar_mantenimientos", move |c| {
        MantenimientoService::listar(c, busqueda.as_deref(), placa.as_deref(), tipo.as_deref())
    })
    .await
}

/// Mantenimientos recientes
#[tauri::command]
pub async fn mantenimientos_recientes(
    state: State<'_, AppState>,
    session_id: String,
    limit: Option<i64>,
) -> Cmd<Vec<Mantenimiento>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "mantenimientos_recientes", move |c| {
        MantenimientoService::recientes(c, limit.unwrap_or(10))
    })
    .await
}

/// Obtiene un mantenimiento por id
#[tauri::command]
pub async fn obtener_mantenimiento(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<Mantenimiento> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "obtener_mantenimiento", move |c| {
        MantenimientoService::obtener(c, id)
    })
    .await
}

/// Crea un mantenimiento
#[tauri::command]
pub async fn crear_mantenimiento(
    state: State<'_, AppState>,
    session_id: String,
    datos: MantenimientoDatos,
) -> Cmd<Mantenimiento> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "crear_mantenimiento", move |c| {
        MantenimientoService::crear(c, &config, datos)
    })
    .await
}

/// Actualiza un mantenimiento por id
#[tauri::command]
pub async fn actualizar_mantenimiento(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: MantenimientoDatos,
) -> Cmd<Mantenimiento> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "actualizar_mantenimiento", move |c| {
        MantenimientoService::actualizar(c, &config, id, datos)
    })
    .await
}

/// Elimina un mantenimiento
#[tauri::command]
pub async fn eliminar_mantenimiento(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<()> {
    let sesion = require_eliminacion(&state, &session_id)?;
    let username = sesion.username;
    en_blocking(&state, "eliminar_mantenimiento", move |c| {
        MantenimientoService::eliminar(c, id, &username).map(|_| ())
    })
    .await
}

/// Totales general, por placa y por tipo
#[tauri::command]
pub async fn totales_mantenimiento(
    state: State<'_, AppState>,
    session_id: String,
) -> Cmd<TotalesMantenimiento> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "totales_mantenimiento", |c| {
        MantenimientoService::totales(c)
    })
    .await
}

/// Alertas por kilometraje (cambio de aceite y frenos próximos o vencidos)
#[tauri::command]
pub async fn alertas_km_mantenimiento(
    state: State<'_, AppState>,
    session_id: String,
) -> Cmd<Vec<AlertaKm>> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "alertas_km_mantenimiento", move |c| {
        MantenimientoService::alertas_km(c, &config)
    })
    .await
}
