-- Inicializa únicamente tarifas aún no configuradas.
-- No sobrescribe valores oficiales existentes.
BEGIN;

UPDATE public.parqueadero_modalidades
SET precio = CASE modalidad
    WHEN 'DIARIO' THEN 1.50
    WHEN 'MENSUAL' THEN 25.00
END,
actualizado_en = now()
WHERE precio IS NULL
  AND modalidad IN ('DIARIO', 'MENSUAL')
  AND tipo_vehiculo IN ('AUTO', 'MOTO');

COMMIT;
