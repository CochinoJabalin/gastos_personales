# Módulo de Inversiones — Plan de Implementación

## Modelo de Datos (Prisma)

### Esquema para `schema.prisma` (SQLite)

```prisma
model InvestmentInstrument {
  id                String   @id @default(uuid())
  ticker            String   @unique
  name              String
  type              String   // STOCK | ETF | FUND
  currency          String   @default("EUR")
  current_price     Float?
  exchange_rate_to_eur Float? @default(1)
  price_updated_at  DateTime?
  sector            String?
  created_at        DateTime @default(now())
  holdings          InvestmentHolding[]
  transactions      InvestmentTransaction[]
  lots              InvestmentLot[]
}

model InvestmentHolding {
  id                   String   @id @default(uuid())
  instrument_id        String
  instrument           InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  account_id           String?
  account              Account? @relation(fields: [account_id], references: [id])
  total_cantidad       Float    @default(0)
  total_invertido_original Float @default(0)
  total_invertido_eur  Float    @default(0)
  created_at           DateTime @default(now())
  updated_at           DateTime @default(now())
  transactions         InvestmentTransaction[]
  lots                 InvestmentLot[]
}

model InvestmentLot {
  id                String   @id @default(uuid())
  holding_id        String?
  holding           InvestmentHolding? @relation(fields: [holding_id], references: [id])
  instrument_id     String
  instrument        InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  cantidad_original Float
  cantidad_restante Float
  precio_unitario   Float    // en divisa del instrumento
  total_original    Float    // cantidad_original * precio_unitario (en divisa original)
  total_eur         Float    // total_original convertido a EUR al cambio de compra
  fecha_compra      DateTime
  divisa            String   // divisa del instrumento en el momento de la compra
  exchange_rate_compra Float // tipo de cambio EUR/{divisa} en la fecha de compra
  created_at        DateTime @default(now())
}

model InvestmentTransaction {
  id                    String   @id @default(uuid())
  instrument_id         String
  instrument            InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  holding_id            String?
  holding               InvestmentHolding? @relation(fields: [holding_id], references: [id])
  type                  String   // BUY | SELL | DIVIDEND
  cantidad              Float    // positiva para BUY/DIVIDEND, negativa para SELL
  precio_unitario       Float
  importe_total         Float    // cantidad * precio_unitario (en divisa original)
  importe_eur           Float    // importe_total convertido a EUR
  divisa                String
  exchange_rate         Float    // tipo de cambio EUR/{divisa} en la fecha de la operación
  date                  DateTime
  is_recurring          Boolean  @default(false)
  recurring_period      String?  // mensual | anual
  dividend_reinvested   Boolean  @default(false)
  plusvalia_realizada_orig Float?  // para SELL: ganancia/pérdida en divisa original
  plusvalia_realizada_eur  Float?  // para SELL: ganancia/pérdida en EUR
  comentarios           String?
  created_transaction_id String?  // enlace a la Transaction del sistema principal (para BANK)
  created_at            DateTime @default(now())
}
```

### Esquema para `schema.postgres.prisma` (PostgreSQL)

Mismos modelos, usando `Decimal` en lugar de `Float`:

```prisma
model InvestmentInstrument {
  id                String    @id @default(uuid())
  ticker            String    @unique
  name              String
  type              String    // STOCK | ETF | FUND
  currency          String    @default("EUR")
  current_price     Decimal?
  exchange_rate_to_eur Decimal? @default(1)
  price_updated_at  DateTime?
  sector            String?
  created_at        DateTime  @default(now())
  holdings          InvestmentHolding[]
  transactions      InvestmentTransaction[]
  lots              InvestmentLot[]
}

model InvestmentHolding {
  id                   String   @id @default(uuid())
  instrument_id        String
  instrument           InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  account_id           String?
  account              Account? @relation(fields: [account_id], references: [id])
  total_cantidad       Decimal  @default(0)
  total_invertido_original Decimal @default(0)
  total_invertido_eur  Decimal  @default(0)
  created_at           DateTime @default(now())
  updated_at           DateTime @default(now())
  transactions         InvestmentTransaction[]
  lots                 InvestmentLot[]
}

model InvestmentLot {
  id                String   @id @default(uuid())
  holding_id        String?
  holding           InvestmentHolding? @relation(fields: [holding_id], references: [id])
  instrument_id     String
  instrument        InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  cantidad_original Decimal
  cantidad_restante Decimal
  precio_unitario   Decimal
  total_original    Decimal
  total_eur         Decimal
  fecha_compra      DateTime
  divisa            String
  exchange_rate_compra Decimal
  created_at        DateTime @default(now())
}

model InvestmentTransaction {
  id                    String   @id @default(uuid())
  instrument_id         String
  instrument            InvestmentInstrument @relation(fields: [instrument_id], references: [id])
  holding_id            String?
  holding               InvestmentHolding? @relation(fields: [holding_id], references: [id])
  type                  String   // BUY | SELL | DIVIDEND
  cantidad              Decimal
  precio_unitario       Decimal
  importe_total         Decimal
  importe_eur           Decimal
  divisa                String
  exchange_rate         Decimal
  date                  DateTime
  is_recurring          Boolean  @default(false)
  recurring_period      String?
  dividend_reinvested   Boolean  @default(false)
  plusvalia_realizada_orig Decimal?
  plusvalia_realizada_eur  Decimal?
  comentarios           String?
  created_transaction_id String?
  created_at            DateTime @default(now())
}
```

### Modificación del modelo `Transaction` existente

Añadir campo opcional para enlazar operaciones de inversión con el libro de banco:

```prisma
model Transaction {
  // ... campos existentes ...
  investment_transaction_id String?   // ← NUEVO
}
```

---

## API Routes

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/investments/instruments` | GET | Listar todos los instrumentos |
| `/api/investments/instruments` | POST | Crear nuevo instrumento |
| `/api/investments/instruments/[id]` | GET | Obtener instrumento |
| `/api/investments/instruments/[id]` | PUT | Actualizar instrumento (ticker, nombre, tipo, divisa, precio manual) |
| `/api/investments/instruments/[id]` | DELETE | Eliminar instrumento |
| `/api/investments/holdings` | GET | Listar holdings con datos del instrumento y resumen (cantidad, invertido, valor actual, plusvalía no realizada) |
| `/api/investments/holdings/[id]` | GET | Detalle de holding con lotes y transacciones |
| `/api/investments/transactions` | GET | Historial de transacciones con filtros (tipo, instrumento, fecha) |
| `/api/investments/transactions` | POST | Registrar operación (BUY/SELL/DIVIDEND) con lógica FIFO y efectos bancarios |
| `/api/investments/transactions/[id]` | DELETE | Eliminar transacción (con reversión de efectos) |
| `/api/investments/summary` | GET | KPIs del portfolio: valor total, invertido total, rentabilidad total, rentabilidad realizada, dividendos anuales, yield, asignación por tipo, plusvalías no realizadas |
| `/api/investments/update-prices` | POST | Actualizar cotizaciones vía Yahoo Finance para todos los instrumentos |

### Efectos secundarios al crear transacciones (`POST /api/investments/transactions`)

| Tipo | Efecto en holding | Efecto en banco | Efecto en Transaction |
|---|---|---|---|
| **BUY** | Actualiza `total_cantidad`, `total_invertido`. Crea `InvestmentLot` con cantidad, precio y cambio. | Descuenta `importe_eur` del saldo de la `Account` vinculada. | Crea una `Transaction` con amount negativo, grupo "Inversión", tipo "Variable". |
| **SELL** | Consume lotes por FIFO (los más antiguos primero). Reduce `total_cantidad` y `total_invertido`. Calcula `plusvalia_realizada_orig` y `plusvalia_realizada_eur`. Lote a 0 se elimina. | Ingresa `importe_eur` en la `Account` vinculada. | Crea una `Transaction` con amount positivo, grupo "Inversión", tipo "Variable". La transacción incluye la plusvalía en comentarios. |
| **DIVIDEND` (no reinvested)`** | Sin efecto en cantidad. | Ingresa `importe_eur` en la `Account` vinculada. | Crea una `Transaction` con amount positivo, grupo "Dividendos", tipo "Variable". |
| **DIVIDEND` (reinvested)`** | Aumenta `total_cantidad` según importe/precio. Crea lote (si se especifica precio). | Sin efecto bancario. | No se crea Transaction. |

---

## Ejemplo FIFO con multidivisa

### Datos iniciales

- **Instrumento**: AAPL (divisa USD)
- **EUR/USD hoy**: 1.10

| Operación | Detalle | Cambio EUR/USD |
|---|---|---|
| Compra 50u a 150 USD | Lote 1: 50u, precio 150 USD, total 7.500 USD → 6.818,18 EUR | 1.10 |
| Compra 30u a 180 USD | Lote 2: 30u, precio 180 USD, total 5.400 USD → 4.909,09 EUR | 1.10 |

Estado:

| Lote | Cantidad original | Cantidad restante | Precio unitario (USD) | Total (USD) | Total (EUR) |
|---|---|---|---|---|---|
| 1 | 50 | 50 | 150 | 7.500 | 6.818,18 |
| 2 | 30 | 30 | 180 | 5.400 | 4.909,09 |

### Venta: 60u a 200 USD (cambio EUR/USD = 1.05)

Cálculo FIFO:

1. **Consume 50u del Lote 1** (150 USD c/u):
   - Plusvalía = 50 × (200 − 150) = 2.500 USD → 2.380,95 EUR (a 1.05)
   - Lote 1 eliminado (restante = 0)

2. **Consume 10u del Lote 2** (180 USD c/u):
   - Plusvalía = 10 × (200 − 180) = 200 USD → 190,48 EUR (a 1.05)
   - Lote 2 restante = 20u

3. **Resultado**:
   - Plusvalía total: 2.700 USD → 2.571,43 EUR
   - Ingreso en cuenta: 60 × 200 USD = 12.000 USD → 11.428,57 EUR
   - Transaction creada: amount = +11.428,57 EUR, grupo "Inversión"

Estado final:

| Lote | Cantidad original | Cantidad restante | Precio (USD) | Total (USD) | Total (EUR) |
|---|---|---|---|---|---|
| 2 | 30 | 20 | 180 | 3.600 | 3.272,73 |

---

## Página de Inversiones (`/investments`)

Página única con sub-tabs. Estilo similar a `/settings`:

```
┌──────────────────────────────────────────────────────┐
│  Portfolio │ Holdings │ Dividendos │ Operaciones      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  (contenido dinámico según pestaña activa)           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Pestaña: Portfolio

- **KPIs principales** (StatCards):
  - Valor total del portfolio (EUR)
  - Total invertido (EUR)
  - Rentabilidad total: (valor_actual + dividendos − invertido) / invertido
  - Rentabilidad realizada: plusvalías_cerradas / invertido_cerrado
  - Dividendos anuales (EUR)
  - Dividend yield: dividendos_anuales / invertido_total
  - Plusvalías no realizadas: (precio_actual − precio_medio) × cantidad

- **Gráfico de asignación** (DonutChart):
  - Por tipo (STOCK vs ETF vs FUND)
  - Por instrumento (top holdings)

- **Tabla resumen**:
  | Ticker | Nombre | Tipo | Cantidad | Precio Medio | Precio Actual | Valor | Plusvalía no realizada | Peso |

### Pestaña: Holdings

- Tabla detalle de cada holding:
  | Ticker | Nombre | Cantidad | Precio Medio | Precio Actual | Valor (EUR) | Invertido (EUR) | Plusvalía no realizada | ROI | Última actualización |
- Botón "Actualizar precios" → llama a `POST /api/investments/update-prices`
- Al hacer clic en un holding → modal/expandible con sus lotes FIFO

### Pestaña: Dividendos

- KPIs: Total dividendos año actual, yield cartera, yield por instrumento
- Historial de dividendos:
  | Fecha | Instrumento | Cantidad | Precio | Total (divisa) | Total (EUR) | Reinvertido |
- Totales agrupados por instrumento y por año

### Pestaña: Operaciones

- **Registro de nueva operación** (formulario):
  - Instrumento (selector/autocomplete con los existentes + opción "nuevo")
  - Tipo: Compra | Venta | Dividendo
  - Fecha
  - Cantidad
  - Precio unitario
  - Divisa (precargada del instrumento)
  - Tipo de cambio (precargado o manual)
  - Cuenta bancaria vinculada (selector)
  - Recurrente: No | Mensual | Anual (solo para compras)
  - Dividendo reinvertido: Sí/No (solo para dividendos)
  - Comentarios

- **Historial de operaciones** (tabla):
  | Fecha | Instrumento | Tipo | Cantidad | Precio | Total (divisa) | Total (EUR) | Plusvalía | Recurrente | Banco | Acciones |
  - Acciones: editar/eliminar (con confirmación y reversión)

- Para compras recurrentes, botón "Repetir ahora" que crea una nueva operación idéntica con la fecha actual

---

## Cotizaciones Automáticas (Yahoo Finance)

Endpoint: `POST /api/investments/update-prices`

Para cada instrumento con `ticker` definido:

1. Fetch a `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d`
2. Extraer `current_price` y convertirlo a número
3. Si la divisa del instrumento no es EUR, obtener también el tipo de cambio:
   - Fetch a `https://query1.finance.yahoo.com/v8/finance/chart/{divisa}EUR=X?interval=1d&range=1d`
4. Actualizar `InvestmentInstrument.current_price`, `exchange_rate_to_eur`, `price_updated_at`

---

## Navegación

En `src/components/TopAppBar.tsx`, añadir al array `navItems`:

```ts
{ href: "/investments", label: "Inversiones", icon: "trending_up" },
```

## Traducciones

En `src/messages/es.json`, añadir bloque:

```json
"investments": {
  "title": "Inversiones",
  "portfolio": "Portfolio",
  "holdings": "Holdings",
  "dividends": "Dividendos",
  "operations": "Operaciones",
  "total_value": "Valor Total",
  "total_invested": "Total Invertido",
  "total_return": "Rentabilidad Total",
  "realized_return": "Rentabilidad Realizada",
  "annual_dividends": "Dividendos Anuales",
  "dividend_yield": "Dividend Yield",
  "unrealized_gains": "Plusvalías No Realizadas",
  "ticker": "Ticker",
  "name": "Nombre",
  "type": "Tipo",
  "quantity": "Cantidad",
  "avg_price": "Precio Medio",
  "current_price": "Precio Actual",
  "value": "Valor",
  "weight": "Peso",
  "profit_loss": "Plusvalía/Minvalía",
  "roi": "ROI",
  "buy": "Compra",
  "sell": "Venta",
  "dividend": "Dividendo",
  "recurring": "Recurrente",
  "monthly": "Mensual",
  "annual": "Anual",
  "reinvested": "Reinvertido",
  "new_operation": "Nueva Operación",
  "register": "Registrar",
  "update_prices": "Actualizar Precios",
  "last_updated": "Última actualización",
  "dividend_history": "Historial de Dividendos",
  "operation_history": "Historial de Operaciones",
  "repeat_operation": "Repetir ahora",
  "confirm_delete": "¿Eliminar esta operación? Se revertirán los efectos en el holding y la cuenta bancaria.",
  "confirm_delete_title": "Eliminar operación",
  "lots": "Lotes",
  "fifo_detail": "Detalle FIFO",
  "realized_result": "Resultados Realizados",
  "no_instruments": "Aún no hay instrumentos. Crea tu primera operación.",
  "no_holdings": "No hay posiciones abiertas.",
  "no_dividends": "No hay dividendos registrados.",
  "no_transactions": "No hay operaciones registradas.",
  "exchange_rate": "Tipo de Cambio",
  "currency": "Divisa",
  "original_amount": "Importe Original",
  "amount_eur": "Importe (EUR)"
}
```

---

## Resumen de pasos de implementación

1. Añadir modelos a `schema.prisma` y `schema.postgres.prisma`
2. Añadir campo `investment_transaction_id` al modelo `Transaction`
3. Ejecutar `npx prisma migrate dev`
4. Crear API routes en `src/app/api/investments/` (instruments, holdings, transactions, summary, update-prices)
5. Crear componente `InvestmentsPage` en `src/app/(dashboard)/investments/page.tsx`
6. Crear componentes internos: PortfolioTab, HoldingsTab, DividendsTab, OperationsTab
7. Añadir lógica FIFO en el endpoint de transacciones
8. Añadir lógica de vinculación bancaria (crear/deshacer Transaction)
9. Integrar Yahoo Finance para actualización de precios
10. Añadir navegación en TopAppBar
11. Añadir traducciones en es.json
12. Probar flujo completo
