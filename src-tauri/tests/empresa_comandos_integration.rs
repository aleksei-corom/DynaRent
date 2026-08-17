//! empresa_comandos_integration.rs — Pruebas de integración de los comandos
//! del SetUp Inicial `obtener_empresa` / `guardar_empresa` / `empresa_publica`
//! (commands/empresa.rs).
//!
//! Cubre el flujo del campo PAIS añadido en la migración 0021: roundtrip de
//! persistencia, que la vista pública NO filtre datos sensibles (país,
//! teléfono, dirección, etc.) y la validación de sesión/rol.
//!
//! Como 0021 (columna PAIS) aún no está aplicada a la BD de desarrollo, se
//! trabaja sobre una COPIA temporal del .fdb (patrón de migraciones_integration)
//! y se ejecutan las migraciones pendientes sobre la copia: la BD real nunca
//! se toca y de paso se verifica que 0021 aplica limpio sobre una BD existente.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use serial_test::serial;
use tauri::Manager;
use tauri::test::{mock_builder, mock_context, noop_assets};

use dynarent_lib::commands::empresa::{empresa_publica, guardar_empresa, obtener_empresa};
use dynarent_lib::core::config::AppConfig;
use dynarent_lib::core::db::create_pool;
use dynarent_lib::core::migrations::run_migrations;
use dynarent_lib::core::rbac::SessionStore;
use dynarent_lib::core::security::LoginAttemptTracker;
use dynarent_lib::repositories::empresa::{EmpresaConfig, EmpresaConfigDatos};
use dynarent_lib::services::empresa::EmpresaService;
use dynarent_lib::services::usuario::{UsuarioDatos, UsuarioService};
use dynarent_lib::services::AppState;

/// Guard RAII minimalista: ejecuta la clausura al salir del scope, incluso si
/// un `assert!` falla (panic-safe).
struct AlSalir<F: FnOnce()>(Option<F>);
impl<F: FnOnce()> Drop for AlSalir<F> {
    fn drop(&mut self) {
        if let Some(f) = self.0.take() {
            f();
        }
    }
}

/// Borra el .fdb temporal al salir del scope (panic-safe).
struct LimpiarTemporal(PathBuf);
impl Drop for LimpiarTemporal {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

/// Estado de la app sobre una COPIA temporal de la BD dev, con las migraciones
/// pendientes aplicadas (incluida 0021). Devuelve (AppState, guard de limpieza).
fn dev_state_copia() -> (AppState, LimpiarTemporal) {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let data_dir = manifest.join("../data");
    let resource_dir = manifest.join("resources");

    // Copia temporal de la BD de desarrollo.
    let src = data_dir.join("dynarent_v3.fdb");
    assert!(src.exists(), "BD de desarrollo no encontrada: {src:?}");
    let tmp = std::env::temp_dir().join(format!(
        "dynarent_empresa_{}.fdb",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0)
    ));
    std::fs::copy(&src, &tmp).expect("copiar .fdb a temporal");
    let limpieza = LimpiarTemporal(tmp.clone());

    let mut cfg = AppConfig::load(&data_dir, &resource_dir, &manifest);
    cfg.db_path = tmp;
    let cfg = Arc::new(cfg);
    let pool = create_pool(&cfg).expect("pool embedded");

    // Aplica las migraciones pendientes sobre la copia (0021 incluida).
    let migrations_dir = manifest.join("migrations");
    run_migrations(&pool, &migrations_dir).expect("migraciones sobre la copia");

    let state = AppState {
        pool,
        sessions: Mutex::new(SessionStore::new(3600)),
        login_tracker: Mutex::new(LoginAttemptTracker::new(5, 1800, 300, 10)),
        config: cfg.clone(),
        pii_key: Mutex::new(cfg.db_encryption_key.clone()),
    };
    (state, limpieza)
}

fn app_mock(state: AppState) -> tauri::App<tauri::test::MockRuntime> {
    mock_builder()
        .manage(state)
        .build(mock_context(noop_assets()))
        .expect("mock app")
}

/// Sufijo único por ejecución (evita colisiones entre tests paralelos)
fn uniq() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos().to_string())
        .unwrap_or_else(|_| "x".into())
}

fn datos_usuario(username: &str, rol: &str) -> UsuarioDatos {
    UsuarioDatos {
        username: username.into(),
        password: "TempPass1!".into(),
        nombre: "Usuario Empresa".into(),
        rol: rol.into(),
        email: None,
        activo: true,
        debe_cambiar_password: true,
    }
}

fn crear_sesion(state: &AppState, user_id: i64, username: &str, rol: &str) -> String {
    let mut sessions = state.sessions.lock().unwrap();
    sessions.create(user_id, username, rol, "Usuario Empresa", false)
}

#[test]
#[serial]
fn setup_inicial_roundtrip_con_pais_y_vista_publica() {
    let (state, _limpieza) = dev_state_copia();
    let cfg = &state.config;
    let mut conn = state.pool.get().expect("conn");

    // ── Configuración previa (para restaurar al salir) ──
    let previa = EmpresaService::obtener(&mut conn, &cfg.data_dir).expect("obtener previa");
    let data_dir_previa = cfg.data_dir.clone();
    let pool_previa = state.pool.clone();
    let _restaurar = AlSalir(Some(move || {
        let mut conn = pool_previa.get().expect("conn restaurar");
        let _ = EmpresaService::guardar(
            &mut conn,
            &data_dir_previa,
            EmpresaConfigDatos {
                nombre: previa.nombre,
                nit: previa.nit,
                direccion: previa.direccion,
                telefono: previa.telefono,
                email: previa.email,
                web: previa.web,
                ciudad: previa.ciudad,
                pais: previa.pais,
                logo: previa.logo,
            },
            "test",
        );
    }));

    // ── Usuario admin temporal para la sesión ──
    let suf = uniq();
    let username = format!("e{}", &suf[..suf.len().min(9)]);
    let creado =
        UsuarioService::crear(&mut conn, cfg, "admin", datos_usuario(&username, "Administrador"))
            .expect("crear usuario admin");
    let id = creado.id;
    let _limpieza_user = AlSalir(Some(move || {
        let _ = UsuarioService::eliminar(&mut conn, "admin", id);
    }));
    let sid = crear_sesion(&state, id, &username, "Administrador");

    let app = app_mock(state);
    let st = app.state::<AppState>();

    // ── 1) Sin configurar → todos los campos None ──
    let inicial = obtener_empresa(st.clone(), sid.clone()).expect("obtener inicial");
    assert_eq!(inicial.pais, None, "un equipo sin setup no tiene país");

    // ── 2) Guardar con país + teléfono → roundtrip ──
    let guardado = guardar_empresa(
        st.clone(),
        sid.clone(),
        EmpresaConfigDatos {
            nombre: Some("DynaRent Test SAS".into()),
            nit: Some("900.123.456-7".into()),
            direccion: Some("Cra 12 # 34-56".into()),
            telefono: Some("310 123 4567".into()),
            email: Some("contacto@test.com".into()),
            web: Some("www.test.com".into()),
            ciudad: Some("Bogotá".into()),
            pais: Some("Colombia".into()),
            logo: None,
        },
    )
    .expect("guardar con país");

    assert_eq!(guardado.pais.as_deref(), Some("Colombia"));
    assert_eq!(guardado.nombre.as_deref(), Some("DynaRent Test SAS"));
    assert_eq!(guardado.telefono.as_deref(), Some("310 123 4567"));

    let leido = obtener_empresa(st.clone(), sid.clone()).expect("obtener tras guardar");
    assert_eq!(leido.pais.as_deref(), Some("Colombia"), "el país persiste en la BD");

    // ── 3) Cambiar el país (p. ej. la app se usa en otro país) ──
    guardar_empresa(
        st.clone(),
        sid.clone(),
        EmpresaConfigDatos {
            nombre: Some("DynaRent Test SAS".into()),
            nit: None,
            direccion: None,
            telefono: Some("414 555 0101".into()),
            email: None,
            web: None,
            ciudad: Some("Caracas".into()),
            pais: Some("Venezuela".into()),
            logo: None,
        },
    )
    .expect("guardar con otro país");

    let leido2 = obtener_empresa(st.clone(), sid.clone()).expect("obtener tras cambio");
    assert_eq!(leido2.pais.as_deref(), Some("Venezuela"));
    assert_eq!(leido2.telefono.as_deref(), Some("414 555 0101"));
    assert_eq!(leido2.ciudad.as_deref(), Some("Caracas"));

    // ── 4) Vista pública: nombre + logo únicamente, sin país ni contacto ──
    let publica = empresa_publica(st.clone()).expect("vista pública");
    assert_eq!(publica.nombre.as_deref(), Some("DynaRent Test SAS"));
    assert_eq!(publica.pais, None, "la vista pública no expone el país");
    assert_eq!(publica.telefono, None, "la vista pública no expone el teléfono");
    assert_eq!(publica.direccion, None);
    assert_eq!(publica.nit, None);
    assert_eq!(publica.email, None);
    assert_eq!(publica.web, None);
    assert_eq!(publica.ciudad, None);
}

#[test]
#[serial]
fn setup_inicial_valida_sesion_y_rol() {
    let (state, _limpieza) = dev_state_copia();
    let cfg = &state.config;
    let mut conn = state.pool.get().expect("conn");

    let suf = uniq();
    let u_admin = format!("a{}", &suf[..suf.len().min(8)]);
    let u_oper = format!("o{}", &suf[..suf.len().min(8)]);
    let id_admin =
        UsuarioService::crear(&mut conn, cfg, "admin", datos_usuario(&u_admin, "Administrador"))
            .expect("crear admin")
            .id;
    let id_oper =
        UsuarioService::crear(&mut conn, cfg, "admin", datos_usuario(&u_oper, "Operador"))
            .expect("crear operador")
            .id;
    let _limpieza_user = AlSalir(Some(move || {
        let _ = UsuarioService::eliminar(&mut conn, "admin", id_admin);
        let _ = UsuarioService::eliminar(&mut conn, "admin", id_oper);
    }));
    let sid_admin = crear_sesion(&state, id_admin, &u_admin, "Administrador");
    let sid_oper = crear_sesion(&state, id_oper, &u_oper, "Operador");

    let app = app_mock(state);
    let st = app.state::<AppState>();

    // ── 1) Sesión inexistente → session_expired en obtener y guardar ──
    let err = obtener_empresa(st.clone(), "token-inexistente".into())
        .expect_err("obtener sin sesión");
    assert_eq!(err.kind, "session_expired");

    let datos = EmpresaConfigDatos {
        nombre: Some("X".into()),
        nit: None,
        direccion: None,
        telefono: None,
        email: None,
        web: None,
        ciudad: None,
        pais: Some("Colombia".into()),
        logo: None,
    };
    let err = guardar_empresa(st.clone(), "token-inexistente".into(), datos.clone())
        .expect_err("guardar sin sesión");
    assert_eq!(err.kind, "session_expired");

    // ── 2) Rol Operador → permission (solo roles de administración) ──
    let err = guardar_empresa(st.clone(), sid_oper, datos.clone())
        .expect_err("guardar con Operador");
    assert_eq!(err.kind, "permission", "un Operador no configura la empresa");

    // ── 3) El admin sí puede leer ──
    let ok = obtener_empresa(st.clone(), sid_admin).expect("admin lee");
    // No importa el valor: el punto es que no hay error de sesión ni de rol.
    let _ = ok;
}
