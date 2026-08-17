# Contrato API — Parqueadero administrativo

Base URL utilizada por Angular: `/webhook`. En producción nginx debe servir la
web y enviar `/webhook/*` al contenedor n8n en `127.0.0.1:5678`.

Todas las rutas administrativas usan el JWT emitido por `panel/login`:

```http
Authorization: Bearer <token>
```

Una respuesta `401` indica token inexistente, inválido o vencido. Una respuesta
`403` indica una sesión válida sin permisos para administrar parqueadero.

## Iniciar sesión en el panel

```http
POST /webhook/panel/login
Content-Type: application/json
```

Petición:

```json
{
  "cedula": "0000000001",
  "password": "contraseña-del-panel"
}
```

Respuesta `200`:

```json
{
  "token": "eyJ...",
  "expiresIn": 3600,
  "user": {
    "id": 5,
    "identification": "0000000001",
    "fullName": "Super Administrador",
    "email": "superadmin@yavirac.edu.ec",
    "role": "SUPERADMIN",
    "permissions": ["parqueadero.ver", "parqueadero.gestionar"]
  }
}
```

El token expira después de una hora. Las credenciales incorrectas responden
`401`; un cuerpo inválido responde `400`.

## Listar usuarios del parqueadero

```http
GET /webhook/panel/parqueadero/usuarios
```

Respuesta `200`:

```json
{
  "data": [
    {
      "id": 1,
      "sourceId": 12,
      "type": "ESTUDIANTE",
      "identification": "1721456789",
      "fullName": "María Fernanda Loor",
      "institutionalEmail": "mf.loor@yavirac.edu.ec",
      "vehicles": ["PCS-4821"],
      "paymentPlan": "MENSUAL",
      "paymentValidUntil": "2026-08-30",
      "serviceStatus": "HABILITADO",
      "enabled": true
    }
  ]
}
```

`paymentPlan` y `paymentValidUntil` son `null` cuando no existe un pago aprobado
vigente. `serviceStatus` puede ser `HABILITADO`, `INHABILITADO` o
`SIN_AUTORIZACION`.

Para usuarios también están disponibles los endpoints de búsqueda, creación y
cambio de estado definidos en los workflows del proyecto.

## Eliminar usuario del parqueadero

```http
DELETE /webhook/panel/parqueadero/usuarios/eliminar
Content-Type: application/json
```

```json
{ "id": 1 }
```

La eliminación es irreversible. En una sola operación se borran los accesos,
vehículos temporales, autorizaciones (tickets), pagos y vehículos relacionados;
finalmente se elimina el registro de `parqueadero_usuarios`. Responde `200` si
se completó o `404` si el usuario no existe.

Si la cédula no existe en estudiantes ni docentes, la creación utiliza
`type: "INVITADO"` y `sourceId: null`. Antes de habilitar esta opción se debe
ejecutar nuevamente `sql/001-parqueadero-usuarios-manuales.sql`; el script
también convierte a `INVITADO` los usuarios manuales registrados anteriormente.

## Listar vehículos activos

```http
GET /webhook/panel/parqueadero/vehiculos
```

Respuesta `200`:

```json
{
  "data": [
    {
      "id": 1,
      "parkingUserId": 1,
      "plate": "PCS-4821",
      "type": "AUTO",
      "brand": "Chevrolet",
      "model": "Sail",
      "color": "Gris",
      "isPrimary": true,
      "active": true
    }
  ]
}
```

## Registrar vehículo

```http
POST /webhook/panel/parqueadero/vehiculos/crear
Content-Type: application/json
```

```json
{
  "parkingUserId": 1,
  "plate": "PCS-4821",
  "type": "AUTO",
  "brand": "Chevrolet",
  "model": "Sail",
  "color": "Gris",
  "isPrimary": true
}
```

Responde `201` al crear, `404` si el usuario no existe o está inactivo y `409`
si la placa ya se encuentra registrada. El primer vehículo activo de un usuario
se convierte automáticamente en habitual. Al registrar otro como habitual, el
anterior pasa a secundario.

## Retirar vehículo

```http
PATCH /webhook/panel/parqueadero/vehiculos/retirar
Content-Type: application/json
```

```json
{ "id": 1 }
```

El retiro es lógico: conserva el registro y establece `activo = false`. Cuando
se retira el vehículo habitual y existe otro activo, el sistema promueve uno de
los secundarios como nuevo habitual.

## Catálogo de modalidades

```http
GET /webhook/panel/parqueadero/pagos/catalogos
```

Devuelve las tarifas activas para las combinaciones `DIARIO`/`MENSUAL` y
`AUTO`/`MOTO`. Angular muestra estos valores, pero el servidor vuelve a consultar
la tarifa al registrar para impedir que el monto sea alterado desde el cliente.

## Listar pagos

```http
GET /webhook/panel/parqueadero/pagos
```

La respuesta contiene `id`, `parkingUserId`, `modality`, `amount`, `startDate`,
`endDate`, `status`, `method`, `reference` y `authorizationIssued`.

## Registrar pago

```http
POST /webhook/panel/parqueadero/pagos/crear
Content-Type: application/json
```

```json
{
  "parkingUserId": 1,
  "vehicleId": 2,
  "modality": "MENSUAL",
  "startDate": "2026-08-16",
  "method": "TRANSFERENCIA",
  "reference": "TRX-123456",
  "status": "APROBADO",
  "issueAuthorization": true
}
```

El vehículo se valida para determinar su tipo y tarifa, pero el pago queda
asociado al usuario según el esquema de la base. La vigencia diaria termina el
mismo día; la mensual abarca 30 días contando la fecha inicial. Si el pago está
aprobado y `issueAuthorization` es `true`, el ticket se crea en la misma
operación de base de datos. Una transferencia puede registrarse como pendiente
sin integración bancaria.

## Aprobar un pago pendiente y generar ticket

```http
PATCH /webhook/panel/parqueadero/pagos/aprobar
Content-Type: application/json
```

```json
{ "id": 15, "startDate": "2026-08-17" }
```

Aprueba el pago pendiente, actualiza su periodo de vigencia desde la fecha
indicada y genera el ticket en una sola operación. Responde `409` cuando el pago
ya fue procesado, ya tiene ticket o el usuario está inhabilitado.

## Configuración de tarifas

```http
GET /webhook/panel/parqueadero/configuracion/tarifas
POST /webhook/panel/parqueadero/configuracion/tarifas/crear
PATCH /webhook/panel/parqueadero/configuracion/tarifas/actualizar
```

La consulta devuelve todas las combinaciones, incluidas las inactivas. Para
actualizar una tarifa se envía, por ejemplo:

```json
{ "id": 1, "amount": 1.75, "active": true }
```

Una tarifa activa debe tener un precio mayor a cero. Los cambios solo afectan
pagos nuevos; `parqueadero_pagos.monto` conserva el valor histórico.

Solo puede existir una fila por combinación de modalidad y tipo de vehículo.
El intento de crear una combinación existente responde `409`; en ese caso se
debe actualizar la tarifa existente.

## Historial de tickets

```http
GET /webhook/panel/parqueadero/tickets
```

Devuelve en `data` los tickets creados desde pagos aprobados, ordenados desde el
más reciente. Esta ruta es de solo lectura; la pantalla no emite tickets. La
generación continúa formando parte del registro de pagos.

El código visible usa el formato corto `YV-000015`. La columna UUID original se
mantiene internamente y no es necesario modificar la tabla existente.

## Capacidad del parqueadero

```http
GET /webhook/panel/parqueadero/configuracion/capacidad
PATCH /webhook/panel/parqueadero/configuracion/capacidad/actualizar
```

Respuesta de consulta:

```json
{ "total": 100, "occupied": 7, "available": 93 }
```

Para actualizarla se envía `{ "total": 120 }`. El servidor no permite reducir
el total por debajo de la ocupación actual. Requiere ejecutar previamente
`sql/004-parqueadero-capacidad.sql`.

## Entradas y salidas

```http
GET /webhook/panel/parqueadero/accesos
POST /webhook/panel/parqueadero/accesos/entrada
POST /webhook/panel/parqueadero/accesos/salida
```

Una entrada con el vehículo habitual recibe:

```json
{ "authorizationId": 15, "useTemporary": false }
```

Para ingresar con un reemplazo temporal se envían adicionalmente sus datos:

```json
{
  "authorizationId": 15,
  "useTemporary": true,
  "temporaryPlate": "PBA-7745",
  "temporaryVehicleType": "AUTO"
}
```

La entrada valida que el ticket y el pago estén vigentes, que el usuario esté
activo, que tenga un vehículo habitual y que queden espacios. El reemplazo debe
ser del tipo cubierto por el ticket y su placa no puede estar registrada como
habitual ni encontrarse dentro. El vehículo temporal y la entrada se crean en
una misma transacción, con vigencia para el día actual.

La salida recibe `{ "authorizationId": 15 }` y solo se admite si el último
movimiento fue una entrada con ese ticket. Cada operación se conserva en
`parqueadero_accesos`; la ocupación se calcula con el último movimiento
autorizado de cada usuario.
