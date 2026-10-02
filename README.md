
# POS & Ecommerce Backend

API REST para la gestión integrada de un punto de venta (POS) y una tienda ecommerce, desarrollada con NestJS, TypeScript, PostgreSQL y Prisma.

Ambos canales comerciales utilizan un inventario compartido, permitiendo registrar ventas presenciales, gestionar carritos y pedidos web, procesar pagos mediante MockPay Sandbox y controlar sesiones de caja.

## Demo desplegada

- API: https://pos-ecommerce-backend.onrender.com
- Swagger: https://pos-ecommerce-backend.onrender.com/api/docs
- Health check: https://pos-ecommerce-backend.onrender.com/health

> El backend está alojado en Render. Debido a las características del servicio gratuito, la primera petición después de un periodo de inactividad puede tardar en responder.

## Tecnologías

- Node.js 24
- TypeScript
- NestJS 12
- PostgreSQL
- Prisma ORM 7
- Prisma PostgreSQL Adapter (`@prisma/adapter-pg`)
- JWT + Passport
- bcryptjs
- Joi
- Swagger / OpenAPI
- Vitest
- pnpm

## Funcionalidades principales

### Autenticación y autorización

- Registro e inicio de sesión.
- Autenticación mediante JWT.
- Contraseñas almacenadas mediante hash.
- Protección de endpoints mediante guards.
- Control de acceso por roles: ADMIN, CASHIER y CUSTOMER.

### Catálogo e inventario

- Gestión de categorías y productos.
- Creación de productos con inventario inicial.
- Consulta pública del catálogo.
- Ocultamiento del precio de costo en consultas públicas.
- Reposición de inventario para administradores.
- Control de stock físico, reservado y disponible.
- Operaciones transaccionales para prevenir descuentos inconsistentes.

### Punto de venta (POS)

- Apertura de sesiones de caja.
- Creación de ventas presenciales.
- Incorporación de productos a las ventas.
- Cobros mediante CASH, CARD y TRANSFER_QR.
- Cancelación de ventas abiertas.
- Descuento de inventario al confirmar una venta.
- Cierre y conciliación de caja.

### Ecommerce

- Carrito de compras por cliente.
- Gestión de direcciones de entrega.
- Creación de pedidos a partir del carrito.
- Reserva temporal de inventario.
- Integración con MockPay Sandbox.
- Conciliación manual y automática de pagos.
- Liberación de reservas según el estado del pedido.
- Seguimiento administrativo de pedidos hasta su entrega.

## Arquitectura

El proyecto sigue una arquitectura modular basada en NestJS.

Módulos principales:

- Auth
- Users / Customers
- Categories
- Products
- Inventory
- Cash Sessions
- POS Sales
- Carts
- Addresses
- Orders
- Payments
- Health
- Prisma

La persistencia se gestiona mediante Prisma y PostgreSQL.

El proyecto utiliza transacciones de base de datos en las operaciones críticas de inventario, ventas y confirmación de pedidos.

## Modelo de inventario

El inventario es compartido por el POS y el ecommerce.

Conceptos:

- `stock`: existencia física registrada.
- `reservedStock`: unidades comprometidas por pedidos pendientes.
- `availableStock`: stock menos unidades reservadas.

Flujo ecommerce:

1. El cliente confirma su carrito.
2. El backend crea el pedido y reserva las unidades correspondientes.
3. Se genera una intención de pago en MockPay.
4. El resultado del pago se consulta y concilia.
5. Ante un pago exitoso, el pedido pasa a `PAID`, la reserva pasa a `CONSUMED` y se descuenta el stock físico.
6. Cuando corresponde cancelar un pedido pendiente, se liberan sus unidades reservadas.

Flujo POS:

1. El cajero abre una sesión.
2. Registra una venta y añade productos.
3. Selecciona el método de pago.
4. El checkout confirma la venta y descuenta el inventario mediante una transacción.
5. Al finalizar, cierra la caja y registra el efectivo contado.

## Instalación local

### Requisitos

- Node.js 24
- pnpm 11.22.0
- PostgreSQL
- Acceso al repositorio
- Credenciales de MockPay Sandbox para utilizar las funciones de pago

### 1. Clonar el repositorio

```bash
git clone https://github.com/ademirjgf/pos-ecommerce-backend.git
cd pos-ecommerce-backend
```

### 2. Instalar dependencias

```bash
pnpm install
```

### 3. Configurar variables de entorno

Crear un archivo `.env` a partir de `.env.example` y configurar los valores correspondientes.

Variables utilizadas por el proyecto:

```dotenv
NODE_ENV=development
PORT=3000

DATABASE_URL=<postgresql-connection-string>
JWT_SECRET=<secure-random-secret>

MOCKPAY_BASE_URL=https://mockpay-backend.onrender.com
MOCKPAY_PUBLIC_KEY=<sandbox-public-key>
MOCKPAY_SECRET_KEY=<sandbox-secret-key>

CORS_ORIGINS=http://localhost:5173,http://localhost:3001
```

No publicar `.env`, contraseñas, tokens JWT ni claves privadas.

En entornos que requieren un certificado CA específico para PostgreSQL, configurar también `NODE_EXTRA_CA_CERTS` con la ruta correspondiente.

### 4. Preparar Prisma y la base de datos

```bash
pnpm exec prisma generate
pnpm exec prisma migrate deploy
```

El proyecto incluye migraciones versionadas para identidad, catálogo e inventario, POS/caja y ecommerce/pagos.

### 5. Iniciar el servidor

```bash
pnpm run start:dev
```

La API utiliza el puerto configurado mediante `PORT` (3000 por defecto).

Documentación local:

http://localhost:3000/api/docs

Health check local:

http://localhost:3000/health

## Endpoints principales

| Método | Ruta | Función |
|---|---|---|
| POST | `/auth/register` | Registrar usuario |
| POST | `/auth/login` | Iniciar sesión |
| GET | `/auth/me` | Consultar usuario autenticado |
| GET | `/categories` | Listar categorías |
| POST | `/categories` | Crear categoría (ADMIN) |
| GET | `/products` | Consultar productos |
| POST | `/products` | Crear producto (ADMIN) |
| GET | `/inventory` | Consultar inventario (ADMIN) |
| POST | `/inventory/:productId/restock` | Reponer stock (ADMIN) |
| POST | `/cash-sessions/open` | Abrir caja |
| GET | `/cash-sessions/current` | Consultar caja actual |
| POST | `/cash-sessions/close` | Cerrar caja |
| POST | `/pos-sales` | Crear venta presencial |
| GET | `/pos-sales/open` | Consultar ventas abiertas |
| POST | `/pos-sales/:id/items` | Agregar producto a venta |
| POST | `/pos-sales/:id/checkout` | Cobrar venta |
| POST | `/pos-sales/:id/cancel` | Cancelar venta abierta |
| GET | `/carts` | Consultar carrito |
| POST | `/carts/items` | Añadir producto al carrito |
| DELETE | `/carts/items/:productId` | Retirar producto |
| GET | `/addresses` | Consultar direcciones |
| POST | `/addresses` | Registrar dirección |
| POST | `/orders/checkout` | Crear pedido web |
| GET | `/orders` | Consultar pedidos del cliente |
| GET | `/admin/orders` | Consultar pedidos (ADMIN) |
| PATCH | `/admin/orders/:id/in-transit` | Registrar pedido en tránsito |
| PATCH | `/admin/orders/:id/delivered` | Registrar pedido entregado |
| POST | `/payments/orders/:orderId/checkout` | Generar checkout de MockPay |
| POST | `/payments/orders/:orderId/reconcile` | Conciliar pago |
| GET | `/health` | Comprobar servicio y conexión DB |

Los DTO, parámetros, requisitos de autenticación y códigos de respuesta se encuentran documentados mediante Swagger.

## Integración con MockPay Sandbox

MockPay permite simular pagos con tarjetas ficticias.

El backend genera la intención de pago mediante una solicitud autenticada a la pasarela, conserva su identificador externo y permite consultar posteriormente el resultado.

El sistema incluye un proceso periódico de conciliación para pagos pendientes que ya cuentan con identificador externo.

La conciliación comprueba los datos de la transacción antes de confirmar el pedido y actualizar el inventario. Ejecutar nuevamente la conciliación de un pago ya procesado no debe producir un segundo descuento.

### Consideraciones operativas

- Si una solicitud externa falla antes de recuperar el identificador del proveedor, el intento local se conserva para revisión; no se repite automáticamente una operación potencialmente ambigua.
- La conciliación periódica depende de que la instancia del backend esté ejecutándose.
- En el ambiente de pruebas se detectó que el formulario web de MockPay puede introducir espacios automáticamente en el número de tarjeta y rechazarlo durante la validación. El endpoint de procesamiento de la API Sandbox permite realizar la simulación con los datos ficticios correspondientes.
- MockPay es una pasarela de simulación: no deben utilizarse tarjetas bancarias reales.

## Despliegue

Entorno utilizado:

- Render: alojamiento de la API NestJS.
- Supabase: PostgreSQL de producción.
- GitHub: repositorio y control de versiones.

El proceso de despliegue incluye instalación de dependencias, generación de Prisma Client, compilación de NestJS y ejecución de la aplicación.

Las migraciones de producción deben aplicarse de manera controlada mediante:

```bash
pnpm exec prisma migrate deploy
```

Las variables sensibles se configuran mediante el administrador de variables de entorno del proveedor de despliegue.

## Pruebas y calidad

Scripts disponibles:

```bash
pnpm run build
pnpm run lint
pnpm run test
pnpm run test:e2e
```

### Validación funcional realizada en producción

Se ejecutó un flujo completo utilizando un producto de prueba:

- Stock inicial: 10 unidades.
- Pedido ecommerce confirmado con MockPay Sandbox: 1 unidad.
- Stock después de ecommerce: 9 unidades.
- Venta POS en efectivo: 1 unidad.
- Stock final: 8 unidades.
- Stock reservado final: 0 unidades.

También se comprobó un cierre de caja con los siguientes importes:

| Concepto | Importe |
|---|---:|
| Fondo inicial | USD 100.00 |
| Venta en efectivo | USD 120.00 |
| Efectivo esperado | USD 220.00 |
| Efectivo contado | USD 220.00 |
| Diferencia | USD 0.00 |

Estas comprobaciones corresponden a pruebas funcionales manuales sobre el entorno desplegado y no sustituyen las pruebas automatizadas.

## Posibles mejoras futuras

- Recepción y validación segura de webhooks de pago.
- Procesamiento de conciliaciones mediante workers independientes del ciclo de vida de Render.
- Ampliación de cobertura de pruebas unitarias y E2E.
- Dashboard administrativo y frontend comercial.
- Observabilidad, métricas y alertas operativas.

## Autor

Ademir J. Gómez Fuentes

Proyecto backend desarrollado como demostración práctica de arquitectura modular, integración de servicios externos, seguridad, transacciones y consistencia de inventario.
