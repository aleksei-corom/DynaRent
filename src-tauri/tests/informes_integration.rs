//! informes_integration.rs — Pruebas de integración del servicio de informes
//! contra el .fdb de desarrollo (data/dynarent_v3.fdb).
//!
//! Verifica el balance mensual: consistencia de ingresos/egresos, el mes por
//! defecto y la lista de rentas del período.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use chrono::{Duration, Local};
use serial_test::serial;

use dynarent_lib::core::config::AppConfig;
use dynarent_lib::core::rbac::SessionStore;
use dynarent_lib::core::security::LoginAttemptTracker;
use dynarent_lib::core::PooledConnection;
use dynarent_lib::repositories::auto::AutoRepository;
use dynarent_lib::repositories::cliente::ClienteRepository;
use dynarent_lib::repositories::renta::RentaDatos;
use dynarent_lib::repositories::reserva::ReservaDatos;
use dynarent_lib::services::informe::InformeService;
use dynarent_lib::services::renta::RentaService;
use dynarent_lib::services::reserva::ReservaService;
use dynarent_lib::services::AppState;

/// Ingresos por abonos de reservas en un día concreto (totales del rango).
fn ingresos_reservas_en(conn: &mut PooledConnection, dia: &str) -> rust_decimal::Decimal {
    let informe = InformeService::mensual(conn, dia, dia).expect("informe");
    informe.ingresos_reservas.parse().expect("numérico")
}

/// Ingresos (incluye el ABONO de reservas) de un vehículo en un día concreto.
fn ingresos_de_placa(conn: &mut PooledConnection, dia: &str, placa: &str) -> rust_decimal::Decimal {
    let informe = InformeService::mensual(conn, dia, dia).expect("informe");
    informe
        .utilidad_por_vehiculo
        .iter()
        .find(|v| v.placa == placa)
        .map(|v| v.ingresos.parse().expect("numérico"))
        .unwrap_or(rust_decimal::Decimal::ZERO)
}

fn dev_state() -> AppState {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let data_dir = manifest.join("../data");
    let resource_dir = manifest.join("resources");
    let cfg = Arc::new(AppConfig::load(&data_dir, &resource_dir, &manifest));
    let pool = dynarent_lib::core::db::create_pool(&cfg).expect("pool embedded");
    AppState {
        pool,
        sessions: std::sync::Arc::new(Mutex::new(SessionStore::new(3600))),
        login_tracker: Mutex::new(LoginAttemptTracker::new(5, 1800, 300, 10)),
        config: cfg.clone(),
        pii_key: Mutex::new(cfg.db_encryption_key.clone()),
    }
}

#[test]
#[serial]
fn informe_mensual_balance_consistente() {
    let state = dev_state();
    let mut conn = state.pool.get().expect("conn");

    // Mes por defecto (actual)
    let informe =
        InformeService::mensual(&mut conn, "2026-08-01", "2026-08-31").expect("informe mes actual");
    assert_eq!(informe.fecha_inicio, "2026-08-01", "fecha de inicio");
    assert_eq!(informe.fecha_fin, "2026-08-31", "fecha fin");

    // Balance = total_ingresos − total_egresos (consistencia interna)
    let ingresos: rust_decimal::Decimal = informe.total_ingresos.parse().expect("numérico");
    let egresos: rust_decimal::Decimal = informe.total_egresos.parse().expect("numérico");
    let balance: rust_decimal::Decimal = informe.balance.parse().expect("numérico");
    assert_eq!(balance, ingresos - egresos, "balance = ingresos − egresos");

    // Netos: ingresos_netos = total_ingresos − total_comisiones;
    // balance_neto = balance − total_comisiones (consistencia interna)
    let comisiones: rust_decimal::Decimal = informe
        .total_comisiones
        .parse()
        .expect("comisiones numérico");
    let ingresos_netos: rust_decimal::Decimal =
        informe.ingresos_netos.parse().expect("netos numérico");
    let balance_neto: rust_decimal::Decimal =
        informe.balance_neto.parse().expect("balance neto numérico");
    assert_eq!(
        ingresos_netos,
        ingresos - comisiones,
        "ingresos netos = ingresos − comisiones"
    );
    assert_eq!(
        balance_neto,
        balance - comisiones,
        "balance neto = balance − comisiones"
    );

    // Los totales parciales suman el total
    let pagos: rust_decimal::Decimal = informe.ingresos_pagos.parse().expect("numérico");
    let reservas: rust_decimal::Decimal = informe.ingresos_reservas.parse().expect("numérico");
    assert_eq!(
        ingresos,
        pagos + reservas,
        "total ingresos = pagos + reservas"
    );

    // La estructura de rentas del mes es válida
    for r in &informe.rentas {
        assert!(r.id > 0);
        assert!(!r.nombre_cliente.is_empty());
    }
}

#[test]
#[serial]
fn informe_utilidad_por_vehiculo() {
    let state = dev_state();
    let mut conn = state.pool.get().expect("conn");

    let informe = InformeService::mensual(&mut conn, "2026-08-01", "2026-08-31").expect("informe");

    // La utilidad de cada vehículo = ingresos − costos (consistencia interna)
    for v in &informe.utilidad_por_vehiculo {
        assert!(!v.placa.is_empty(), "toda fila tiene placa");
        let ingresos: rust_decimal::Decimal = v.ingresos.parse().expect("ingresos numérico");
        let costos: rust_decimal::Decimal = v.costos.parse().expect("costos numérico");
        let utilidad: rust_decimal::Decimal = v.utilidad.parse().expect("utilidad numérico");
        assert_eq!(
            utilidad,
            ingresos - costos,
            "utilidad = ingresos − costos ({})",
            v.placa
        );
    }

    // Ordenadas de mayor a menor utilidad
    let utilidades: Vec<rust_decimal::Decimal> = informe
        .utilidad_por_vehiculo
        .iter()
        .map(|v| v.utilidad.parse().expect("numérico"))
        .collect();
    assert!(
        utilidades.windows(2).all(|w| w[0] >= w[1]),
        "orden descendente"
    );
}

#[test]
#[serial]
fn informe_mensual_especifico() {
    let state = dev_state();
    let mut conn = state.pool.get().expect("conn");

    // Un mes con datos mínimos esperados (2026-08 tiene tablas de prueba)
    let informe =
        InformeService::mensual(&mut conn, "2026-08-01", "2026-08-31").expect("informe 2026-08");
    assert_eq!(informe.fecha_inicio, "2026-08-01");
    assert_eq!(informe.fecha_fin, "2026-08-31");

    // Los montos devueltos son cadenas numéricas válidas
    for m in [
        &informe.ingresos_pagos,
        &informe.ingresos_reservas,
        &informe.egresos_gastos,
        &informe.egresos_mantenimiento,
        &informe.egresos_comparendos,
        &informe.total_ingresos,
        &informe.total_egresos,
        &informe.balance,
        &informe.total_comisiones,
        &informe.ingresos_netos,
        &informe.balance_neto,
    ] {
        assert!(
            m.parse::<rust_decimal::Decimal>().is_ok(),
            "monto numérico: {m}"
        );
    }
    // Gastos por categoría: claves no vacías
    for (cat, total) in &informe.gastos_por_categoria {
        assert!(!cat.is_empty());
        assert!(total.parse::<rust_decimal::Decimal>().is_ok());
    }
}

#[test]
#[serial]
fn informe_comisiones_y_balance_neto() {
    let state = dev_state();
    let cfg = &state.config;
    let mut conn = state.pool.get().expect("conn");

    let Some(placa) = (|| {
        let autos = AutoRepository::obtener_todos(&mut conn).ok()?;
        autos.first().map(|a| a.placa.clone())
    })() else {
        panic!("BD de dev sin autos — se requiere flota real.");
    };

    let hoy = Local::now().date_naive();
    let dia = hoy.format("%Y-%m-%d").to_string();

    // Baseline del día antes de crear la renta con comisión
    let antes = InformeService::mensual(&mut conn, &dia, &dia).expect("informe antes");
    let comisiones_antes: rust_decimal::Decimal = antes.total_comisiones.parse().expect("numérico");
    let ingresos_netos_antes: rust_decimal::Decimal =
        antes.ingresos_netos.parse().expect("numérico");
    let balance_neto_antes: rust_decimal::Decimal = antes.balance_neto.parse().expect("numérico");

    // Renta de hoy con comisión de 120.000: total 178.500 (1 día × 150.000
    // + 19% IVA) → valor neto 58.500
    let datos = RentaDatos {
        placa: Some(placa.clone()),
        nombre_cliente: "CLIENTE INFORME COMISION".into(),
        fecha_recogida: dia.clone(),
        hora_recogida: Some("09:00".into()),
        fecha_retorno: (hoy + Duration::days(1)).format("%Y-%m-%d").to_string(),
        hora_retorno: Some("18:00".into()),
        dias_calculados: 1,
        horas_extras: 0,
        valor_dia: "150000".into(),
        valor_hora_extra: "10000".into(),
        cobra_iva: true,
        tiene_comision: true,
        comision: "120000".into(),
        ..RentaDatos::default()
    };
    let creada = RentaService::crear(&mut conn, cfg, datos).expect("crear renta con comisión");
    assert_eq!(creada.valor_neto, "58500.00", "neto = 178.500 − 120.000");

    let despues = InformeService::mensual(&mut conn, &dia, &dia).expect("informe después");
    let comisiones_despues: rust_decimal::Decimal =
        despues.total_comisiones.parse().expect("numérico");
    let ingresos_netos_despues: rust_decimal::Decimal =
        despues.ingresos_netos.parse().expect("numérico");
    let balance_neto_despues: rust_decimal::Decimal =
        despues.balance_neto.parse().expect("numérico");

    assert_eq!(
        comisiones_despues - comisiones_antes,
        rust_decimal::Decimal::from(120000),
        "la renta suma su comisión al total del período"
    );
    assert_eq!(
        ingresos_netos_despues - ingresos_netos_antes,
        rust_decimal::Decimal::from(-120000),
        "los ingresos netos caen por la comisión"
    );
    assert_eq!(
        balance_neto_despues - balance_neto_antes,
        rust_decimal::Decimal::from(-120000),
        "el balance neto cae por la comisión"
    );

    // La renta aparece en el detalle con su comisión y valor neto
    let renta = despues
        .rentas
        .iter()
        .find(|r| r.id == creada.id)
        .expect("renta en el informe");
    assert_eq!(renta.comision, "120000.00");
    assert_eq!(renta.valor_neto, "58500.00");

    // La utilidad por vehículo incluye la comisión como costo
    let util = despues
        .utilidad_por_vehiculo
        .iter()
        .find(|v| v.placa == placa)
        .expect("vehículo en utilidad");
    let costos: rust_decimal::Decimal = util.costos.parse().expect("costos numérico");
    assert!(
        costos >= rust_decimal::Decimal::from(120000),
        "los costos del vehículo incluyen la comisión"
    );

    RentaService::eliminar(&mut conn, creada.id, "test").expect("limpieza");
}

/// RBAC: `informe_mensual` solo es accesible para los roles de
/// `roles_con_informes` (config.ini — por defecto solo Administrador).
/// data/config.ini es local (gitignorado) y puede ampliar la lista, así que
/// las expectativas se derivan de la config cargada: todo rol de la lista
/// pasa, cualquier otro rol queda denegado.
#[test]
#[serial]
fn informe_requiere_roles_con_informes() {
    let state = dev_state();

    // Mismo fallback que commands::require_informes (config vacía → solo Admin)
    let roles: Vec<String> = if state.config.roles_con_informes.is_empty() {
        vec!["Administrador".into()]
    } else {
        state.config.roles_con_informes.iter().cloned().collect()
    };
    assert!(
        roles.iter().any(|r| r == "Administrador"),
        "Administrador siempre está en roles_con_informes"
    );

    // Un rol fuera de la lista → denegado con kind "permission"
    let rol_fuera = ["Operador", "Invitado", "Borrador"]
        .iter()
        .find(|r| !roles.iter().any(|x| x == *r))
        .expect("siempre hay un rol fuera de la lista");
    {
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        let token = sessions.create(1, "rol-fuera", rol_fuera, "Fuera", false);
        drop(sessions);
        let err = dynarent_lib::commands::require_informes(&state, &token)
            .expect_err("un rol fuera de roles_con_informes no puede consultar informes");
        assert_eq!(err.kind, "permission");
    }

    // Cada rol de la lista → permitido
    {
        let mut sessions = state.sessions.lock().unwrap_or_else(|e| e.into_inner());
        let tokens: Vec<String> = roles
            .iter()
            .enumerate()
            .map(|(i, rol)| sessions.create(100 + i as i64, &format!("rol-{i}"), rol, rol, false))
            .collect();
        drop(sessions);
        for (rol, token) in roles.iter().zip(&tokens) {
            assert!(
                dynarent_lib::commands::require_informes(&state, token).is_ok(),
                "el rol {rol} está en roles_con_informes y debe poder consultar informes"
            );
        }
    }

    // Sin sesión → session_expired
    {
        let err = dynarent_lib::commands::require_informes(&state, "no-existe")
            .expect_err("sin sesión no se accede a informes");
        assert_eq!(err.kind, "session_expired");
    }
}

/// Regresión: una reserva eliminada (soft-delete) NO debe sumar su `abono`
/// en el informe. Las dos ramas UNION de `reservas` (totales_rango y la
/// utilidad por vehículo) no filtraban `deleted_at IS NULL`, así que una
/// reserva borrada seguía inflando los ingresos del mes del propietario.
#[test]
#[serial]
fn informe_excluye_reservas_eliminadas() {
    let state = dev_state();
    let cfg = &state.config;
    let mut conn = state.pool.get().expect("conn");

    // Auto y cliente reales de la BD de dev (solo lectura)
    let (placa, tipo) = {
        let autos = AutoRepository::obtener_todos(&mut conn).expect("autos");
        let a = autos.first().expect("la BD de dev tiene autos");
        (a.placa.clone(), a.tipo.clone())
    };
    let (id_cliente, nombre_cliente) = {
        let clientes = ClienteRepository::obtener_todos(&mut conn).expect("clientes");
        let c = clientes.first().expect("la BD de dev tiene clientes");
        (c.id, c.nombre_completo.clone())
    };

    let hoy = Local::now().date_naive().format("%Y-%m-%d").to_string();

    // Baselines del día antes de tocar nada
    let reservas_antes = ingresos_reservas_en(&mut conn, &hoy);
    let placa_antes = ingresos_de_placa(&mut conn, &hoy, &placa);

    let datos = ReservaDatos {
        id_cliente: Some(id_cliente),
        nombre_cliente,
        nacionalidad: Some("Colombiana".into()),
        categoria_vehiculo: Some(tipo),
        placa_asignada: Some(placa.clone()),
        fecha_recogida: hoy.clone(),
        hora_recogida: Some("09:00".into()),
        ubicacion_recogida: Some("Oficina principal".into()),
        fecha_retorno: hoy.clone(),
        hora_retorno: Some("18:00".into()),
        ubicacion_retorno: Some("Oficina principal".into()),
        dias_calculados: 1,
        horas_extras: 0,
        valor_dia: "150000".into(),
        valor_hora_adic: "0".into(),
        costo_lavado: "0".into(),
        abono: "100000".into(),
        total: "0".into(),
        observaciones: Some("TEST INFORME RESERVA ELIMINADA".into()),
        estado: "Confirmada".into(),
    };
    let creada = ReservaService::crear(&mut conn, cfg, "test", datos).expect("crear reserva");

    // Mientras existe, su abono SÍ suma en totales y en la utilidad del vehículo
    assert_eq!(
        ingresos_reservas_en(&mut conn, &hoy) - reservas_antes,
        rust_decimal::Decimal::from(100_000),
        "el abono de la reserva suma a los ingresos por reservas"
    );
    assert_eq!(
        ingresos_de_placa(&mut conn, &hoy, &placa) - placa_antes,
        rust_decimal::Decimal::from(100_000),
        "el abono suma a los ingresos del vehículo en la utilidad"
    );

    // Eliminación lógica → el abono desaparece del informe (fix)
    ReservaService::eliminar(&mut conn, "test", creada.id).expect("eliminar reserva");

    assert_eq!(
        ingresos_reservas_en(&mut conn, &hoy),
        reservas_antes,
        "una reserva eliminada ya no suma su abono a los ingresos por reservas"
    );
    assert_eq!(
        ingresos_de_placa(&mut conn, &hoy, &placa),
        placa_antes,
        "una reserva eliminada ya no suma a la utilidad por vehículo"
    );
}
