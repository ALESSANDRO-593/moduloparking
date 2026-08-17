export const environment = {
  production: true,
  // Mantener true hasta desplegar y probar los workflows en producción.
  useMocks: true,
  // Se recomienda publicar la web y los webhooks bajo el mismo dominio HTTPS.
  n8nBaseUrl: '/webhook'
};
