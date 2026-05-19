# Plan: Sistema de Backup

## Formato
- ZIP conteniendo `transactions.json` y `mapping-rules.json`
- Nombre: `backup_YYYY-MM-DD_HHmmss.zip`
- Librería: `archiver`

## Modelos Prisma

### BackupSchedule (ya existe, añadir campos)
- name, frequency ("weekly"|"monthly"), dayOfWeek?, dayOfMonth?, time, enabled
- **+path** (String, opcional — sobreescribe ruta global)
- **+includeTransactions** (Boolean, default true)
- **+includeMappingRules** (Boolean, default true)
- lastRun, nextRun, createdAt, updatedAt

### AppConfig (ya existe)
- id @default("default"), backupPath, updatedAt

### BackupLog (nuevo)
- id, scheduleId?, filename, filepath, size, stats (JSON string), createdAt

## Scheduler
- `src/lib/backup-scheduler.ts` — módulo singleton con Map<id, cron.ScheduledTask>
- `init()` al arrancar el servidor (lazy via API routes)
- `register()`, `unregister()`, `reload()`

## API Routes

| Método | Ruta | Propósito |
|---|---|---|
| GET/PUT | `/api/backup/config` | Ruta global de backup |
| GET/POST | `/api/backup/schedules` | Listar/crear schedules |
| GET/PUT/DELETE | `/api/backup/schedules/[id]` | CRUD schedule |
| POST | `/api/backup/schedules/[id]/run` | Ejecutar y descargar |
| POST | `/api/backup/run` | Backup manual one-shot (descarga directa) |
| GET | `/api/backup/logs` | Historial de backups |
| GET | `/api/backup/logs/[id]/download` | Descargar backup previo |

## UI (`/settings/backup`)
- **Ruta global**: input de texto
- **Schedules**: lista con toggle, editar, eliminar, "Ejecutar ahora", "Descargar último"
- **Backup manual**: selector de inclusión + botón → descarga automática
- **Historial**: tabla de backups ejecutados con botón de descarga

## Infraestructura
- Volumen Docker `backups:/backups` en docker-compose.yml
- `npm install archiver`

## Archivos
- `prisma/schema.prisma` — modificar BackupSchedule, añadir BackupLog
- `prisma/schema.postgres.prisma` — idem
- `src/lib/backup.ts` — nuevo (exportar datos, crear ZIP)
- `src/lib/backup-scheduler.ts` — nuevo (cron jobs)
- `src/lib/backup-logs.ts` — nuevo (log de backups)
- `src/components/SettingsNav.tsx` — nuevo (sub-nav compartido)
- `src/app/api/backup/*` — 6 rutas nuevas
- `src/app/(dashboard)/settings/backup/page.tsx` — nuevo
- `src/app/(dashboard)/settings/{page,banks,mapping-rules,import}/page.tsx` — usar SettingsNav
- `src/messages/es.json` — añadir claves backup
- `docker-compose.yml` — volumen backups
- `package.json` — archiver
- `AGENTS.md` — nota sobre docker volume
