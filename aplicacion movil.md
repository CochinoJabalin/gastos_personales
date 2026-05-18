# App Android "Rápido" — Plan de Implementación

App nativa Android (React Native / Expo) que contiene **solo** la funcionalidad de "Entrada Rápida" del Gestor Patrimonial, con autenticación en 2 pasos (2FA) y VPN embebida (WireGuard).

---

## Flujo completo de la app

```
┌─────────────────────────────────────────────────────┐
│  Abrir app                                           │
├─────────────────────────────────────────────────────┤
│                                                       │
│  1. LOGIN                    Usuario + Contraseña    │
│     POST /api/auth/login-mobile                      │
│       ↓                                              │
│  2. 2FA                      TOTP o Email OTP       │
│     POST /api/auth/login-mobile (con código)          │
│     POST /api/auth/send-otp (si elige email)          │
│       ↓                                              │
│  3. 🛡️ VPN conectar          WireGuard QR           │
│     startVpn(config) ← escanea QR del .conf          │
│     Espera a que el túnel esté activo                │
│       ↓                                              │
│  4. QUICK ENTRY              Formulario + sugerencias│
│     GET /api/banks, /api/mapping-rules, /api/common  │
│     POST /api/infer, POST /api/transactions          │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Estructura del proyecto Android (React Native / Expo)

```
rapid-entry-app/
├── app.json                    # Config plugin para módulo nativo
├── package.json
├── tsconfig.json
├── index.js
├── App.tsx                     # AuthGate: decide qué pantalla mostrar
│
├── src/
│   ├── config.ts               # API_BASE_URL (192.168.1.X:3000 por VPN)
│   ├── types.ts                # Interfaces compartidas
│   │
│   ├── api/
│   │   └── client.ts           # Fetch wrapper con cookie de sesión
│   │
│   ├── utils/
│   │   └── format.ts           # parseSpanishNumber, applySign (del web)
│   │
│   ├── screens/
│   │   ├── LoginScreen.tsx     # Usuario + contraseña + URL servidor
│   │   ├── TwoFactorScreen.tsx # TOTP (6 dígitos) o "Enviar al email"
│   │   ├── VpnScreen.tsx       # QR scanner + estado de conexión
│   │   └── QuickEntryScreen.tsx # Formulario + sugerencias
│   │
│   └── components/
│       ├── AmountInput.tsx
│       ├── ConceptInput.tsx
│       ├── BankPicker.tsx
│       ├── CategoryPicker.tsx
│       ├── TypeSelector.tsx
│       ├── RecurringSelector.tsx
│       ├── SuggestionCard.tsx
│       ├── StatCard.tsx
│       └── QrScanner.tsx       # Cámara para escanear config WireGuard
│
├── modules/
│   └── wireguard/
│       ├── index.ts            # API JS: start, stop, getStatus, listeners
│       ├── src/
│       │   └── WireGuardModule.kt   # Módulo nativo (expo-modules-core)
│       └── build.gradle        # Dependencia com.wireguard.android:tunnel
│
└── app.plugin.js               # Expo Config Plugin
```

---

## Pantallas detalladas

### 1. LoginScreen

- Campo "URL del servidor" (ej: `http://192.168.1.100:3000`)
- Campo "Usuario"
- Campo "Contraseña"
- Botón "Entrar"
- Guarda URL y sesión en SecureStore
- Si las credenciales son correctas → avanza a 2FA o directamente a VPN (si no hay 2FA)

### 2. TwoFactorScreen

- Mensaje: "Código de verificación"
- Selector de método: [Autenticador] / [Email]
- Si elige **Autenticador**: campo numérico de 6 dígitos TOTP
- Si elige **Email**: botón "Enviar código" → llega al email configurado → campo numérico de 6 dígitos
- Botón "Verificar"
- Si 2FA no está activo en el servidor, esta pantalla se omite automáticamente

### 3. VpnScreen

- **Primera vez**:
  - Mensaje: "Configura la VPN para conectar con tu red de casa"
  - Botón "Escanear QR de WireGuard"
  - Abre la cámara → escanea el QR (formato estándar de WireGuard)
  - Guarda la configuración descifrada en SecureStore
- **Siguientes veces**: auto-conecta al llegar
  - Indicador de progreso: ● ● ● ● ● ● ●
  - Texto de estado: "Iniciando túnel..." / "Solicitando permiso..." / "Conectado" / "Error"
  - Primera vez: Android muestra diálogo nativo "Permitir conexión VPN"
  - Una vez conectado → avanza automáticamente a QuickEntryScreen
  - Si falla: botón "Reintentar" + botón "Escanear otro QR"

### 4. QuickEntryScreen

- Formulario completo (equivalente a `quick-entry/page.tsx` de la web):
  - Concepto (obligatorio, con detección automática)
  - Importe (con teclado numérico)
  - Comentarios (opcional)
  - Banco (selector, auto-detectado por inferencia)
  - Categoría (selector con búsqueda, auto-detectada)
  - Tipo: Fijo / Variable
  - Recurrencia: No recurrente / Mensual / Anual
- Inferencia automática al escribir el concepto (debounce 400ms vía `POST /api/infer`)
- Botón "Registrar Transacción" con feedback visual de éxito
- Sección "Sugerencias Rápidas":
  - Muestra transacciones frecuentes (vía `GET /api/transactions/common`)
  - Al tocar una sugerencia, auto-rellena el formulario
  - Posibilidad de ocultar sugerencias
  - Añadir sugerencias personalizadas (guardadas en AsyncStorage)
- Tarjetas informativas:
  - "Límite Diario" con barra de progreso
  - "Estimado Mensual" con barra de progreso

---

## Módulo nativo WireGuard (Kotlin)

### Interfaz JavaScript

```typescript
// modules/wireguard/index.ts
export function startVpn(configJson: string): Promise<void>;
export function stopVpn(): Promise<void>;
export function getStatus(): Promise<'disconnected' | 'connecting' | 'connected'>;
export function addStatusListener(callback: (status: string) => void): () => void;
```

### Implementación nativa

```kotlin
// WireGuardModule.kt
class WireGuardModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("WireGuard")

        Function("startVpn") { configJson: String ->
            // 1. Parsear config JSON a WgQuickConfig
            // 2. Crear Intent con WireGuardTunnelService
            // 3. Llamar a startService(intent)
            // 4. Android muestra automáticamente el diálogo de permiso VPN
        }

        Function("stopVpn") {
            WireGuardTunnelService.stop(context)
        }

        Function("getStatus") -> String {
            WireGuardTunnelService.status.name
        }

        Events("onStatusChange")
    }
}
```

Usa la librería oficial: `com.wireguard.android:tunnel`

---

## Cambios en el backend (web actual)

### Nuevos archivos

| Archivo | Función |
|---|---|
| `src/app/api/auth/login-mobile/route.ts` | Login en 2 pasos para móvil. POST con username+password → si 2FA activo, requiere también `totpCode` o `emailCode`. Devuelve sesión JWT |
| `src/app/api/auth/send-otp/route.ts` | Genera código de 6 dígitos, lo guarda en tabla `OtpCode`, lo envía por email via nodemailer. Expira en 5 minutos |
| `src/app/api/auth/2fa-status/route.ts` | GET: devuelve `{ totp: bool, email: bool }` |
| `src/app/api/auth/setup-2fa/route.ts` | POST: activa TOTP (genera secreto) o configura email OTP |
| `src/app/api/auth/disable-2fa/route.ts` | POST: desactiva 2FA por completo |

### Modificaciones

| Archivo | Cambio |
|---|---|
| `prisma/schema.prisma` | Añadir modelo `UserSettings` con `totpSecret`, `emailOtpEnabled`; modelo `OtpCode` |
| `package.json` | Añadir `otplib`, `nodemailer`, `qrcode` |
| `.env.example` | Añadir `TOTP_SECRET`, `OTP_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` |
| `src/app/(dashboard)/settings/page.tsx` | Añadir sección "Seguridad" con QR para TOTP, configuración SMTP, test de envío |

### Modelos nuevos (Prisma)

```prisma
model UserSettings {
  id              String   @id @default(uuid())
  totpSecret      String?
  emailOtpEnabled Boolean  @default(false)
  otpEmail        String?
  updatedAt       DateTime @updatedAt
}

model OtpCode {
  id        String   @id @default(uuid())
  code      String
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

### Endpoint `POST /api/auth/login-mobile`

```
Request:
{
  "username": "admin",
  "password": "xxx",
  "totpCode": "123456",     // opcional, si 2FA TOTP
  "emailCode": "123456"     // opcional, si 2FA email
}

Response (éxito, sin 2FA):
{ "token": "jwt...", "user": { "name": "admin" } }

Response (2FA requerido):
{ "step": 2, "methods": ["totp", "email"] }

Response (error):
{ "error": "Credenciales inválidas" }
```

### Endpoint `POST /api/auth/send-otp`

```
Request:  { }
Response: { "sent": true, "expiresIn": 300 }
```

---

## Dependencias

### App React Native / Expo

```
expo: ~52.x
expo-dev-client
expo-modules-core
expo-camera / expo-barcode-scanner
expo-secure-store
@react-native-async-storage/async-storage
react-native-svg
```

Módulo nativo (build.gradle):
```gradle
implementation "com.wireguard.android:tunnel:1.0.20250214"
```

### Backend (web actual)

```
otplib       → generar/verificar TOTP
nodemailer   → enviar emails OTP
qrcode       → generar QR para configurar 2FA en web
```

---

## Configuración WireGuard esperada

### Servidor (en casa, `/etc/wireguard/wg0.conf`)

```ini
[Interface]
Address = 10.0.0.1/24
PrivateKey = <server-private-key>
ListenPort = 51820

[Peer]
# Móvil
PublicKey = <mobile-public-key>
AllowedIPs = 10.0.0.2/32
```

### Cliente (escaneado por QR en la app)

```ini
[Interface]
PrivateKey = <mobile-private-key>
Address = 10.0.0.2/32
DNS = 192.168.1.1

[Peer]
PublicKey = <server-public-key>
Endpoint = midominio.ddns.net:51820
AllowedIPs = 192.168.1.0/24
PersistentKeepalive = 25
```

> `AllowedIPs` se limita solo a la subred local (`192.168.1.0/24`), no se enruta todo el tráfico del móvil por la VPN.

---

## APIs consumidas desde la app

| Método | Endpoint | Uso |
|---|---|---|
| POST | `/api/auth/login-mobile` | Login en 2 pasos |
| POST | `/api/auth/send-otp` | Enviar código por email |
| GET | `/api/banks` | Listar bancos |
| GET | `/api/mapping-rules` | Obtener categorías |
| GET | `/api/transactions/common` | Sugerencias rápidas |
| POST | `/api/infer` | Inferir categoría/tipo/banco |
| POST | `/api/transactions` | Crear transacción |

---

## Orden de implementación

| Fase | Qué | Tiempo |
|---|---|---|
| 1 | Backend: modelos BD + endpoints 2FA + login-mobile | 2h |
| 2 | Backend: sección "Seguridad" en Ajustes web | 1h |
| 3 | App: setup Expo + API client + tipos + format | 30min |
| 4 | App: pantallas Login + 2FA | 1h |
| 5 | App: módulo nativo WireGuard + pantalla VPN | 3h |
| 6 | App: pantalla QuickEntry + componentes + inferencia | 2h |
| 7 | Integración final y pruebas | 1h |
| | **Total** | **~10-11h** |
