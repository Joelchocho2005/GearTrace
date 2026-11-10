# GearTrace — matriz de capacidades y pruebas

Documento de comparación funcional basado en:

- `backend/repomix-output.xml`
- `backend/clinerules.md`
- `frontend/repomix-output.xml`
- `frontend/clinerules.md`

## Roles

| Rol | Propósito |
|---|---|
| `GERENTE` | Administración completa del taller, inventario, operación y facturación. |
| `MECANICO` | Operación técnica, inventario, proveedores, hardware y órdenes asignadas. |
| `CLIENTE` | Sus vehículos, sus citas y el seguimiento de sus órdenes. |

## Capacidades del GERENTE

### Acceso y usuarios

- Iniciar sesión.
- Consultar su perfil.
- Registrar clientes públicamente; el registro público siempre crea `CLIENTE`.
- Crear usuarios administrativos con rol `GERENTE`, `MECANICO` o `CLIENTE`.
- Listar usuarios.
- Crear, editar y eliminar usuarios.
- Cambiar roles.
- Activar o desactivar usuarios.
- No debe poder eliminarse a sí mismo.
- Las contraseñas nunca deben devolverse en las respuestas.

### Inventario

- Listar cajas y piezas.
- Consultar el detalle de una caja o pieza.
- Crear y editar cajas.
- Crear y editar piezas.
- Subir imágenes de piezas.
- Buscar piezas.
- Consultar piezas con stock bajo.
- Eliminar cajas o piezas.
- Una caja con piezas no debe eliminarse.

### Vehículos y citas

- Listar, consultar, crear, editar y eliminar vehículos.
- La placa debe normalizarse con `trim` y mayúsculas y ser única.
- El dueño de un vehículo debe ser un cliente activo.
- No debe eliminar vehículos con citas u órdenes relacionadas.
- Listar, consultar, crear y editar citas.
- Confirmar o cancelar citas abiertas.
- No debe editar citas `COMPLETADA` o `CANCELADA`.
- La fecha de una cita nueva o reprogramada debe ser futura.
- Generar una orden de trabajo desde una cita `AGENDADA` o `CONFIRMADA`.
- Al generar la orden, la cita pasa a `COMPLETADA`.
- Una cita no debe generar dos órdenes.

### Órdenes de trabajo

- Ver todas las órdenes.
- Crear órdenes.
- El número `OT-YYYY-NNN` lo genera el servidor.
- Editar descripción, diagnóstico, kilometraje, costo estimado, mecánico y estado según las transiciones permitidas.
- Asignar mecánicos activos.
- Agregar repuestos.
- Descontar stock al agregar un repuesto.
- Quitar repuestos y devolver stock.
- Concluir una orden mediante el flujo de cierre.
- Concluirla con costo final.
- El cierre no debe descontar stock nuevamente.
- Eliminar órdenes no concluidas y devolver sus repuestos al inventario.
- No editar, eliminar ni agregar repuestos a órdenes concluidas.

### Proveedores y compras

- Listar, consultar, crear, editar y eliminar proveedores.
- Consultar el conteo de órdenes por proveedor.
- No eliminar proveedores con pedidos asociados.
- Consultar piezas bajo stock.
- Crear órdenes de compra con piezas bajo o igual al stock mínimo.
- El número `OC-YYYY-NNN` lo genera el servidor.
- Editar pedidos pendientes.
- Recibir pedidos.
- Al recibir un pedido, incrementar el stock dentro de una transacción.
- Cancelar pedidos pendientes.
- No editar ni eliminar pedidos recibidos.

### Facturación

- Listar, consultar, crear, editar y eliminar facturas.
- Crear facturas únicamente para órdenes concluidas sin factura.
- El número `FAC-YYYY-NNN` lo genera el servidor.
- Calcular el subtotal usando costo final, costo estimado o repuestos utilizados.
- Mantener el precio congelado de cada repuesto consumido.
- Agregar impuestos y calcular el total.
- Marcar facturas como pagadas.
- No editar ni eliminar facturas pagadas.

### Hardware y auditoría

- Consultar logs de búsqueda.
- Usar el dashboard del gerente para consultar métricas, órdenes activas y estado del hardware.
- El dashboard del gerente debe observar el estado del hardware sin controlar LEDs.

## Capacidades del MECANICO

### Inventario

- Listar cajas y piezas.
- Consultar detalles y buscar piezas.
- Consultar stock bajo.
- Crear y editar cajas y piezas.
- Subir imágenes de piezas.
- No eliminar cajas ni piezas; esa acción es exclusiva de `GERENTE`.

### Vehículos y citas

- Listar, consultar, crear y editar vehículos según las reglas del dominio.
- Listar, consultar, crear y editar citas.
- Confirmar citas.
- Cancelar citas abiertas.
- Generar órdenes de trabajo desde citas abiertas.
- No eliminar vehículos ni citas; esa acción es exclusiva de `GERENTE`.

### Órdenes de trabajo

- Ver únicamente las órdenes asignadas a su usuario.
- Crear una orden y autoasignarse.
- No asignarse una orden de otro mecánico.
- Editar y operar únicamente sus órdenes.
- Cambiar estados permitidos.
- Registrar diagnóstico y kilometraje.
- Agregar repuestos y descontar stock.
- Quitar repuestos y devolver stock.
- Concluir órdenes asignadas mediante el cierre.
- No concluir mediante el `PATCH` genérico.
- No eliminar órdenes; esa acción es exclusiva de `GERENTE`.

### Proveedores y compras

- Según el backend, puede listar, consultar, crear y editar proveedores.
- Según el backend, puede consultar, crear y editar órdenes de compra.
- Puede recibir pedidos si el endpoint lo permite para su rol.
- No eliminar proveedores ni compras.
- No administrar facturación.

### Hardware, búsqueda y auditoría

- Ver sus órdenes asignadas.
- Buscar repuestos.
- Probar LEDs.
- Apagar LEDs.
- Ver el estado de la tira WS2812B.
- Consultar logs de búsqueda.
- Recibir señales de LEDs activadas por Alexa mediante Socket.io.

## Capacidades del CLIENTE

### Cuenta

- Registrarse públicamente como `CLIENTE`.
- Iniciar sesión.
- Consultar su perfil.
- Ser rechazado si su usuario fue desactivado.

### Vehículos

- Consultar únicamente sus vehículos.
- No consultar vehículos de otros clientes.
- No crear, editar ni eliminar vehículos desde el flujo público de cliente.

### Citas

- Solicitar una cita para uno de sus vehículos.
- Seleccionar únicamente vehículos propios.
- Usar una fecha futura.
- Consultar únicamente sus citas.
- Ver la orden de trabajo vinculada cuando exista.
- No confirmar ni cancelar directamente una cita desde el API de cliente.

### Órdenes de trabajo

- Consultar únicamente las órdenes de sus vehículos.
- Ver estado, diagnóstico, progreso, vehículo y repuestos relacionados según lo expuesto por el dashboard.
- No crear, editar, eliminar, asignar ni concluir órdenes.
- No agregar ni quitar repuestos.

### Restricciones

- No acceder al inventario global.
- No acceder a LEDs ni hardware.
- No acceder a logs.
- No acceder a usuarios, proveedores, compras ni facturación.
- No acceder a órdenes de otros clientes manipulando un ID.

## Alexa

- El endpoint público es `POST /api/webhook/alexa`.
- `LaunchRequest` debe responder bienvenida y mantener la sesión abierta.
- `AMAZON.HelpIntent` debe explicar ejemplos de uso.
- `AMAZON.StopIntent` y `AMAZON.CancelIntent` deben cerrar la sesión.
- `BuscarPiezaIntent` debe aceptar el slot `nombrePieza`.
- La búsqueda debe devolver pieza, caja, ubicación y stock.
- La búsqueda debe activar el LED de la caja correspondiente.
- `ListarCajasIntent` debe listar las cajas.
- `StockBajoIntent` debe listar piezas con stock bajo.
- Un intent no registrado debe responder fallback sin romper el webhook.
- En producción `ALEXA_SKILL_ID` debe ser el Application ID real.
- El modelo de Alexa debe usar el Invocation Name configurado en Alexa Developer Console.

## Flujo de inventario y stock

1. Crear o editar una pieza.
2. Consultar su stock actual y mínimo.
3. Crear una orden de trabajo.
4. Agregar un repuesto a la orden.
5. Descontar stock en la misma transacción.
6. Si no hay stock suficiente, responder `409` y no crear el consumo.
7. Quitar el repuesto si la orden no está concluida.
8. Devolver stock al quitarlo.
9. Crear una compra para piezas bajo mínimo.
10. Recibir la compra.
11. Incrementar stock en la misma transacción.

## Flujo de orden de trabajo

1. El gerente o mecánico crea la orden, o el gerente/mecánico la genera desde una cita.
2. El servidor asigna el número `OT-YYYY-NNN`.
3. La orden inicia en `EN_DIAGNOSTICO`.
4. Puede pasar a `EN_PROCESO`.
5. Puede pasar a `ESPERA_REPUESTOS` y regresar a `EN_PROCESO`.
6. Se agregan repuestos durante la operación, descontando stock.
7. Se registra diagnóstico y costo final.
8. Se cierra por `/service/work-orders/:id/close`.
9. Pasa a `CONCLUIDO` y registra `completedAt`.
10. Se puede generar una sola factura para la orden concluida.

## Diferencias que deben comprobarse

Estas diferencias aparecen entre el alcance del backend y la navegación del frontend:

1. El backend permite a `MECANICO` operar proveedores y compras, pero el frontend declara `/proveedores` y `/compras` únicamente para `GERENTE`.
   - Si es intencional, el frontend está restringiendo la interfaz sin contradecir la seguridad del backend.
   - Si el mecánico debe usar esos módulos, hay que agregarlo en `frontend/src/routes/routeRoles.ts` y en la navegación.
2. El cliente no usa el CRUD general de órdenes; consulta sus órdenes por `/api/client/work-orders` y por su dashboard.
3. El cliente no usa el CRUD general de citas; usa `/api/client/appointments`.
4. El `MECANICO` puede ver órdenes asignadas por alcance del backend; el frontend debe evitar depender solo de filtros locales para seguridad.
5. El seed contiene datos demo y debe ejecutarse únicamente fuera de producción.

## Prueba mínima por usuario

### GERENTE

- [ ] Login y consulta de perfil.
- [ ] Crear un mecánico y un cliente.
- [ ] Crear caja y pieza.
- [ ] Crear vehículo y cita.
- [ ] Confirmar cita y generar OT.
- [ ] Agregar y quitar repuesto verificando stock.
- [ ] Cambiar estado y cerrar OT.
- [ ] Crear y recibir compra verificando stock.
- [ ] Crear y pagar factura.
- [ ] Consultar logs.
- [ ] Confirmar que no puede usar datos inválidos o duplicados.

### MECANICO

- [ ] Login.
- [ ] Ver solo sus órdenes.
- [ ] Crear o autoasignar OT.
- [ ] Intentar consultar una OT ajena y recibir `404`.
- [ ] Cambiar estado, registrar diagnóstico y kilometraje.
- [ ] Agregar repuesto con stock suficiente.
- [ ] Intentar agregar repuesto sin stock y recibir `409`.
- [ ] Probar y apagar LEDs.
- [ ] Buscar repuestos.
- [ ] Consultar logs.
- [ ] Confirmar que no puede eliminar inventario, vehículos, citas u órdenes.

### CLIENTE

- [ ] Registrar o iniciar sesión.
- [ ] Ver únicamente sus vehículos.
- [ ] Solicitar una cita para un vehículo propio.
- [ ] Intentar solicitar una cita usando vehículo ajeno y recibir error.
- [ ] Ver únicamente sus citas.
- [ ] Ver únicamente sus órdenes.
- [ ] Intentar acceder a inventario, usuarios, compras, facturas, logs y hardware.
- [ ] Confirmar que no puede leer órdenes de otro cliente cambiando el ID.

## Criterio de aceptación

El sistema cumple el flujo esperado si:

- Cada rol solo ve y ejecuta las capacidades descritas.
- Las restricciones se cumplen igualmente llamando directamente al API.
- El stock nunca queda negativo.
- Los números OT, OC y FAC nunca vienen del cliente.
- Las órdenes concluidas no se modifican.
- Los datos de un cliente no son visibles para otro.
- Alexa diferencia correctamente `LaunchRequest`, búsqueda, cajas, stock bajo y salida.
- La configuración de producción usa secretos reales, Skill ID real y hardware real cuando corresponde.
