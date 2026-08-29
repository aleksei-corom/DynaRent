-- 0028_empresa_moneda_locale.sql — Columnas MONEDA y LOCALE en EMPRESA_CONFIG
--
-- Permite que cada empresa compradora configure la moneda y el locale
-- utilizados en toda la aplicación (formato de moneda, separadores,
-- decimales). Defaults: COP / es-CO (comportamiento actual).
--
-- IDEMPOTENCIA: mismo patrón que 0021: el guard revisa
-- RDB$RELATION_FIELDS antes del DDL.

EXECUTE BLOCK
AS
BEGIN
  IF (NOT EXISTS(SELECT 1 FROM RDB$RELATION_FIELDS rf
                 WHERE rf.RDB$RELATION_NAME = 'EMPRESA_CONFIG'
                   AND rf.RDB$FIELD_NAME = 'MONEDA')) THEN
    EXECUTE STATEMENT 'ALTER TABLE EMPRESA_CONFIG ADD MONEDA VARCHAR(10) DEFAULT ''COP''';

  IF (NOT EXISTS(SELECT 1 FROM RDB$RELATION_FIELDS rf
                 WHERE rf.RDB$RELATION_NAME = 'EMPRESA_CONFIG'
                   AND rf.RDB$FIELD_NAME = 'LOCALE')) THEN
    EXECUTE STATEMENT 'ALTER TABLE EMPRESA_CONFIG ADD LOCALE VARCHAR(10) DEFAULT ''es-CO''';
END;
