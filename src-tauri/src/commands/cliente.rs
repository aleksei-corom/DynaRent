//! commands/cliente.rs — Comandos Tauri del módulo de clientes (thin wrappers)

use crate::core::crypto::PiiCipher;
use crate::core::error::ErrorPayload;
use crate::repositories::cliente::ClienteDatos;
use crate::services::cliente::{ClienteConPii, ClienteService};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_eliminacion, require_session};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista clientes con filtros opcionales (búsqueda o estado).
///
/// `async` + `en_blocking` (TAREA 3.4): el filtro de búsqueda hace `LIKE`
/// sobre columnas cifradas/calculadas que puede escanear la tabla completa.
#[tauri::command]
pub async fn listar_clientes(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
    estado: Option<String>,
) -> Cmd<Vec<ClienteConPii>> {
    require_session(&state, &session_id)?;
    let pii_key = state.pii_key();
    en_blocking(&state, "listar_clientes", move |c| {
        let cipher = PiiCipher::new(&pii_key);
        ClienteService::listar(c, &cipher, busqueda.as_deref(), estado.as_deref())
    })
    .await
}

/// Obtiene un cliente por id
#[tauri::command]
pub async fn obtener_cliente(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
) -> Cmd<ClienteConPii> {
    require_session(&state, &session_id)?;
    let pii_key = state.pii_key();
    en_blocking(&state, "obtener_cliente", move |c| {
        let cipher = PiiCipher::new(&pii_key);
        ClienteService::obtener(c, &cipher, id)
    })
    .await
}

/// Crea un cliente
#[tauri::command]
pub async fn crear_cliente(
    state: State<'_, AppState>,
    session_id: String,
    datos: ClienteDatos,
) -> Cmd<ClienteConPii> {
    let session = require_session(&state, &session_id)?;
    let pii_key = state.pii_key();
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "crear_cliente", move |c| {
        let cipher = PiiCipher::new(&pii_key);
        ClienteService::crear(c, &config, &cipher, &username, datos)
    })
    .await
}

/// Actualiza un cliente por id
#[tauri::command]
pub async fn actualizar_cliente(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: ClienteDatos,
) -> Cmd<ClienteConPii> {
    let session = require_session(&state, &session_id)?;
    let pii_key = state.pii_key();
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "actualizar_cliente", move |c| {
        let cipher = PiiCipher::new(&pii_key);
        ClienteService::actualizar(c, &config, &cipher, &username, id, datos)
    })
    .await
}

/// Elimina un cliente por id
#[tauri::command]
pub async fn eliminar_cliente(state: State<'_, AppState>, session_id: String, id: i64) -> Cmd<()> {
    let session = require_eliminacion(&state, &session_id)?;
    let username = session.username;
    en_blocking(&state, "eliminar_cliente", move |c| {
        ClienteService::eliminar(c, &username, id).map(|_| ())
    })
    .await
}
