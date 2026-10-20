//! commands/gasto.rs — Comandos Tauri del módulo de gastos (thin wrappers)

use crate::core::error::ErrorPayload;
use crate::repositories::gasto::{Gasto, GastoDatos};
use crate::services::gasto::{GastoService, TotalesGastos};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_eliminacion, require_session};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista gastos con filtros opcionales (búsqueda, placa o categoría).
///
/// `async` + `en_blocking` (TAREA 3.4): filtros LIKE que pueden escanear la
/// tabla completa.
#[tauri::command]
pub async fn listar_gastos(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
    placa: Option<String>,
    categoria: Option<String>,
) -> Cmd<Vec<Gasto>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "listar_gastos", move |c| {
        GastoService::listar(
            c,
            busqueda.as_deref(),
            placa.as_deref(),
            categoria.as_deref(),
        )
    })
    .await
}

/// Gastos recientes (para el inicio o un panel)
#[tauri::command]
pub async fn gastos_recientes(
    state: State<'_, AppState>,
    session_id: String,
    limit: Option<i64>,
) -> Cmd<Vec<Gasto>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "gastos_recientes", move |c| {
        GastoService::recientes(c, limit.unwrap_or(10))
    })
    .await
}

/// Obtiene un gasto por id
#[tauri::command]
pub async fn obtener_gasto(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<Gasto> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "obtener_gasto", move |c| GastoService::obtener(c, id)).await
}

/// Crea un gasto (registra al usuario de la sesión como autor)
#[tauri::command]
pub async fn crear_gasto(
    state: State<'_, AppState>,
    session_id: String,
    datos: GastoDatos,
) -> Cmd<Gasto> {
    let session = require_session(&state, &session_id)?;
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "crear_gasto", move |c| {
        GastoService::crear(c, &config, &username, datos)
    })
    .await
}

/// Actualiza un gasto por id
#[tauri::command]
pub async fn actualizar_gasto(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: GastoDatos,
) -> Cmd<Gasto> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "actualizar_gasto", move |c| {
        GastoService::actualizar(c, &config, id, datos)
    })
    .await
}

/// Elimina un gasto
#[tauri::command]
pub async fn eliminar_gasto(state: State<'_, AppState>, session_id: String, id: i64) -> Cmd<()> {
    require_eliminacion(&state, &session_id)?;
    en_blocking(&state, "eliminar_gasto", move |c| {
        GastoService::eliminar(c, id).map(|_| ())
    })
    .await
}

/// Totales general, por placa y por categoría
#[tauri::command]
pub async fn totales_gastos(state: State<'_, AppState>, session_id: String) -> Cmd<TotalesGastos> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "totales_gastos", GastoService::totales).await
}
