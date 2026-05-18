# Módulo de Crownlending Inmobiliario — Plan de Implementación

## Modelo de Datos (Prisma)

### Esquema para `schema.prisma` (SQLite)

```prisma
model CrowdlendingInvestment {
  id                  String   @id @default(uuid())
  account_id          String?
  account             Account? @relation(fields: [account_id], references: [id])
  fecha_inicio        DateTime
  fecha_fin           DateTime?
  descripcion         String
  meses_iniciales     Int
  meses_extension     Int?
  cantidad            Float
  porcentaje_beneficio Float   // TAE anual (ej: 8.5)
  roi                 Float?   // calculado al finalizar
  beneficios_brutos   Float?   // calculado al finalizar
  impuestos           Float?   // 19% fijo
  beneficios_netos    Float?   // calculado al finalizar
  originador          String   // WECITY | DOMOBLOCK | URBANITAE
  tipo_shared         Boolean  @default(false)
  status              String   @default("ACTIVE") // ACTIVE | EXTENDED | MATURED
  created_at          DateTime @default(now())
  payments            CrowdlendingPayment[]
}

model CrowdlendingPayment {
  id                  String   @id @default(uuid())
  investment_id       String
  investment          CrowdlendingInvestment @relation(fields: [investment_id], references: [id])
  fecha               DateTime
  importe             Float    // total cobrado en este pago
  intereses           Float    // parte correspondiente a intereses
  capital             Float    // parte correspondiente a devolución de capital (amortización parcial)
  created_transaction_id String?
  comentarios         String?
  created_at          DateTime @default(now())
}
```

### Esquema para `schema.postgres.prisma` (PostgreSQL)

Mismos modelos con `Decimal` en lugar de `Float`.

### Modificación del modelo `Transaction` existente

```prisma
model Transaction {
  // ... campos existentes ...
  investment_transaction_id String?   // ← ya añadido para inversiones en acciones/ETF
  crowdlending_investment_id String?  // ← nuevo para crownlending
}
```

---

## API Routes

| Endpoint | Método | Propósito |
|---|---|---|
| `/api/investments/crowdlending` | GET | Listar inversiones con filtros (originador, status, fecha) |
| `/api/investments/crowdlending` | POST | Crear nueva inversión (descuenta de cuenta bancaria) |
| `/api/investments/crowdlending/[id]` | PUT | Actualizar inversión (ej. añadir extensión, cambiar estado) |
| `/api/investments/crowdlending/[id]` | DELETE | Eliminar inversión (con reversión bancaria) |
| `/api/investments/crowdlending/[id]/payments` | GET | Listar pagos de una inversión |
| `/api/investments/crowdlending/[id]/payments` | POST | Registrar pago (interés, capital o ambos) |
| `/api/investments/crowdlending/[id]/payments/[pid]` | DELETE | Eliminar pago (reversión bancaria) |
| `/api/investments/crowdlending/summary` | GET | KPIs: total invertido, capital pendiente, total retornado, intereses cobrados, beneficios netos, rentabilidad media |

### Efectos secundarios

| Acción | Efecto en banco | Transaction creada |
|---|---|---|
| Crear inversión | Descuenta `cantidad` del saldo de la `Account` | amount = -`cantidad`, grupo "Inversión" |
| Registrar pago | Ingresa `importe` en la `Account` | amount = +`importe`, grupo "Inversión", comentarios "Intereses: X€ / Capital: Y€" |
| Finalizar inversión (MATURED) | Calcula `roi`, `beneficios_brutos`, `impuestos`, `beneficios_netos` | — (los pagos ya registraron los ingresos) |

---

## Cálculos automáticos

Al finalizar la inversión (status → `MATURED`):

```
meses_totales = meses_iniciales + (meses_extension ?? 0)
intereses_cobrados = SUM(payments.intereses)
capital_devuelto  = SUM(payments.capital)

beneficios_brutos = intereses_cobrados
impuestos         = beneficios_brutos * 0.19   // fijo 19%
beneficios_netos  = beneficios_brutos - impuestos
roi               = (beneficios_netos / cantidad) * 100
```

### Seguimiento en tiempo real

```
capital_pendiente   = cantidad - SUM(payments.capital)
intereses_pendientes = (cantidad * (porcentaje_beneficio / 100) * (meses_totales / 12)) - SUM(payments.intereses)
total_retornado     = SUM(payments.importe)
total_esperado      = cantidad + (cantidad * (porcentaje_beneficio / 100) * (meses_totales / 12))
```

---

## Sub-tab en /investments

Quinto sub-tab: **Crowdlending**

### Layout

```
┌────────────────────────────────────────────────────────────┐
│ Portfolio │ Holdings │ Dividendos │ Operaciones │ Crowdlending │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─ Resumen ────────────────────────────────────────────┐  │
│  │ Invertido: XX€ │ Pendiente: XX€ │ Retornado: XX€    │  │
│  │ Intereses cobr.: XX€ │ Bº Neto: XX€ │ ROI medio: X% │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Filtros ────────────────────────────────────────────┐  │
│  │ [Todos | Activas | Finalizadas] [Originador: ▼]     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─ Tabla de inversiones ───────────────────────────────┐  │
│  │ Descripción | Originador | Inicio | Plazo | Cantidad │  │
│  │ % TAE | Estado | Pendiente | ROI | Acciones         │  │
│  │──────────────────────────────────────────────────────│  │
│  │ Proyecto A  | Urbanitae | 01/24 | 24m | 5.000€      │  │
│  │ 8.5% | ACT | 3.200€ | — | [Pagos] [Editar]         │  │
│  │ ...                                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                            │
│  [+ Nueva Inversión]                                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Modal de detalle de inversión

Al hacer clic en una fila o en "Pagos":

```
┌─ Inversión: Proyecto A ──────────────────────────────┐
│                                                        │
│  Descripción: ...                                      │
│  Originador: Urbanitae  |  Shared: No                 │
│  Fecha inicio: 01/01/2024  |  Plazo: 24m + 0m ext    │
│  Cantidad: 5.000€  |  TAE: 8,5%                      │
│  Estado: ACTIVA                                       │
│  Capital pendiente: 3.200€                            │
│                                                        │
│  ┌─ Pagos ─────────────────────────────────────────┐  │
│  │ Fecha       | Importe | Interés | Capital |     │  │
│  │─────────────────────────────────────────────────│  │
│  │ 01/02/2024  | 85€    | 35€     | 50€     |     │  │
│  │ 01/03/2024  | 85€    | 35€     | 50€     |     │  │
│  │ ...          | ...    | ...     | ...     |     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  [+ Registrar Pago]                                    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Formulario de nueva inversión

```
┌─ Nueva Inversión Crownlending ──────────────────────┐
│                                                       │
│  Descripción: [________________________________]     │
│  Originador: [▼ WECITY | DOMOBLOCK | URBANITAE]     │
│  Tipo Shared: [ ] Sí                                 │
│  Fecha Inicio: [__/__/____]                          │
│  Plazo inicial (meses): [____]                       │
│  Cantidad invertida (EUR): [________]                │
│  TAE (%): [________]                                 │
│  Cuenta bancaria: [▼ Seleccionar cuenta]            │
│                                                       │
│  [Guardar]                                           │
└───────────────────────────────────────────────────────┘
```

### Formulario de pago

```
┌─ Registrar Pago ─────────────────────────────────────┐
│                                                        │
│  Fecha: [__/__/____]                                   │
│  Importe total: [________]                             │
│  De los cuales:                                        │
│    - Intereses: [________]                             │
│    - Capital (amortización): [________]                │
│  Comentarios: [________________________________]      │
│                                                        │
│  [Guardar Pago]                                        │
└────────────────────────────────────────────────────────┘
```

---

## Traducciones (es.json)

Añadir al bloque `investments`:

```json
"crowdlending": {
  "tab": "Crowdlending",
  "new_investment": "Nueva Inversión",
  "register_payment": "Registrar Pago",
  "description": "Descripción",
  "originador": "Originador",
  "start_date": "Fecha Inicio",
  "end_date": "Fecha Fin",
  "initial_term": "Plazo inicial",
  "extension": "Extensión",
  "months": "meses",
  "amount": "Cantidad",
  "tae": "TAE",
  "roi": "ROI",
  "status": "Estado",
  "active": "Activa",
  "extended": "Extendida",
  "matured": "Finalizada",
  "shared": "Shared",
  "yes": "Sí",
  "no": "No",
  "total_invested": "Total Invertido",
  "pending_capital": "Capital Pendiente",
  "total_returned": "Total Retornado",
  "collected_interest": "Intereses Cobrados",
  "net_profit": "Beneficio Neto",
  "avg_roi": "ROI Medio",
  "payment_history": "Historial de Pagos",
  "payment_date": "Fecha Pago",
  "total_amount": "Importe Total",
  "interest_part": "Intereses",
  "capital_part": "Capital (Amortización)",
  "expected_total": "Total Esperado",
  "expected_interest": "Intereses Esperados",
  "no_investments": "No hay inversiones de crownlending registradas.",
  "no_payments": "No hay pagos registrados para esta inversión.",
  "confirm_delete_investment": "¿Eliminar esta inversión? Se revertirán todos los efectos bancarios y pagos asociados.",
  "confirm_delete_payment": "¿Eliminar este pago? Se revertirá el ingreso en la cuenta bancaria.",
  "filters_all": "Todas",
  "filters_active": "Activas",
  "filters_matured": "Finalizadas",
  "originador_placeholder": "Todos los originadores"
}
```

---

## Resumen de cambios necesarios

1. Añadir modelos `CrowdlendingInvestment` y `CrowdlendingPayment` a ambos schemas
2. Añadir campo `crowdlending_investment_id` a `Transaction`
3. Ejecutar migración
4. Crear API routes en `src/app/api/investments/crowdlending/`
5. Añadir quinto sub-tab en la página `/investments`
6. Implementar componentes: resumen, tabla de inversiones, detalle con pagos, formularios
7. Añadir traducciones
8. Vincular con cuentas bancarias (crear Transaction al invertir y al cobrar pagos)
