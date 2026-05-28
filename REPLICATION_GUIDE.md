# Guía de Replicación: Gestor Patrimonial (Wealth Manager)

> Aplicación web de gestión financiera personal completa con soporte para múltiples bancos, inversiones, crowdlending, transferencias programadas y backup automatizado.

---

## Tabla de Contenidos

1. [Descripción General](#1-descripción-general)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Estructura del Proyecto](#3-estructura-del-proyecto)
4. [Modelos de Datos (Prisma Schema)](#4-modelos-de-datos-prisma-schema)
5. [API REST](#5-api-rest)
6. [Componentes UI Principales](#6-componentes-ui-principales)
7. [Funcionalidades Detalladas](#7-funcionalidades-detalladas)
8. [Servicios Background (Schedulers)](#8-servicios-background-schedulers)
9. [Configuración](#9-configuración)
10. [Instrucciones de Despliegue](#10-instrucciones-de-despliegue)
11. [Integraciones Externas](#11-integraciones-externas)
12. [Sistema de Diseño](#12-sistema-de-diseño)

---

## 1. Descripción General

### Propósito

Aplicación de gestión patrimonial personal que permite:
- Registrar y categorizar transacciones bancarias
- Gestionar múltiples bancos y cuentas
- Realizar transferencias entre cuentas propias
- Seguimiento de inversiones (acciones, ETFs, fondos)
- Gestión de crowdlending
- Dashboard analítico con métricas financieras
- Backup y restore automatizado

### Características Principales

| Módulo | Funcionalidades |
|--------|-----------------|
| **Transacciones** | Quick entry, importación CSV, auto-categorización, recurrentes |
| **Dashboard** | Balance total, tasa de ahorro, gráficos, widgets drag-and-drop |
| **Bancos** | Multi-banco, multi-cuenta, IBAN, intereses automáticos |
| **Transferencias** | Manuales, programadas, auto-topup, redondeo |
| **Inversiones** | Portfolio, holdings, lotes FIFO, dividendos, plusvalías |
| **Crowdlending** | Inversiones, pagos, originadores, ROI |
| **Backup** | Manual, programado (cron), restore desde ZIP |

---

## 2. Stack Tecnológico

### Frontend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Next.js | 14.2.21 | Framework React con App Router |
| React | 18.3.1 | Biblioteca UI |
| TypeScript | 5.7.3 | Tipado estático |
| Tailwind CSS | 3.4.17 | Framework CSS utility-first |
| react-grid-layout | 1.4.4 | Dashboard con widgets drag-and-drop |

### Backend

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Prisma | 5.22.0 | ORM para PostgreSQL/SQLite |
| NextAuth.js | 4.24.11 | Autenticación con Credentials |
| node-cron | 3.0.3 | Tareas programadas |
| archiver | 7.0.1 | Generación de backups ZIP |
| adm-zip | 0.5.16 | Restauración de backups |

### Infraestructura

| Tecnología | Versión | Propósito |
|------------|---------|-----------|
| Node.js | 20 Alpine | Runtime de producción |
| PostgreSQL | 16 Alpine | Base de datos producción |
| Docker Compose | - | Orquestación de servicios |

### package.json

```json
{
  "name": "wealth-manager",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "postinstall": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "next": "^14.2.21",
    "next-auth": "^4.24.11",
    "adm-zip": "^0.5.16",
    "archiver": "^7.0.1",
    "node-cron": "^3.0.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-grid-layout": "^1.4.4"
  },
  "devDependencies": {
    "@types/adm-zip": "^0.5.5",
    "@types/archiver": "^7.0.0",
    "@types/node": "^20.17.12",
    "@types/node-cron": "^3.0.11",
    "@types/react": "^18.3.17",
    "@types/react-dom": "^18.3.5",
    "@types/react-grid-layout": "^1.3.5",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.1",
    "eslint-config-next": "^14.2.21",
    "postcss": "^8.4.49",
    "prisma": "^5.22.0",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3"
  }
}
```

---

## 3. Estructura del Proyecto

```
/
├── .dockerignore              # Archivos ignorados en Docker
├── .env                       # Variables de entorno (producción)
├── .env.example               # Plantilla de variables
├── .gitignore                 # Archivos ignorados por Git
├── AGENTS.md                  # Instrucciones para agentes AI
├── Dockerfile                 # Build multi-stage
├── docker-compose.yml         # Orquestación de servicios
├── next.config.mjs            # Config Next.js (standalone)
├── package.json               # Dependencias NPM
├── postcss.config.mjs         # Config PostCSS
├── tailwind.config.ts         # Config Tailwind (tema oscuro)
├── tsconfig.json              # Config TypeScript
│
├── prisma/
│   ├── schema.prisma          # Schema SQLite (desarrollo)
│   ├── schema.postgres.prisma # Schema PostgreSQL (producción)
│   └── db/                    # Base de datos SQLite local
│
├── scripts/
│   └── startup-check.mjs      # Verificación de DB al iniciar
│
├── public/
│   ├── favicon.ico
│   ├── favicon.svg
│   ├── icon-192.png           # PWA icon
│   ├── icon-512.png           # PWA icon
│   └── robots.txt
│
└── src/
    ├── app/                   # App Router (Next.js 14)
    │   ├── globals.css        # Estilos globales
    │   ├── layout.tsx         # Layout raíz
    │   ├── page.tsx           # Redirige a /login
    │   ├── login/             # Página de autenticación
    │   ├── api/               # API Routes (REST)
    │   │   ├── auth/          # NextAuth endpoints
    │   │   ├── banks/         # CRUD bancos
    │   │   ├── accounts/      # CRUD cuentas
    │   │   ├── transactions/  # CRUD transacciones
    │   │   ├── transfers/     # CRUD transferencias
    │   │   ├── investments/   # Holdings, instrumentos, crowdlending
    │   │   ├── dashboard/     # Métricas y matrix
    │   │   ├── backup/        # Backup y restore
    │   │   ├── mapping-rules/ # Reglas auto-categorización
    │   │   ├── auto-topup/    # Config auto-recarga
    │   │   ├── redondeo/      # Config redondeo
    │   │   ├── categories/    # Lista de categorías
    │   │   ├── infer/         # Inferencia de categoría
    │   │   └── budget-categories/ # Config 50/30/20
    │   │
    │   └── (dashboard)/       # Grupo de rutas protegidas
    │       ├── layout.tsx     # Layout con sidebar
    │       ├── dashboard/     # Dashboard principal
    │       ├── transactions/  # Lista de transacciones
    │       ├── transfers/     # Gestión de transferencias
    │       ├── investments/   # Portfolio de inversiones
    │       ├── crowdlending/  # Inversiones crowdlending
    │       ├── matrix/        # Matriz temporal
    │       ├── quick-entry/   # Entrada rápida
    │       ├── banks/         # (Redirige a settings)
    │       └── settings/      # Configuración
    │           ├── banks/         # Gestión de bancos
    │           ├── import/        # Importación CSV
    │           ├── mapping-rules/ # Reglas de mapeo
    │           ├── backup/        # Backup y restore
    │           └── crowdlending-originators/
    │
    ├── components/            # Componentes React
    │   ├── TopAppBar.tsx      # Navegación lateral/bottom
    │   ├── AuthGuard.tsx      # Protección de rutas
    │   ├── DonutChart.tsx     # Gráfico de dona
    │   ├── BarChart.tsx       # Gráfico de barras
    │   ├── DashboardGrid.tsx  # Grid drag-and-drop
    │   ├── StatCard.tsx       # Tarjeta de métrica
    │   ├── ValueBlur.tsx      # Ocultar valores
    │   ├── TransactionsTable.tsx
    │   ├── ConceptCombobox.tsx
    │   ├── CsvImport.tsx
    │   └── ...
    │
    ├── lib/                   # Utilidades y servicios
    │   ├── prisma.ts          # Cliente Prisma singleton
    │   ├── auth.ts            # Config NextAuth
    │   ├── transfer-scheduler.ts
    │   ├── transfer-utils.ts
    │   ├── interest-scheduler.ts
    │   ├── backup-scheduler.ts
    │   ├── auto-topup.ts
    │   ├── redondeo.ts
    │   ├── backup.ts
    │   ├── backup-logs.ts
    │   └── ...
    │
    └── messages/              # Internacionalización (si aplica)
```

---

## 4. Modelos de Datos (Prisma Schema)

### Schema Completo

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"  // o "sqlite" en desarrollo
  url      = env("DATABASE_URL")
}

// ============================================
// BANCOS Y CUENTAS
// ============================================

model Bank {
  id            String         @id @default(uuid())
  bank_name     String         // Nombre del banco (Revolut, Caixa, etc.)
  account_label String         // Etiqueta principal (legacy)
  iban          String?        // IBAN principal (legacy)
  balance       Float          @default(0)  // Balance agregado de todas las cuentas
  created_at    DateTime       @default(now())
  
  accounts      Account[]
  transactions  Transaction[]
  mappingRules  MappingRule[]
}

model Account {
  id                 String         @id @default(uuid())
  bank_id            String
  bank               Bank           @relation(fields: [bank_id], references: [id])
  account_label      String         // Nombre de la cuenta (Cuenta Principal, Ahorro, etc.)
  iban               String?        // IBAN de la cuenta
  balance            Float          @default(0)
  is_default         Boolean        @default(false)  // Cuenta por defecto del banco
  
  // Configuración de intereses
  interest_rate      Float          @default(0)      // TAE en porcentaje (ej: 1.25)
  interest_period    String         @default("none") // none | daily | monthly
  last_interest_date DateTime?      // Última fecha de cálculo de intereses
  
  created_at         DateTime       @default(now())
  
  transactions       Transaction[]
  crowdlending_investments CrowdlendingInvestment[]
  holdings           InvestmentHolding[]
  transfersFrom      Transfer[]     @relation("TransfersFrom")
  transfersTo        Transfer[]     @relation("TransfersTo")
}

// ============================================
// TRANSACCIONES
// ============================================

model Transaction {
  id                         String    @id @default(uuid())
  timestamp                  DateTime  @default(now())
  concept                    String    // Descripción de la transacción
  amount                     Float     // Positivo = ingreso, Negativo = gasto
  
  bank_id                    String
  bank                       Bank      @relation(fields: [bank_id], references: [id])
  account_id                 String?
  account                    Account?  @relation(fields: [account_id], references: [id])
  
  group                      String    // Categoría (Gastos Ocio, Nómina, etc.)
  type                       String    // Fijo | Variable
  is_recurring               Boolean   @default(false)
  recurring_period           String?   // mensual | anual
  comentarios                String?
  
  // Referencias a otros módulos
  investment_transaction_id  String?
  crowdlending_investment_id String?
  transfer_id                String?
}

// ============================================
// TRANSFERENCIAS
// ============================================

model Transfer {
  id              String    @id @default(uuid())
  
  from_account_id String
  from_account    Account   @relation("TransfersFrom", fields: [from_account_id], references: [id])
  to_account_id   String
  to_account      Account   @relation("TransfersTo", fields: [to_account_id], references: [id])
  
  amount          Float
  concept         String
  timestamp       DateTime  @default(now())
  status          String    @default("pending")  // pending | completed | cancelled
  
  // Programación
  is_scheduled    Boolean   @default(false)
  frequency       String?   // diario | mensual | anual
  next_run        DateTime?
  end_date        DateTime?
  last_run        DateTime?
  enabled         Boolean   @default(true)
  
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt
  
  executions      TransferExecution[]
}

model TransferExecution {
  id                  String    @id @default(uuid())
  transfer_id         String
  transfer            Transfer  @relation(fields: [transfer_id], references: [id], onDelete: Cascade)
  
  executed_at         DateTime  @default(now())
  scheduled_for       DateTime? // Fecha programada (null si ya ejecutada)
  amount              Float
  
  // Snapshots de balance
  from_balance_before Float
  from_balance_after  Float
  to_balance_before   Float
  to_balance_after    Float
  
  status              String    @default("completed")  // completed | failed | scheduled
  error_message       String?
}

// ============================================
// INVERSIONES
// ============================================

model InvestmentInstrument {
  id                   String   @id @default(uuid())
  ticker               String?  @unique  // NYSE:AAPL, BME:IDR
  isin                 String?  @unique  // US5006881065
  name                 String
  type                 String             // STOCK | ETF | ETC | FUND | RIGHT
  currency             String   @default("EUR")
  current_price        Float?
  exchange_rate_to_eur Float?   @default(1)
  price_updated_at     DateTime?
  sector               String?
  created_at           DateTime @default(now())
  
  holdings             InvestmentHolding[]
  transactions         InvestmentTransaction[]
  lots                 InvestmentLot[]
}

model InvestmentHolding {
  id                      String   @id @default(uuid())
  instrument_id           String
  instrument              InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  account_id              String?
  account                 Account? @relation(fields: [account_id], references: [id])
  
  total_cantidad          Float    @default(0)
  total_invertido_original Float   @default(0)  // En divisa original
  total_invertido_eur     Float    @default(0)  // Convertido a EUR
  
  created_at              DateTime @default(now())
  updated_at              DateTime @default(now())
  
  transactions            InvestmentTransaction[]
  lots                    InvestmentLot[]
}

model InvestmentLot {
  id                  String   @id @default(uuid())
  holding_id          String?
  holding             InvestmentHolding? @relation(fields: [holding_id], references: [id])
  instrument_id       String
  instrument          InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  
  cantidad_original   Float    // Unidades compradas
  cantidad_restante   Float    // Unidades no vendidas (FIFO)
  precio_unitario     Float    // Precio de compra
  total_original      Float    // Total en divisa original
  total_eur           Float    // Total en EUR
  fecha_compra        DateTime
  divisa              String
  exchange_rate_compra Float
  
  created_at          DateTime @default(now())
}

model InvestmentTransaction {
  id                       String   @id @default(uuid())
  instrument_id            String
  instrument               InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  holding_id               String?
  holding                  InvestmentHolding? @relation(fields: [holding_id], references: [id])
  
  type                     String   // BUY | SELL | DIVIDEND
  cantidad                 Float
  precio_unitario          Float
  importe_total            Float    // En divisa original
  importe_eur              Float    // Convertido a EUR
  divisa                   String
  exchange_rate            Float
  date                     DateTime
  
  is_recurring             Boolean  @default(false)
  recurring_period         String?
  dividend_reinvested      Boolean  @default(false)
  
  // Plusvalías (solo SELL)
  plusvalia_realizada_orig Float?
  plusvalia_realizada_eur  Float?
  
  comentarios              String?
  created_transaction_id   String?  // ID de transacción bancaria asociada
  created_at               DateTime @default(now())
  
  // Campos para dividendos (IRPF)
  importe_bruto_orig       Float?
  importe_bruto_eur        Float?
  retencion_origen_pct     Float?   // % retención país origen
  retencion_origen_eur     Float?
  retencion_esp_pct        Float?   // % retención España (19%)
  retencion_esp_eur        Float?
  dividendo_por_titulo     Float?
}

// ============================================
// CROWDLENDING
// ============================================

model CrowdlendingInvestment {
  id                   String   @id @default(uuid())
  account_id           String?
  account              Account? @relation(fields: [account_id], references: [id])
  
  fecha_inicio         DateTime
  fecha_fin            DateTime?
  descripcion          String
  meses_iniciales      Int
  meses_extension      Int?
  cantidad             Float
  porcentaje_beneficio Float    // TAE esperada
  
  roi                  Float?
  beneficios_brutos    Float?
  impuestos            Float?
  beneficios_netos     Float?
  
  originador           String   // Nombre del originador (Urbanitae, etc.)
  tipo_shared          Boolean  @default(false)
  status               String   @default("ACTIVE")  // ACTIVE | EXTENDED | MATURED
  
  created_at           DateTime @default(now())
  payments             CrowdlendingPayment[]
}

model CrowdlendingPayment {
  id                     String                 @id @default(uuid())
  investment_id          String
  investment             CrowdlendingInvestment @relation(fields: [investment_id], references: [id])
  
  fecha                  DateTime
  importe                Float    // Total recibido
  intereses              Float    // Parte de intereses
  capital                Float    // Parte de capital devuelto
  
  created_transaction_id String?  // Transacción bancaria asociada
  comentarios            String?
  created_at             DateTime @default(now())
}

model Originator {
  id         String   @id @default(uuid())
  name       String   @unique
  created_at DateTime @default(now())
}

// ============================================
// CONFIGURACIÓN
// ============================================

model MappingRule {
  id              String  @id @default(uuid())
  pattern         String  // Patrón a buscar en concepto
  default_bank_id String?
  default_bank    Bank?   @relation(fields: [default_bank_id], references: [id])
  default_group   String  // Categoría por defecto
  default_type    String  // Fijo | Variable
}

model BackupSchedule {
  id          String    @id @default(uuid())
  name        String
  frequency   String    // daily | weekly | monthly
  dayOfWeek   Int?      // 0-6 (solo weekly)
  dayOfMonth  Int?      // 1-31 (solo monthly)
  time        String    // HH:mm formato 24h
  enabled     Boolean   @default(true)
  path        String?   // Sobreescribe ruta global
  lastRun     DateTime?
  nextRun     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  logs        BackupLog[]
}

model BackupLog {
  id         String          @id @default(uuid())
  scheduleId String?
  schedule   BackupSchedule? @relation(fields: [scheduleId], references: [id])
  filename   String
  filepath   String
  size       Int
  stats      String          // JSON con estadísticas
  createdAt  DateTime        @default(now())
}

model AutoTopupConfig {
  id                 String   @id @default("default")
  sourceBankName     String   @default("Caixa")
  targetBankName     String   @default("Revolut")
  threshold          Decimal  @default(100)
  amount             Decimal  @default(200)
  checkIntervalHours Int      @default(3)
  enabled            Boolean  @default(true)
  lastCheck          DateTime?
  updatedAt          DateTime @updatedAt
}

model RedondeoConfig {
  id                String   @id @default(uuid())
  enabled           Boolean  @default(false)
  target_account_id String   // Cuenta de ahorro destino
  multiplier        Int      @default(5)  // Factor multiplicador
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@map("RedondeoConfig")
}

model AppConfig {
  id                         String   @id @default("default")
  backupPath                 String   @default("/backups")
  investmentTargetAllocation String   @default("{}")  // JSON con objetivos
  budgetCategoryConfig       String   @default("{}")  // JSON config 50/30/20
  updatedAt                  DateTime @updatedAt
}
```

---

## 5. API REST

### Autenticación

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | Endpoints NextAuth.js |

### Bancos y Cuentas

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/banks` | GET | Listar bancos con cuentas |
| `/api/banks` | POST | Crear banco |
| `/api/banks/[id]` | PUT | Actualizar banco |
| `/api/banks/[id]` | DELETE | Eliminar banco |
| `/api/banks/recalc` | POST | Recalcular balances |
| `/api/accounts` | GET | Listar cuentas |
| `/api/accounts` | POST | Crear cuenta |
| `/api/accounts/[id]` | PUT | Actualizar cuenta |
| `/api/accounts/[id]` | DELETE | Eliminar cuenta |
| `/api/accounts/interest` | POST | Calcular interés manual |
| `/api/accounts/migrate` | POST | Migrar transacciones |

### Transacciones

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/transactions` | GET | Listar (paginado, filtros) |
| `/api/transactions` | POST | Crear transacción |
| `/api/transactions/[id]` | PUT | Actualizar |
| `/api/transactions/[id]` | DELETE | Eliminar |
| `/api/transactions/import/preview` | POST | Preview importación CSV |
| `/api/transactions/import/commit` | POST | Confirmar importación |
| `/api/transactions/batch-update` | POST | Actualizar múltiples |
| `/api/transactions/bulk-update-category` | POST | Cambiar categoría masivo |
| `/api/transactions/clear` | DELETE | Eliminar todas |
| `/api/transactions/years` | GET | Años disponibles |
| `/api/transactions/groups` | GET | Grupos/categorías |
| `/api/transactions/concepts` | GET | Conceptos únicos |
| `/api/transactions/common` | GET | Transacciones frecuentes |

### Transferencias

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/transfers` | GET | Listar transferencias |
| `/api/transfers` | POST | Crear transferencia |
| `/api/transfers/[id]` | GET | Obtener transferencia |
| `/api/transfers/[id]` | PUT | Actualizar |
| `/api/transfers/[id]` | DELETE | Eliminar |
| `/api/transfers/[id]/execute` | POST | Ejecutar manualmente |
| `/api/transfers/executions` | GET | Historial de ejecuciones |
| `/api/transfers/fix-monthly-dates` | POST | Corregir fechas mensuales |

### Inversiones

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/investments/summary` | GET | Resumen del portfolio |
| `/api/investments/holdings` | GET | Posiciones abiertas |
| `/api/investments/holdings/[id]` | DELETE | Eliminar holding |
| `/api/investments/instruments` | GET | Listar instrumentos |
| `/api/investments/instruments` | POST | Crear instrumento |
| `/api/investments/instruments/[id]` | PUT | Actualizar |
| `/api/investments/instruments/[id]` | DELETE | Eliminar |
| `/api/investments/instruments/lookup` | GET | Buscar en Yahoo Finance |
| `/api/investments/transactions` | GET | Listar operaciones |
| `/api/investments/transactions` | POST | Crear operación |
| `/api/investments/transactions/[id]` | DELETE | Eliminar |
| `/api/investments/transactions/import/preview` | POST | Preview importación |
| `/api/investments/transactions/import/commit` | POST | Confirmar importación |
| `/api/investments/dividends/import/preview` | POST | Preview dividendos |
| `/api/investments/dividends/import/commit` | POST | Confirmar dividendos |
| `/api/investments/update-prices` | POST | Actualizar precios |
| `/api/investments/goals` | GET/PUT | Objetivos de allocation |
| `/api/investments/clear` | DELETE | Limpiar todo |

### Crowdlending

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/investments/crowdlending` | GET | Listar inversiones |
| `/api/investments/crowdlending` | POST | Crear inversión |
| `/api/investments/crowdlending/summary` | GET | KPIs |
| `/api/investments/crowdlending/[id]` | GET | Obtener inversión |
| `/api/investments/crowdlending/[id]` | PUT | Actualizar |
| `/api/investments/crowdlending/[id]` | DELETE | Eliminar |
| `/api/investments/crowdlending/[id]/payments` | GET | Listar pagos |
| `/api/investments/crowdlending/[id]/payments` | POST | Crear pago |
| `/api/investments/crowdlending/[id]/payments/[pid]` | DELETE | Eliminar pago |
| `/api/crowdlending/originators` | GET | Listar originadores |
| `/api/crowdlending/originators` | POST | Crear originador |
| `/api/crowdlending/originators/[id]` | DELETE | Eliminar |

### Dashboard

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/dashboard/summary` | GET | Métricas anuales |
| `/api/dashboard/matrix` | GET | Matriz temporal |

### Configuración

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/mapping-rules` | GET | Listar reglas |
| `/api/mapping-rules` | POST | Crear regla |
| `/api/mapping-rules/[id]` | DELETE | Eliminar regla |
| `/api/mapping-rules/import` | POST | Importar CSV |
| `/api/mapping-rules/import/resolve` | POST | Resolver conflictos |
| `/api/mapping-rules/clear` | DELETE | Eliminar todas |
| `/api/categories` | GET | Categorías disponibles |
| `/api/infer` | POST | Inferir categoría |
| `/api/budget-categories` | GET/PUT | Config 50/30/20 |

### Backup

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/backup/config` | GET/PUT | Ruta global |
| `/api/backup/run` | POST | Ejecutar backup manual |
| `/api/backup/restore` | POST | Restaurar desde ZIP |
| `/api/backup/schedules` | GET | Listar programaciones |
| `/api/backup/schedules` | POST | Crear programación |
| `/api/backup/schedules/[id]` | PUT | Actualizar |
| `/api/backup/schedules/[id]` | DELETE | Eliminar |
| `/api/backup/schedules/[id]/run` | POST | Ejecutar ahora |
| `/api/backup/logs` | GET | Historial de backups |
| `/api/backup/logs/[id]/download` | GET | Descargar ZIP |

### Auto-topup y Redondeo

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/auto-topup/config` | GET/PUT | Configuración |
| `/api/auto-topup/execute` | POST | Ejecutar manualmente |
| `/api/redondeo/config` | GET/PUT | Configuración redondeo |

---

## 6. Componentes UI Principales

### Layout y Navegación

```typescript
// src/components/TopAppBar.tsx
// Barra lateral en desktop, bottom bar en mobile
// Iconos Material Symbols, navegación a todas las secciones
```

### Gráficos

```typescript
// src/components/DonutChart.tsx
// Gráfico de dona SVG con colores Material Design 3
// Props: data: {label, value, color}[], size, showLegend

// src/components/BarChart.tsx
// Gráfico de barras con línea de overlay
// Props: data: {label, income, expense}[], height
```

### Dashboard

```typescript
// src/components/DashboardGrid.tsx
// Grid drag-and-drop usando react-grid-layout
// Widgets configurables: balance, ahorro, gráficos, categorías
// Persiste layout en localStorage
```

### Tablas

```typescript
// src/components/TransactionsTable.tsx
// Tabla de transacciones con filtros, paginación, edición inline
// Selección múltiple para acciones batch
```

### Formularios

```typescript
// src/components/ConceptCombobox.tsx
// Autocomplete con historial de conceptos previos
// Muestra grupo y tipo sugerido basado en mapping rules

// src/components/CsvImport.tsx
// Importador CSV genérico con preview y confirmación
```

### Utilidades

```typescript
// src/components/StatCard.tsx
// Tarjeta de métrica con icono, valor, tendencia

// src/components/ValueBlur.tsx
// Oculta valores sensibles con blur (toggle global)
```

---

## 7. Funcionalidades Detalladas

### 7.1 Quick Entry

Formulario rápido para registrar transacciones:
- Concepto con autocomplete
- Monto (positivo = ingreso, negativo = gasto)
- Banco y cuenta
- Categoría con inferencia automática
- Tipo (Fijo/Variable)
- Fecha
- Comentarios opcionales

### 7.2 Auto-categorización

Sistema de mapping rules que infiere categoría basándose en patrones:
- Pattern matching en concepto
- Asociación banco -> categoría
- Tipo por defecto (Fijo/Variable)
- Importación masiva desde CSV

### 7.3 Dashboard Analítico

Métricas calculadas:
- **Balance total**: Suma de todos los bancos
- **Ingresos/Gastos**: Totales del período
- **Tasa de ahorro**: (Ingresos - Gastos) / Ingresos x 100
- **Velocidad de gasto**: Gasto diario promedio, proyección mensual
- **Salud financiera 50/30/20**: Necesidades/Deseos/Ahorro
- **Top categorías**: Ranking por importe

### 7.4 Transferencias Programadas

- **Frecuencias**: Diario, Mensual, Anual
- **Ejecución automática**: TransferScheduler cada 60 segundos
- **Catch-up**: Ejecuta transferencias atrasadas
- **Historial**: Balance antes/después de cada ejecución

### 7.5 Intereses Automáticos

Cuentas con TAE configurado:
- Cálculo diario o mensual
- Retención IRPF 19% automática
- Actualización de balance y última fecha

### 7.6 Inversiones

- **Holdings**: Posiciones abiertas con valor actual
- **Lotes FIFO**: Seguimiento de compras individuales
- **Operaciones**: BUY, SELL (con plusvalía), DIVIDEND
- **Lookup Yahoo Finance**: Búsqueda por ticker/ISIN
- **Actualización de precios**: Desde Yahoo Finance

### 7.7 Crowdlending

- **Estados**: ACTIVE, EXTENDED, MATURED
- **Pagos**: Registro de intereses y capital
- **KPIs**: Capital pendiente, intereses cobrados, ROI medio
- **Integración**: Crea transacciones bancarias automáticamente

### 7.8 Redondeo

Cuando se registra un gasto en Revolut:
- Calcula: (ceil(gasto) - gasto) x multiplicador
- Transfiere a cuenta de ahorro configurada
- Crea dos transacciones (débito y crédito)

### 7.9 Auto-Topup

Cuando el balance de Revolut baja del umbral:
- Verifica cada N horas (configurable)
- Transfiere desde banco origen configurado
- Evita duplicados (no crea si hay pendiente)

### 7.10 Backup y Restore

- **Formato**: ZIP con backup.json
- **Versión**: 2.0
- **Contenido**: Todos los modelos de la base de datos
- **Programación**: Diario, semanal, mensual (node-cron)
- **Almacenamiento**: Volumen Docker /backups

---

## 8. Servicios Background (Schedulers)

### TransferScheduler

```typescript
// src/lib/transfer-scheduler.ts
class TransferScheduler {
  // Intervalo: cada 60 segundos
  // Función: Ejecuta transferencias pendientes (next_run <= now)
  // Catch-up: Ejecuta en bucle si hay atrasadas
  
  init(): void;
  stop(): void;
  processPending(): Promise<void>;
  register(transferId: string): Promise<void>;
  unregister(transferId: string): void;
}

export const transferScheduler = new TransferScheduler();
```

### InterestScheduler

```typescript
// src/lib/interest-scheduler.ts
class InterestScheduler {
  // Intervalo: cada 5 minutos
  // Función: Crea/actualiza transfers de interés para cuentas con TAE
  // Limpieza: Desactiva transfers huérfanos
  
  init(): void;
  stop(): void;
  ensureTransfersExist(): Promise<void>;
}

export const interestScheduler = new InterestScheduler();
```

### BackupScheduler

```typescript
// src/lib/backup-scheduler.ts
class BackupScheduler {
  // Motor: node-cron
  // Frecuencias: daily, weekly, monthly
  // Log: Registra cada backup en BackupLog
  
  init(): void;
  loadAll(): Promise<void>;
  register(schedule: BackupSchedule): void;
  unregister(id: string): void;
  reload(): Promise<void>;
}

export const backupScheduler = new BackupScheduler();
```

### AutoTopupManager

```typescript
// src/lib/auto-topup.ts
class AutoTopupManager {
  // Intervalo: configurable (default 3h), alineado a hora exacta
  // Función: Si Revolut < threshold, transfiere desde Caixa
  
  init(): Promise<void>;
  stop(): void;
  restart(): Promise<void>;
  checkAndTopup(): Promise<void>;
}

export const autoTopupManager = new AutoTopupManager();
```

### Redondeo

```typescript
// src/lib/redondeo.ts
// Función que se ejecuta al crear transacción de gasto
export async function processRedondeo(
  amount: number,    // Monto del gasto (negativo)
  bankId: string,    // ID del banco
  accountId: string  // ID de la cuenta
): Promise<void>;

// Lógica:
// 1. Solo gastos (amount < 0) en Revolut cuenta default
// 2. Calcula: (ceil(abs(amount)) - abs(amount)) x multiplier
// 3. Crea transacción de débito en cuenta origen
// 4. Crea transacción de crédito en cuenta destino
// 5. Actualiza balances de cuentas y bancos
```

---

## 9. Configuración

### Variables de Entorno (.env)

```bash
# Base de datos
DATABASE_URL="postgresql://postgres:changeme@db:5432/wealth_manager"
DB_PASSWORD="changeme"

# Autenticación
NEXTAUTH_SECRET="generate-a-random-secret-here"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_USER="admin"
ADMIN_PASSWORD="changeme"

# Auto-topup (cuando Revolut < threshold, transfiere desde Caixa)
TOPUP_SOURCE_BANK="Caixa"
TOPUP_TARGET_BANK="Revolut"
TOPUP_THRESHOLD=100
TOPUP_AMOUNT=200

# API Token para acceso programático
# Generar con: openssl rand -hex 32
API_TOKEN=""
```

### docker-compose.yml

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: wealth_manager
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: .
    restart: unless-stopped
    ports:
      - "0.0.0.0:3000:3000"
    volumes:
      - backups:/backups
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD:-changeme}@db:5432/wealth_manager
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://192.168.1.13:3000}
      ADMIN_USER: ${ADMIN_USER:-admin}
      ADMIN_PASSWORD: ${ADMIN_PASSWORD:-admin}
      TOPUP_SOURCE_BANK: ${TOPUP_SOURCE_BANK:-Caixa}
      TOPUP_TARGET_BANK: ${TOPUP_TARGET_BANK:-Revolut}
      TOPUP_THRESHOLD: ${TOPUP_THRESHOLD:-100}
      TOPUP_AMOUNT: ${TOPUP_AMOUNT:-200}
      API_TOKEN: ${API_TOKEN:-}

volumes:
  pgdata:
  backups:
```

### Dockerfile

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY prisma/schema.postgres.prisma prisma/schema.prisma
RUN npx prisma generate
RUN npm run build
RUN npm install -g prisma

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libssl3 openssl
RUN ln -sf /usr/lib/libssl.so.3 /usr/lib/libssl.so.1.1
RUN ln -sf /usr/lib/libcrypto.so.3 /usr/lib/libcrypto.so.1.1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/scripts ./scripts

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma@5.22.0 db push --skip-generate --accept-data-loss && node scripts/startup-check.mjs && node server.js"]
```

### tailwind.config.ts

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#10131a",
          dim: "#10131a",
          bright: "#363941",
          container: {
            lowest: "#0b0e15",
            low: "#191b23",
            DEFAULT: "#1d2027",
            high: "#272a31",
            highest: "#32353c",
          },
        },
        "on-surface": {
          DEFAULT: "#e1e2ec",
          variant: "#c2c6d6",
        },
        primary: {
          DEFAULT: "#adc6ff",
          on: "#002e6a",
          container: "#4d8eff",
          "on-container": "#00285d",
        },
        secondary: {
          DEFAULT: "#b9c8de",
          on: "#233143",
          container: "#39485a",
          "on-container": "#a7b6cc",
        },
        tertiary: {
          DEFAULT: "#ffb786",
          on: "#502400",
          container: "#df7412",
          "on-container": "#461f00",
        },
        error: {
          DEFAULT: "#ffb4ab",
          on: "#690005",
          container: "#93000a",
          "on-container": "#ffdad6",
        },
        positive: "#10B981",
        critical: "#F59E0B",
      },
      fontFamily: {
        geist: ["Geist", "sans-serif"],
        mono: ["Geist", "monospace"],
      },
      fontSize: {
        "display-lg": ["32px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "-0.02em" }],
        "headline-md": ["20px", { lineHeight: "1.4", fontWeight: "600", letterSpacing: "-0.01em" }],
        "body-md": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "1.4", fontWeight: "400" }],
        "label-caps": ["11px", { lineHeight: "1", fontWeight: "700", letterSpacing: "0.05em" }],
        "data-mono": ["14px", { lineHeight: "1", fontWeight: "500" }],
      },
      borderRadius: {
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.75rem",
      },
      spacing: {
        base: "4px",
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        gutter: "12px",
        "container-margin": "16px",
      },
    },
  },
  plugins: [],
};

export default config;
```

---

## 10. Instrucciones de Despliegue

### Desarrollo Local (SQLite)

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd wealth-manager

# 2. Instalar dependencias
npm install

# 3. Configurar variables
cp .env.example .env
# Editar DATABASE_URL a: file:./db/wealth.db

# 4. Generar Prisma Client
npx prisma generate

# 5. Crear base de datos
npx prisma db push

# 6. Iniciar servidor de desarrollo
npm run dev

# Acceder a http://localhost:3000
```

### Producción con Docker

```bash
# 1. Configurar variables
cp .env.example .env
# Editar variables para producción:
# - NEXTAUTH_SECRET (generar: openssl rand -hex 32)
# - DB_PASSWORD
# - ADMIN_PASSWORD
# - NEXTAUTH_URL (URL pública)

# 2. Construir y levantar
docker compose up -d --build

# 3. Verificar logs
docker compose logs -f app

# 4. Acceder a http://localhost:3000 (o IP del servidor)
```

### Migración SQLite a PostgreSQL

1. El schema principal es `schema.prisma` (SQLite)
2. El Dockerfile copia `schema.postgres.prisma` sobre `schema.prisma`
3. `prisma db push` al iniciar aplica schema a PostgreSQL
4. Para migrar datos, usar backup/restore:
   - Exportar backup desde SQLite
   - Restaurar en PostgreSQL

### Comandos Útiles

```bash
# Ver logs
docker compose logs -f app

# Reiniciar aplicación
docker compose restart app

# Reconstruir sin cache
docker compose build --no-cache app && docker compose up -d app

# Ejecutar comando en contenedor
docker compose exec app sh

# Acceder a PostgreSQL
docker compose exec db psql -U postgres -d wealth_manager

# Backup manual
docker compose exec app node -e "require('./lib/backup').createBackup()"
```

---

## 11. Integraciones Externas

### Yahoo Finance (sin API key)

```typescript
// Endpoint: /api/investments/instruments/lookup?q=AAPL

// Búsqueda de instrumentos por ticker o ISIN
// Retorna: ticker, isin, nombre, precio, tipo de cambio

// Actualización de precios
// POST /api/investments/update-prices
// Obtiene precios actuales desde Yahoo Finance
```

### NextAuth.js Credentials Provider

```typescript
// src/lib/auth.ts
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials?.username === process.env.ADMIN_USER &&
          credentials?.password === process.env.ADMIN_PASSWORD
        ) {
          return { id: "1", name: "Admin" };
        }
        return null;
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
};
```

### API Token para Acceso Externo

```typescript
// Header: Authorization: Bearer <token>
// O: X-API-Key: <token>

// Las transacciones creadas via API se marcan con [API] en comentarios
// Ejemplo:
POST /api/transactions
Headers: { "X-API-Key": "your-token" }
Body: { concept: "Compra", amount: -50, ... }
```

---

## 12. Sistema de Diseño

### Colores (Material Design 3 Dark)

| Token | Valor | Uso |
|-------|-------|-----|
| `surface` | #10131a | Fondo principal |
| `surface-container` | #1d2027 | Contenedores, cards |
| `on-surface` | #e1e2ec | Texto principal |
| `on-surface-variant` | #c2c6d6 | Texto secundario |
| `primary` | #adc6ff | Acciones principales |
| `secondary` | #b9c8de | Acciones secundarias |
| `tertiary` | #ffb786 | Acentos, warnings |
| `error` | #ffb4ab | Errores |
| `positive` | #10B981 | Ingresos, éxito |
| `critical` | #F59E0B | Alertas |

### Tipografía

| Clase | Tamaño | Peso | Uso |
|-------|--------|------|-----|
| `display-lg` | 32px | 600 | Títulos principales |
| `headline-md` | 20px | 600 | Subtítulos |
| `body-md` | 14px | 400 | Texto general |
| `body-sm` | 13px | 400 | Texto pequeño |
| `label-caps` | 11px | 700 | Labels, badges |
| `data-mono` | 14px | 500 | Números, datos |

### Iconos

Material Symbols Outlined (via CDN):
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" />
```

Uso:
```html
<span className="material-symbols-outlined">dashboard</span>
```

### Responsive Design

- **Mobile**: Bottom navigation, cards stack
- **Desktop**: Sidebar navigation, grid layouts
- Breakpoints Tailwind estándar (sm, md, lg, xl)

---

## Notas Finales

### Requisitos del Sistema

- Node.js 20+
- PostgreSQL 16+ (producción) o SQLite (desarrollo)
- Docker y Docker Compose (para despliegue)

### Seguridad

- Autenticación obligatoria en todas las rutas
- API Token para acceso programático
- Variables sensibles solo en .env
- HTTPS recomendado en producción

### Mantenimiento

- Backups automáticos recomendados (diario)
- Actualizar precios de inversiones regularmente
- Revisar logs de schedulers periódicamente

---

*Documento generado para replicación del proyecto Wealth Manager (Gestor Patrimonial)*
