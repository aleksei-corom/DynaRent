//! commands/ — Wrappers #[tauri::command] (thin: validan sesión/RBAC, llaman servicio, mapean error)

pub mod app;
pub mod auditoria;
pub mod auth;
pub mod auto;
pub mod backup;
pub mod business;
pub mod cliente;
pub mod comparendo;
pub mod dashboard;
pub mod empresa;
pub mod gasto;
pub mod informe;
pub mod logs;
pub mod mantenimiento;
pub mod pii;
pub mod renta;
pub mod reserva;
pub mod simit;
pub mod usuario;

use crate::core::error::{AppError, ErrorPayload};
use crate::core::rbac::SessionData;
use crate::core::PooledConnection;
use crate::services::AppState;

/// Requiere sesión activa y devuelve los datos de la sesión.
///
/// Enforce backend del cambio obligatorio de contraseña: mientras
/// `debe_cambiar_password` esté activo, ningún comando de negocio pasa por
/// aquí. Solo funcionan los comandos que validan sesión por su cuenta
/// (login, logout, change_password, get_session, obtener/guardar tema) y los
/// de app (versión/salud/cierre). Así `admin/admin123` no puede operar el ERP
/// aunque el frontend omita el redirect a /cambiar-password. Tras un cambio
/// de contraseña exitoso, `AuthService::cambiar_password` limpia el flag en
/// las sesiones en memoria del usuario (SessionStore::marcar_cambio_password_hecho).
pub fn require_session(state: &AppState, session_id: &str) -> Result<SessionData, ErrorPayload> {
    let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    let data = crate::core::rbac::require_active_session(&mut sessions, session_id)
        .map_err(|e| e.to_payload())?;
    if data.debe_cambiar_password {
        return Err(
            AppError::Business("Debe cambiar su contraseña antes de continuar.".into())
                .to_payload(),
        );
    }
    Ok(data)
}

/// Corre una operación de BD (Firebird es bloqueante) en
/// `tauri::async_runtime::spawn_blocking` para no congelar el event loop de
/// Tauri durante la consulta (TAREA 3.4 / Bloque 3 — Performance, patrón de
/// `listar_rentas`). Los comandos sync de Tauri corren en el main thread: un
/// `LIKE` que escanea la tabla o una transacción de pago retendría la UI.
///
/// `f` recibe una conexión del pool (obtenida DENTRO del hilo blocking) y
/// devuelve el resultado del servicio. `tarea` nombra la operación en el
/// error de join (p. ej. «La tarea crear_renta falló: …»).
pub async fn en_blocking<T, F>(state: &AppState, tarea: &str, f: F) -> Result<T, ErrorPayload>
where
    T: Send + 'static,
    F: FnOnce(&mut PooledConnection) -> Result<T, AppError> + Send + 'static,
{
    let pool = state.pool.clone();
    let tarea = tarea.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let mut c = pool.get().map_err(AppError::from)?;
        f(&mut c)
    })
    .await
    .map_err(|e| AppError::Generic(format!("La tarea {tarea} falló: {e}")).to_payload())?
    .map_err(|e| e.to_payload())
}

/// Requiere sesión activa con rol de administración de usuarios
/// (roles_con_usuarios en config.ini — por defecto solo Administrador).
pub fn require_usuario_admin(
    state: &AppState,
    session_id: &str,
) -> Result<SessionData, ErrorPayload> {
    let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    // Fallback: si config.ini no define roles_con_usuarios, solo Administrador
    let roles: Vec<&str> = if state.config.roles_con_usuarios.is_empty() {
        vec!["Administrador"]
    } else {
        state
            .config
            .roles_con_usuarios
            .iter()
            .map(|s| s.as_str())
            .collect()
    };
    crate::core::rbac::require_role(&mut sessions, session_id, &roles).map_err(|e| e.to_payload())
}

/// Requiere sesión activa con rol habilitado para informes
/// (roles_con_informes en config.ini — por defecto solo Administrador).
pub fn require_informes(state: &AppState, session_id: &str) -> Result<SessionData, ErrorPayload> {
    let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    // Fallback: si config.ini no define roles_con_informes, solo Admin
    let roles: Vec<&str> = if state.config.roles_con_informes.is_empty() {
        vec!["Administrador"]
    } else {
        state
            .config
            .roles_con_informes
            .iter()
            .map(|s| s.as_str())
            .collect()
    };
    crate::core::rbac::require_role(&mut sessions, session_id, &roles).map_err(|e| e.to_payload())
}

/// Requiere sesión activa con rol habilitado para eliminar registros
/// (roles_con_eliminar en config.ini — por defecto Administrador y Supervisor).
pub fn require_eliminacion(
    state: &AppState,
    session_id: &str,
) -> Result<SessionData, ErrorPayload> {
    let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
    // Fallback: si config.ini no define roles_con_eliminar, Admin + Supervisor
    let roles: Vec<&str> = if state.config.roles_con_eliminar.is_empty() {
        vec!["Administrador", "Supervisor"]
    } else {
        state
            .config
            .roles_con_eliminar
            .iter()
            .map(|s| s.as_str())
            .collect()
    };
    crate::core::rbac::require_role(&mut sessions, session_id, &roles).map_err(|e| e.to_payload())
}

/// Obtiene una conexión del pool
pub fn conn(state: &AppState) -> Result<PooledConnection, ErrorPayload> {
    state.pool.get().map_err(|e| AppError::from(e).to_payload())
}
