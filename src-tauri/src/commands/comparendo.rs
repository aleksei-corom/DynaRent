//! commands/comparendo.rs — Comandos Tauri del módulo de comparendos (thin wrappers)

use crate::core::error::ErrorPayload;
use crate::repositories::comparendo::{Comparendo, ComparendoDatos};
use crate::services::comparendo::{ComparendoService, TotalesComparendos};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_eliminacion, require_session};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista comparendos con filtros opcionales (búsqueda, placa, estado o
/// «no confirmados por SIMIT»).
///
/// `async` + `en_blocking` (TAREA 3.4): filtros LIKE que pueden escanear la
/// tabla completa.
#[tauri::command]
pub async fn listar_comparendos(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
    placa: Option<String>,
    estado: Option<String>,
    no_confirmados: Option<bool>,
) -> Cmd<Vec<Comparendo>> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "listar_comparendos", move |c| {
        ComparendoService::listar(
            c,
            busqueda.as_deref(),
            placa.as_deref(),
            estado.as_deref(),
            no_confirmados.unwrap_or(false),
        )
    })
    .await
}

/// Obtiene un comparendo por id
#[tauri::command]
pub async fn obtener_comparendo(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<Comparendo> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "obtener_comparendo", move |c| {
        ComparendoService::obtener(c, id)
    })
    .await
}

/// Crea un comparendo
#[tauri::command]
pub async fn crear_comparendo(
    state: State<'_, AppState>,
    session_id: String,
    datos: ComparendoDatos,
) -> Cmd<Comparendo> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "crear_comparendo", move |c| {
        ComparendoService::crear(c, &config, datos)
    })
    .await
}

/// Actualiza un comparendo por id
#[tauri::command]
pub async fn actualizar_comparendo(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: ComparendoDatos,
) -> Cmd<Comparendo> {
    require_session(&state, &session_id)?;
    let config = state.config.clone();
    en_blocking(&state, "actualizar_comparendo", move |c| {
        ComparendoService::actualizar(c, &config, id, datos)
    })
    .await
}

/// Marca un comparendo como pagado
#[tauri::command]
pub async fn marcar_pagado_comparendo(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<Comparendo> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "marcar_pagado_comparendo", move |c| {
        ComparendoService::marcar_pagado(c, id)
    })
    .await
}

/// Elimina un comparendo
#[tauri::command]
pub async fn eliminar_comparendo(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<()> {
    require_eliminacion(&state, &session_id)?;
    en_blocking(&state, "eliminar_comparendo", move |c| {
        ComparendoService::eliminar(c, id).map(|_| ())
    })
    .await
}

/// Totales general, pendiente, por placa y por estado
#[tauri::command]
pub async fn totales_comparendos(
    state: State<'_, AppState>,
    session_id: String,
) -> Cmd<TotalesComparendos> {
    require_session(&state, &session_id)?;
    en_blocking(&state, "totales_comparendos", ComparendoService::totales).await
}
