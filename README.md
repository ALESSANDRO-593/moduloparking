# Administración de Parqueadero

Aplicación web Angular independiente para el módulo administrativo de
parqueadero de YaviBot. No comparte código con la aplicación móvil existente.

## Requisitos

- Node.js 22
- npm 10
- Acceso a la instancia de n8n

## Desarrollo

```bash
npm install
npm start
```

La aplicación queda disponible en `http://localhost:4200`.

## Conexión con n8n

El frontend utiliza `/webhook` como URL base. `proxy.conf.json` reenvía esa
ruta a `http://localhost:5678` durante el desarrollo.

Para trabajar con el n8n de producción sin exponer su panel, abre primero un
túnel SSH desde otra terminal:

```bash
ssh -N -L 5678:127.0.0.1:5678 usuario@servidor
```

Las rutas confirmadas se declaran en
`src/app/core/config/n8n.config.ts`. Los webhooks propios de parqueadero se
agregarán después de definir el esquema de base de datos y su contrato HTTP.

`N8nApiService` centraliza las operaciones GET, POST y PATCH. El interceptor
HTTP agrega automáticamente el JWT guardado en `sessionStorage` a las
peticiones dirigidas a n8n.

## Estructura inicial

```text
src/app/
├── core/
│   ├── config/          # rutas y constantes de n8n
│   ├── interceptors/    # autenticación JWT
│   └── services/        # cliente HTTP de n8n
└── features/
    └── dashboard/       # página inicial administrativa
```

## Compilación

```bash
npm run build
```

El resultado se genera en `dist/parqueadero-admin-web/`.
