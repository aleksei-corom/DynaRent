-- 0021_empresa_pais.sql — Columna PAIS en EMPRESA_CONFIG
--
-- El setup inicial (/empresa) recogía nombre, NIT, dirección, teléfono,
-- email, web, ciudad y logo, pero el CÓDIGO DE PAÍS de los teléfonos de
-- contacto estaba fijo a +57 (Colombia). Esta migración añade la columna
-- explícita para que cada empresa compradora configure el país donde se
-- usa la aplicación y los teléfonos lleven el código correspondiente
-- (derivado en el frontend desde este campo).
--
-- IDEMPOTENCIA (mismo patrón que 0018): el guard revisa RDB$RELATION_FIELDS
-- antes del DDL, así que reintentos e instalaciones nuevas son seguros.

EXECUTE BLOCK
AS
BEGIN
  IF (NOT EXISTS(SELECT 1 FROM RDB$RELATION_FIELDS rf
                 WHERE rf.RDB$RELATION_NAME = 'EMPRESA_CONFIG'
                   AND rf.RDB$FIELD_NAME = 'PAIS')) THEN
    EXECUTE STATEMENT 'ALTER TABLE EMPRESA_CONFIG ADD PAIS VARCHAR(100)';
END;
