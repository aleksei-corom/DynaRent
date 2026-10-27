//! commands/pii.rs — Comandos de gestión de la clave PII (db_encryption_key)
//!
//! Solo administradores (roles_con_usuarios): consultar estado, probar una
//! clave candidata, guardarla y eliminarla.
//!
//! Todos `async` + `en_blocking` (H-3): `analizar` escanea la tabla completa
//! de clientes y descifra cada registro legacy — la lectura más pesada de la
//! app, que no puede retener el main thread de Tauri.

use crate::core::error::ErrorPayload;
use crate::services::pii::{ClaveGuardada, PiiAnalisis, PiiService};
use crate::services::AppState;
use tauri::State;

use super::{en_blocking, require_usuario_admin};

type Cmd<T> = Result<T, ErrorPayload>;

/// Estado actual del descifrado PII (clave configurada, clientes legacy, etc.)
#[tauri::command]
pub async fn get_pii_status(state: State<'_, AppState>, session_id: String) -> Cmd<PiiAnalisis> {
    require_usuario_admin(&state, &session_id)?;
    let clave = state.pii_key();
    en_blocking(&state, "get_pii_status", move |c| {
        PiiService::estado(c, &clave)
    })
    .await
}

/// Prueba una clave candidata SIN guardarla (muestra cuántos clientes descifra)
#[tauri::command]
pub async fn probar_clave_pii(
    state: State<'_, AppState>,
    session_id: String,
    clave: String,
) -> Cmd<PiiAnalisis> {
    require_usuario_admin(&state, &session_id)?;
    en_blocking(&state, "probar_clave_pii", move |c| {
        PiiService::probar_clave(c, &clave)
    })
    .await
}

/// Guarda la clave en config.ini y la aplica en caliente
#[tauri::command]
pub async fn guardar_clave_pii(
    state: State<'_, AppState>,
    session_id: String,
    clave: String,
) -> Cmd<ClaveGuardada> {
    require_usuario_admin(&state, &session_id)?;
    // Persistir + aplicar en caliente es una escritura pequeña (config.ini +
    // mutex) y se hace fuera del hilo blocking; el análisis pesado va dentro.
    PiiService::aplicar_clave(&state, &clave).map_err(|e| e.to_payload())?;
    en_blocking(&state, "guardar_clave_pii", move |c| {
        PiiService::estado(c, &clave)
    })
    .await
    .map(|analisis| ClaveGuardada {
        clave_configurada: true,
        analisis,
    })
}

/// Elimina la clave configurada (vuelve a ocultar los datos Fernet)
#[tauri::command]
pub async fn eliminar_clave_pii(
    state: State<'_, AppState>,
    session_id: String,
) -> Cmd<ClaveGuardada> {
    require_usuario_admin(&state, &session_id)?;
    PiiService::quitar_clave(&state).map_err(|e| e.to_payload())?;
    en_blocking(&state, "eliminar_clave_pii", |c| PiiService::estado(c, ""))
        .await
        .map(|analisis| ClaveGuardada {
            clave_configurada: false,
            analisis,
        })
}
