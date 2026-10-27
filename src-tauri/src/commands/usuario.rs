//! commands/usuario.rs — Comandos Tauri del módulo de usuarios (thin wrappers).
//!
//! Todos los comandos requieren rol de administración de usuarios
//! (`roles_con_usuarios` de config.ini — por defecto: Administrador).

use crate::core::error::ErrorPayload;
use crate::repositories::usuario::Usuario;
use crate::services::auth::AuthService;
use crate::services::usuario::{
    UsuarioConCambio, UsuarioDatos, UsuarioDatosActualizar, UsuarioService,
};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_usuario_admin};

type Cmd<T> = Result<T, ErrorPayload>;

/// Lista usuarios (búsqueda opcional por username, nombre o rol)
///
/// `async` + `en_blocking` (TAREA 3.4): el filtro LIKE puede escanear la tabla.
#[tauri::command]
pub async fn listar_usuarios(
    state: State<'_, AppState>,
    session_id: String,
    busqueda: Option<String>,
) -> Cmd<Vec<Usuario>> {
    require_usuario_admin(&state, &session_id)?;
    en_blocking(&state, "listar_usuarios", move |c| {
        UsuarioService::listar(c, busqueda.as_deref())
    })
    .await
}

/// Crea un usuario con contraseña inicial (opción: cambio obligatorio en primer login)
#[tauri::command]
pub async fn crear_usuario(
    state: State<'_, AppState>,
    session_id: String,
    datos: UsuarioDatos,
) -> Cmd<Usuario> {
    let session = require_usuario_admin(&state, &session_id)?;
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "crear_usuario", move |c| {
        UsuarioService::crear(c, &config, &username, datos)
    })
    .await
}

/// Actualiza nombre, rol, email y estado activo de un usuario
#[tauri::command]
pub async fn actualizar_usuario(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    datos: UsuarioDatosActualizar,
) -> Cmd<Usuario> {
    let session = require_usuario_admin(&state, &session_id)?;
    let config = state.config.clone();
    let username = session.username;
    en_blocking(&state, "actualizar_usuario", move |c| {
        UsuarioService::actualizar(c, &config, &username, id, datos)
    })
    .await
}

/// Elimina un usuario (protege la propia cuenta y al último administrador)
#[tauri::command]
pub async fn eliminar_usuario(state: State<'_, AppState>, session_id: String, id: i64) -> Cmd<()> {
    let session = require_usuario_admin(&state, &session_id)?;
    let username = session.username;
    en_blocking(&state, "eliminar_usuario", move |c| {
        UsuarioService::eliminar(c, &username, id).map(|_| ())
    })
    .await
}

/// Fuerza el cambio de contraseña: aplica la nueva y marca cambio obligatorio en el próximo login
#[tauri::command]
pub async fn forzar_cambio_password_usuario(
    state: State<'_, AppState>,
    session_id: String,
    id: i64,
    nueva_password: String,
) -> Cmd<UsuarioConCambio> {
    let session = require_usuario_admin(&state, &session_id)?;
    let username = session.username;
    en_blocking(&state, "forzar_cambio_password_usuario", move |c| {
        UsuarioService::forzar_cambio_password(c, &username, id, &nueva_password)
    })
    .await
}

/// Desbloquea una cuenta (resetea intentos fallidos en BD y en el tracker de sesiones)
///
/// Se queda sync: además de la BD toca `login_tracker` (Mutex no clonable de
/// `AppState`, no puede moverse al hilo blocking) y es una operación puntual
/// de admin sobre un UPDATE por PK.
#[tauri::command]
pub fn desbloquear_usuario(
    state: State<'_, AppState>,
    session_id: String,
    username: String,
) -> Cmd<bool> {
    require_usuario_admin(&state, &session_id)?;
    AuthService::unlock_account(&state, &username).map_err(|e| e.to_payload())
}
