//! services/auth.rs — Autenticación (puerto de auth_service.py)
//!
//! Flujo de login:
//!   1. Verifica bloqueo de cuenta (5 intentos fallidos → 30 min)
//!   2. Verifica rate limiting por IP (20/min) y por usuario (10/5min)
//!   3. Verifica credenciales (Argon2id o PBKDF2 legacy)
//!   4. Si legacy → re-hash a Argon2id (write-back)
//!   5. Crea sesión en memoria y registra acceso

use std::sync::{Arc, Mutex};

use crate::core::config::AppConfig;
use crate::core::error::AppError;
use crate::core::rbac::SessionStore;
use crate::core::security::{self, LoginAttemptTracker, VerifyResult};
use crate::core::Pool;
use crate::repositories::usuario::UsuarioRepository;

use serde::Serialize;

/// Estado compartido por la app (registrado en tauri::Builder::manage)
pub struct AppState {
    pub pool: Pool,
    pub sessions: std::sync::Arc<Mutex<SessionStore>>,
    pub login_tracker: Mutex<LoginAttemptTracker>,
    pub config: Arc<AppConfig>,
    /// Clave PII en caliente (puede configurarse desde la UI sin reiniciar).
    /// Se inicializa con `config.db_encryption_key` y se actualiza con el
    /// diálogo de configuración (commands/pii.rs).
    pub pii_key: Mutex<String>,
}

impl AppState {
    /// Clave PII efectiva (override de la UI o config.ini)
    pub fn pii_key(&self) -> String {
        self.pii_key
            .lock()
            .unwrap_or_else(|p| p.into_inner())
            .clone()
    }

    /// ¿Hay clave PII configurada (no vacía)?
    pub fn pii_key_configurada(&self) -> bool {
        !self.pii_key().trim().is_empty()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResult {
    pub success: bool,
    pub session_id: String,
    pub username: String,
    pub nombre: Option<String>,
    pub rol: Option<String>,
    pub debe_cambiar_password: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStatus {
    pub is_locked: bool,
    pub lockout_remaining_seconds: u64,
    pub failed_attempts: u32,
    pub remaining_attempts: u32,
}

/// Resultado de la fase de verificación del login: el veredicto de la
/// credencial y, si era hash legacy PBKDF2, el re-hash Argon2id ya
/// calculado (ambas operaciones de CPU corren en el mismo hilo blocking).
pub type VerificacionLogin = (VerifyResult, Option<String>);

/// Estado del login entre fases (checks → verify → finish). La conexión
/// viaja aquí porque `login_finish` persiste intentos/accesos y audita;
/// el hash va aparte (owned) para que `login_verify` pueda ejecutarse en
/// `spawn_blocking` sin locks ni referencias al estado.
pub struct LoginPendiente {
    pub conn: crate::core::PooledConnection,
    pub hash: String,
    pub id: i64,
    pub nombre: Option<String>,
    pub rol: Option<String>,
    pub debe_cambiar_password: bool,
}

pub struct AuthService;

impl AuthService {
    /// Fase 1 del login: validación, bloqueo, rate-limit y fetch del usuario.
    /// No toca CPU costosa: es la fase previa a la verificación Argon2id.
    pub fn login_checks(
        state: &AppState,
        username: &str,
        ip: Option<&str>,
    ) -> Result<LoginPendiente, AppError> {
        if username.trim().is_empty() {
            tracing::warn!("Login rechazado: username vacío");
            return Err(AppError::InvalidCredentials);
        }

        // 1) Cuenta bloqueada
        {
            let mut tracker = state
                .login_tracker
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            if tracker.is_locked(username) {
                let remaining = tracker.get_lockout_remaining_seconds(username);
                let minutes = remaining / 60;
                log::warn!("Intento de login en cuenta bloqueada: {username} (restan {minutes}m)");
                return Err(AppError::AccountLocked {
                    remaining_seconds: remaining,
                });
            }

            // 2) Rate limiting por IP y usuario
            if tracker.check_rate_limit(username, ip) {
                log::warn!(
                    "Rate limit excedido: usuario={username} ip={}",
                    ip.unwrap_or("-")
                );
                return Err(AppError::RateLimited);
            }
        }

        // 3) Fetch del usuario (anti-enumeración: el inexistente registra
        //    intento fallido igual que el de contraseña mala)
        let mut conn = state.pool.get()?;
        let usuario = UsuarioRepository::obtener_para_autenticacion(&mut conn, username)?;
        let Some(usuario) = usuario else {
            let mut tracker = state
                .login_tracker
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            let attempts = tracker.record_failed_attempt(username, ip);
            let remaining = tracker.get_remaining_attempts(username);
            log::warn!("Login fallido (usuario inexistente): {username}");
            crate::core::audit::log_audit(
                &mut conn,
                username,
                "LOGIN FALLIDO",
                &format!("usuario={username}, intentos={attempts}, restantes={remaining}"),
                ip.unwrap_or("desconocida"),
            )?;
            if attempts >= 5 {
                tracker.lock_account(username);
                log::warn!("CUENTA BLOQUEADA: {username}");
                return Err(AppError::AccountLocked {
                    remaining_seconds: 0,
                });
            }
            return Err(AppError::InvalidCredentials);
        };

        if !usuario.activo {
            return Err(AppError::InvalidCredentials);
        }

        Ok(LoginPendiente {
            hash: usuario.password,
            id: usuario.id,
            nombre: usuario.nombre,
            rol: usuario.rol,
            debe_cambiar_password: usuario.debe_cambiar_password,
            conn,
        })
    }

    /// Fase 2 del login: verificación de la credencial (Argon2id o PBKDF2
    /// legacy) y, en el caso legacy, el re-hash a Argon2id. CPU pura, sin
    /// locks ni BD: corre en `spawn_blocking` desde el comando Tauri.
    pub fn login_verify(hash: &str, password: &str) -> Result<VerificacionLogin, AppError> {
        match security::verify_password(hash, password) {
            VerifyResult::Valid => Ok((VerifyResult::Valid, None)),
            VerifyResult::ValidNeedsRehash => {
                let new_hash = security::hash_password(password)?;
                Ok((VerifyResult::ValidNeedsRehash, Some(new_hash)))
            }
            VerifyResult::Invalid => Ok((VerifyResult::Invalid, None)),
        }
    }

    /// Fase 3 del login: aplica el veredicto — sesión + auditoría si es
    /// válido (con re-hash legacy si aplica) o contabilidad de intento
    /// fallido si no.
    pub fn login_finish(
        state: &AppState,
        pendiente: LoginPendiente,
        username: &str,
        verif: VerificacionLogin,
        ip: Option<&str>,
    ) -> Result<LoginResult, AppError> {
        let mut conn = pendiente.conn;
        match verif {
            (VerifyResult::Valid, _) => Self::finish_login(
                state,
                conn,
                pendiente.id,
                username,
                pendiente.nombre.as_deref(),
                pendiente.rol.as_deref(),
                pendiente.debe_cambiar_password,
                ip,
                None,
            ),
            (VerifyResult::ValidNeedsRehash, Some(new_hash)) => {
                UsuarioRepository::actualizar_password(&mut conn, username, &new_hash)?;
                log::info!("Re-hash Argon2id aplicado para: {username}");
                Self::finish_login(
                    state,
                    conn,
                    pendiente.id,
                    username,
                    pendiente.nombre.as_deref(),
                    pendiente.rol.as_deref(),
                    pendiente.debe_cambiar_password,
                    ip,
                    Some(&new_hash),
                )
            }
            (VerifyResult::ValidNeedsRehash, None) | (VerifyResult::Invalid, _) => {
                // Contraseña incorrecta (el re-hash sin hash nuevo es
                // inalcanzable: login_verify solo lo omite en error).
                let mut tracker = state
                    .login_tracker
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                let attempts = tracker.record_failed_attempt(username, ip);
                let remaining = tracker.get_remaining_attempts(username);
                // Persistir contador en BD
                let _ = UsuarioRepository::persistir_intentos(&mut conn, username, attempts as i64);
                log::warn!(
                    "Login fallido: {username} (intentos={attempts}, restantes={remaining})"
                );
                crate::core::audit::log_audit(
                    &mut conn,
                    username,
                    "LOGIN FALLIDO",
                    &format!("usuario={username}, intentos={attempts}, restantes={remaining}"),
                    ip.unwrap_or("desconocida"),
                )?;
                if attempts >= 5 {
                    tracker.lock_account(username);
                    log::warn!("CUENTA BLOQUEADA: {username}");
                    return Err(AppError::AccountLocked {
                        remaining_seconds: 0,
                    });
                }
                Err(AppError::InvalidCredentials)
            }
        }
    }

    /// Login completo (composición síncrona de las 3 fases).
    ///
    /// El comando Tauri usa las fases por separado para correr la
    /// verificación Argon2id (CPU costosa) en `spawn_blocking`; esta
    /// composición es la que usan los tests de integración y el camino
    /// sin Tauri (verificar_instalacion_limpia, sync_dev).
    pub fn login(
        state: &AppState,
        username: &str,
        password: &str,
        ip: Option<&str>,
    ) -> Result<LoginResult, AppError> {
        // ── Span de tracing (Bloque 4 / TAREA 4.1) ──
        // El login concentra los eventos de seguridad más relevantes (cuenta
        // bloqueada, rate-limit, rehash legacy, login OK/fallido). El span
        // etiqueta todos los `tracing::info!`/`warn!` con el username y la IP
        // para correlacionar con los registros de `auditoria`.
        // Nota: el password NUNCA se loguea (ni siquiera en debug).
        let span = tracing::info_span!("login", username = %username, ip = ?ip);
        let _enter = span.enter();

        if password.is_empty() {
            tracing::warn!("Login rechazado: password vacío");
            return Err(AppError::InvalidCredentials);
        }
        let pendiente = Self::login_checks(state, username, ip)?;
        let verif = Self::login_verify(&pendiente.hash, password)?;
        Self::login_finish(state, pendiente, username, verif, ip)
    }

    #[allow(clippy::too_many_arguments, clippy::type_complexity)]
    fn finish_login(
        state: &AppState,
        mut conn: crate::core::PooledConnection,
        user_id: i64,
        username: &str,
        nombre: Option<&str>,
        rol: Option<&str>,
        debe_cambiar: bool,
        ip: Option<&str>,
        _new_hash: Option<&str>,
    ) -> Result<LoginResult, AppError> {
        // Resetear intentos
        {
            let mut tracker = state
                .login_tracker
                .lock()
                .unwrap_or_else(|e| e.into_inner());
            tracker.reset_attempts(username);
        }
        let _ = UsuarioRepository::persistir_intentos(&mut conn, username, 0);
        let _ = UsuarioRepository::registrar_acceso(&mut conn, username);

        // Crear sesión
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        let sid = sessions.create(
            user_id,
            username,
            rol.unwrap_or("Operador"),
            nombre.unwrap_or(""),
            debe_cambiar,
        );

        log::info!(
            "Login exitoso: {username} (rol={}, ip={})",
            rol.unwrap_or("-"),
            ip.unwrap_or("-")
        );
        tracing::info!(
            rol = %rol.unwrap_or("-"),
            debe_cambiar_password = debe_cambiar,
            "Login exitoso (tracing)"
        );
        crate::core::audit::log_audit(
            &mut conn,
            username,
            "LOGIN OK",
            &format!("usuario={username}, rol={}", rol.unwrap_or("-")),
            ip.unwrap_or("desconocida"),
        )?;

        Ok(LoginResult {
            success: true,
            session_id: sid,
            username: username.to_string(),
            nombre: nombre.map(String::from),
            rol: rol.map(String::from),
            debe_cambiar_password: debe_cambiar,
        })
    }

    /// Estado de login de un usuario (intentos, bloqueo) — puerto de get_login_status
    pub fn get_login_status(state: &AppState, username: &str) -> LoginStatus {
        let mut tracker = state
            .login_tracker
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let is_locked = tracker.is_locked(username);
        LoginStatus {
            is_locked,
            lockout_remaining_seconds: tracker.get_lockout_remaining_seconds(username),
            failed_attempts: tracker.get_failed_attempts(username),
            remaining_attempts: tracker.get_remaining_attempts(username),
        }
    }

    /// Sincroniza el tracker desde la BD al iniciar la app
    pub fn sync_tracker_from_db(state: &AppState) {
        let attempts = match state.pool.get() {
            Ok(mut conn) => {
                UsuarioRepository::obtener_intentos_pendientes(&mut conn).unwrap_or_default()
            }
            Err(_) => std::collections::HashMap::new(),
        };
        let mut tracker = state
            .login_tracker
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        tracker.sync_from_db(attempts);
    }

    /// Cierra sesión
    pub fn logout(state: &AppState, session_id: &str) {
        state
            .sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .destroy(session_id);
    }

    /// Cambio de contraseña (obligatorio tras primer login o por solicitud)
    ///
    /// Toma la conexión y el almacén de sesiones por parámetro para que el
    /// comando pueda correrla en `spawn_blocking` (H-3): la verificación y
    /// el re-hash Argon2id son deliberadamente costosos (~100-500 ms) y no
    /// deben congelar la ventana mientras corren.
    pub fn cambiar_password(
        conn: &mut crate::core::PooledConnection,
        sessions: &Arc<Mutex<SessionStore>>,
        username: &str,
        current_password: &str,
        new_password: &str,
    ) -> Result<(), AppError> {
        if username.trim().is_empty() || current_password.is_empty() || new_password.is_empty() {
            return Err(AppError::Validation(
                "Todos los campos son obligatorios.".into(),
            ));
        }
        if current_password == new_password {
            return Err(AppError::Validation(
                "La nueva contraseña debe ser diferente a la actual.".into(),
            ));
        }
        // Fortaleza
        let errors = crate::core::validators::validate_password_strength(new_password);
        if !errors.is_empty() {
            return Err(AppError::Validation(errors.join("; ")));
        }

        let usuario = UsuarioRepository::obtener_para_autenticacion(conn, username)?;
        let Some(usuario) = usuario else {
            return Err(AppError::InvalidCredentials);
        };

        // Verificar contraseña actual (Argon2id o legacy)
        if !matches!(
            security::verify_password(&usuario.password, current_password),
            VerifyResult::Valid | VerifyResult::ValidNeedsRehash
        ) {
            log::warn!("Cambio de contraseña con actual incorrecta: {username}");
            crate::core::audit::log_audit(
                conn,
                username,
                "CAMBIO CONTRASEÑA FALLIDO",
                "contraseña actual incorrecta",
                "local",
            )?;
            return Err(AppError::Validation(
                "La contraseña actual no es correcta.".into(),
            ));
        }

        let new_hash = security::hash_password(new_password)?;
        UsuarioRepository::actualizar_password(conn, username, &new_hash)?;
        // Reflejar el cambio en caliente en las sesiones en memoria del
        // usuario: el frontend conserva el mismo session_id tras cambiar la
        // contraseña, y `require_session` bloquea los comandos de negocio
        // mientras `debe_cambiar_password` siga activo.
        sessions
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .marcar_cambio_password_hecho(username);
        crate::core::audit::log_audit(
            conn,
            username,
            "CAMBIO CONTRASEÑA",
            "contraseña actualizada",
            "local",
        )?;
        Ok(())
    }

    /// Desbloquea una cuenta manualmente (solo administradores)
    pub fn unlock_account(state: &AppState, username: &str) -> Result<bool, AppError> {
        let mut conn = state.pool.get()?;
        let _ = UsuarioRepository::reset_intentos(&mut conn, username);
        let mut tracker = state
            .login_tracker
            .lock()
            .unwrap_or_else(|e| e.into_inner());
        let was_locked = tracker.is_locked(username);
        tracker.reset_attempts(username);
        if was_locked {
            crate::core::audit::log_audit(
                &mut conn,
                username,
                "CUENTA DESBLOQUEADA",
                "desbloqueo manual por administrador",
                "local",
            )?;
            log::info!("Cuenta desbloqueada manualmente: {username}");
        }
        Ok(was_locked)
    }
}
