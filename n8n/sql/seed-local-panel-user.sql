-- SOLO DESARROLLO LOCAL. No ejecutar en producción.
-- Credenciales locales:
--   Cédula:     0999999999
--   Contraseña: ParqueaderoLocal2026!

DO $$
DECLARE
    superadmin_role_id bigint;
BEGIN
    SELECT id INTO superadmin_role_id
    FROM public.roles
    WHERE codigo = 'SUPERADMIN';

    IF superadmin_role_id IS NULL THEN
        RAISE EXCEPTION 'No existe el rol SUPERADMIN en public.roles';
    END IF;

    INSERT INTO public.usuarios_panel (
        cedula,
        nombres,
        correo,
        password_hash,
        rol_id,
        activo
    )
    VALUES (
        '0999999999',
        'Administrador Parqueadero Local',
        'parqueadero.local@yavirac.edu.ec',
        public.crypt('ParqueaderoLocal2026!', public.gen_salt('bf', 12)),
        superadmin_role_id,
        true
    )
    ON CONFLICT (cedula) DO UPDATE
    SET nombres = EXCLUDED.nombres,
        correo = EXCLUDED.correo,
        password_hash = EXCLUDED.password_hash,
        rol_id = EXCLUDED.rol_id,
        activo = true,
        actualizado_en = now();
END
$$;

SELECT
    up.id,
    up.cedula,
    up.nombres,
    up.correo,
    r.codigo AS rol,
    up.activo
FROM public.usuarios_panel up
JOIN public.roles r ON r.id = up.rol_id
WHERE up.cedula = '0999999999';
