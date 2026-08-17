//! commands/empresa.rs — Configuración de la empresa (setup inicial)
//!
//! - `empresa_publica` (sin sesión): nombre + logo para el login y el menú lateral.
//! - `obtener_empresa` (sesión): configuración completa para la página /empresa
//!   y las impresiones (ContratoRenta, OrdenRenta, OrdenReserva, OrdenComparendo).
//! - `guardar_empresa` (rol de administración): persiste datos + logo.

use crate::core::error::ErrorPayload;
use crate::repositories::empresa::{EmpresaConfig, EmpresaConfigDatos};
use crate::services::empresa::EmpresaService;
use crate::services::AppState;
use tauri::State;

use super::{conn, require_session, require_usuario_admin};

type Cmd<T> = Result<T, ErrorPayload>;

/// Configuración pública (login / menú lateral): solo nombre + logo, sin sesión.
#[tauri::command]
pub fn empresa_publica(state: State<'_, AppState>) -> Cmd<EmpresaConfig> {
    let mut c = conn(&state)?;
    EmpresaService::publica(&mut c, &state.config.data_dir).map_err(|e| e.to_payload())
}

/// Configuración completa de la empresa (requiere sesión activa).
#[tauri::command]
pub fn obtener_empresa(state: State<'_, AppState>, session_id: String) -> Cmd<EmpresaConfig> {
    require_session(&state, &session_id)?;
    let mut c = conn(&state)?;
    EmpresaService::obtener(&mut c, &state.config.data_dir).map_err(|e| e.to_payload())
}

/// ¿El setup inicial ya se completó? (requiere sesión activa).
///
/// El layout lo consulta tras el login: si es `false` y el usuario es
/// Administrador, se redirige a /empresa para ingresar los datos de la
/// empresa (nombre, dirección, teléfonos, logo). `guardar_empresa` marca el
/// flag en config.ini al persistir los datos.
#[tauri::command]
pub fn setup_estado(state: State<'_, AppState>, session_id: String) -> Cmd<bool> {
    require_session(&state, &session_id)?;
    // Lee el flag persistido (no el de memoria): así `guardar_empresa` marca
    // el setup y la siguiente consulta ya devuelve `true` en la misma sesión.
    Ok(state.config.setup_completado_persistido())
}

/// Guarda los datos de la empresa (rol de administración de usuarios).
/// Al persistir marca el setup inicial como completado (config.ini).
#[tauri::command]
pub fn guardar_empresa(
    state: State<'_, AppState>,
    session_id: String,
    datos: EmpresaConfigDatos,
) -> Cmd<EmpresaConfig> {
    let sesion = require_usuario_admin(&state, &session_id)?;
    let mut c = conn(&state)?;
    let cfg = EmpresaService::guardar(&mut c, &state.config.data_dir, datos, &sesion.username)
        .map_err(|e| e.to_payload())?;
    // Best-effort: si la persistencia del flag falla (p. ej. config.ini en
    // uso), la app sigue funcionando — solo se re-lanzaría el setup.
    if let Err(e) = state.config.persist_setup_completado() {
        log::warn!("No se pudo marcar el setup como completado: {e}");
    }
    Ok(cfg)
}
