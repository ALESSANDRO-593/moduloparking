# n8n del módulo administrativo de parqueadero

Esta carpeta contiene exclusivamente los contratos y workflows del módulo de
parqueadero. No modifica los workflows del chatbot ni de tickets ya desplegados.

## Endpoints disponibles

- `POST /webhook/panel/login`
  - Workflow local: `workflows/panel-login-local.json`
- `GET /webhook/panel/parqueadero/usuarios`
- `DELETE /webhook/panel/parqueadero/usuarios/eliminar`
- `GET /webhook/panel/parqueadero/vehiculos`
- `POST /webhook/panel/parqueadero/vehiculos/crear`
- `PATCH /webhook/panel/parqueadero/vehiculos/retirar`
- `GET /webhook/panel/parqueadero/pagos/catalogos`
- `GET /webhook/panel/parqueadero/pagos`
- `POST /webhook/panel/parqueadero/pagos/crear`
- `PATCH /webhook/panel/parqueadero/pagos/aprobar`
- `GET /webhook/panel/parqueadero/tickets`
- `GET /webhook/panel/parqueadero/accesos`
- `POST /webhook/panel/parqueadero/accesos/entrada`
- `POST /webhook/panel/parqueadero/accesos/salida`
- `GET /webhook/panel/parqueadero/configuracion/tarifas`
- `POST /webhook/panel/parqueadero/configuracion/tarifas/crear`
- `PATCH /webhook/panel/parqueadero/configuracion/tarifas/actualizar`
- `GET /webhook/panel/parqueadero/configuracion/capacidad`
- `PATCH /webhook/panel/parqueadero/configuracion/capacidad/actualizar`

Los workflows de vehículos son:

- `workflows/parqueadero-vehiculos-listar.json`
- `workflows/parqueadero-vehiculo-crear.json`
- `workflows/parqueadero-vehiculo-retirar.json`

Los workflows de usuarios incluyen `workflows/parqueadero-usuarios-listar.json`
y `workflows/parqueadero-usuario-eliminar.json`. La eliminación es física y
borra también accesos, vehículos temporales, autorizaciones, pagos y vehículos
relacionados antes de retirar el usuario de `parqueadero_usuarios`.

Los workflows de pagos son:

- `workflows/parqueadero-pagos-catalogos.json`
- `workflows/parqueadero-pagos-listar.json`
- `workflows/parqueadero-pago-crear.json`
- `workflows/parqueadero-pago-aprobar.json`

Antes de probarlos, ejecute `sql/002-parqueadero-modalidades-precios.sql` para
completar únicamente las tarifas que todavía estén en `NULL`.

Para una instalación completa o cuando falten modalidades, utilice en su lugar
`sql/003-parqueadero-configuracion-tarifas.sql`. El script garantiza las cuatro
combinaciones requeridas y puede ejecutarse varias veces.

Los workflows de configuración son:

- `workflows/parqueadero-configuracion-tarifas-listar.json`
- `workflows/parqueadero-configuracion-tarifa-crear.json`
- `workflows/parqueadero-configuracion-tarifa-actualizar.json`
- `workflows/parqueadero-configuracion-capacidad.json`
- `workflows/parqueadero-configuracion-capacidad-actualizar.json`
- Requiere el JWT generado por `POST /webhook/panel/login` en el encabezado
  `Authorization: Bearer <token>`.
- Autoriza al rol `SUPERADMIN` o a una sesión que incluya el permiso
  `PARQUEADERO_GESTIONAR`.

Antes de importar los workflows de capacidad y accesos, ejecute
`sql/004-parqueadero-capacidad.sql`. El valor inicial es de 100 espacios y
puede cambiarse posteriormente desde la pantalla Configuración.

Los workflows de historial y control de acceso son:

- `workflows/parqueadero-tickets-listar.json`
- `workflows/parqueadero-accesos-listar.json`
- `workflows/parqueadero-acceso-entrada.json`
- `workflows/parqueadero-acceso-salida.json`

El historial de tickets es de solo lectura. Los tickets se siguen generando al
registrar un pago aprobado con la opción correspondiente. Una entrada exige un
ticket vigente y un espacio disponible; la salida se registra contra el mismo
ticket utilizado en la entrada y libera el espacio.

El cambio de vehículo temporal está integrado en el workflow de entrada. No
requiere una pantalla ni un webhook separado: si `useTemporary` es verdadero,
n8n registra el reemplazo y el acceso en una misma transacción. El código que se
muestra al usuario tiene el formato corto `YV-000015`.

## Preparación en n8n

1. Importe el archivo JSON desde el panel de n8n.
2. Abra cada nodo PostgreSQL y seleccione la credencial existente
   `YaviBot Postgres`.
3. Configure `JWT_SECRET` en el contenedor n8n con exactamente el mismo valor
   utilizado por `panel-login`. El workflow no contiene secretos embebidos.
   Los nodos Code que firman y verifican el JWT también requieren
   `NODE_FUNCTION_ALLOW_BUILTIN=crypto`.
4. Active el workflow.
5. En Angular cambie `useMocks` a `false` únicamente en el environment que vaya
   a probar.

En desarrollo, `npm start` utiliza `proxy.conf.json` y envía `/webhook` a
`http://localhost:5678`. Si n8n está en el servidor se puede abrir un túnel SSH:

```powershell
ssh -L 5678:127.0.0.1:5678 root@IP_DEL_SERVIDOR
```

Mantenga esa terminal abierta mientras ejecuta Angular.

Consulte `CONTRATO-API.md` antes de cambiar nombres o formatos de respuesta.
