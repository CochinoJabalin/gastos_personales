# Docker

NUNCA ejecutes nada directamente en el host. Siempre usa `docker compose` para cualquier operación: build, dev, start, ejecutar comandos, etc. NUNCA uses `podman` ni `podman-compose`.

# Backup

El volumen Docker `backups:/backups` se usa para almacenar los archivos ZIP de backup. Asegúrate de que el volumen esté montado en el servicio `app` en `docker-compose.yml`.
