// ============================================
// checkout.js
// Procesamiento de pedidos con Supabase
// Validación ATÓMICA de stock
// Manejo de errores robusto
// ============================================

import { supabase } from './supabase-client.js'
import { carrito } from './cart.js'

// Estado del checkout
let checkoutEnProgreso = false
let ultimoPedidoId = null

/**
 * Valida todos los campos del formulario de checkout
 * @param {Object} datos - Datos del formulario
 * @returns {Object} Resultado de validación
 */
function validarFormulario(datos) {
    const errores = []
    
    // Validar campos requeridos (mismos que el XML original)
    if (!datos.nombre || datos.nombre.trim().length < 3) {
        errores.push('Nombre y apellidos (mínimo 3 caracteres)')
    }
    
    if (!datos.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email)) {
        errores.push('Correo electrónico válido')
    }
    
    if (!datos.telefono || !/^[0-9]{8,11}$/.test(datos.telefono.replace(/\s/g, ''))) {
        errores.push('Número de teléfono (8-11 dígitos)')
    }
    
    if (!datos.direccion || datos.direccion.trim().length < 5) {
        errores.push('Dirección completa')
    }
    
    if (!datos.localidad || datos.localidad.trim() === '') {
        errores.push('Localidad/Barrio')
    }
    
    if (!datos.carnet || datos.carnet.trim().length < 5) {
        errores.push('Número de Carnet o Pasaporte')
    }
    
    if (!datos.metodo_pago) {
        errores.push('Seleccionar método de pago')
    }
    
    // Validar ciudad de envío
    const ciudadSelect = document.getElementById('ciudad')
    if (!ciudadSelect || !ciudadSelect.value) {
        errores.push('Seleccionar destino de envío')
    }
    
    return {
        valido: errores.length === 0,
        errores
    }
}

/**
 * Obtiene el descuento aplicado desde localStorage y valida contra Supabase
 * @returns {Promise<Object>} Información del descuento
 */
async function obtenerDescuentoAplicado() {
    try {
        const codigo = localStorage.getItem('cupon_activo')
        if (!codigo) {
            return { monto: 0, codigo: null, tipo: null }
        }
        
        // Validar que el cupón SIGA siendo válido (no expiró, no se usó)
        const { data, error } = await supabase
            .from('cupones')
            .select('id, descuento, tipo, max_usos, usos_actuales, expiracion, activo')
            .eq('codigo', codigo)
            .eq('activo', true)
            .single()
        
        if (error || !data) {
            // Cupón ya no es válido - limpiar
            localStorage.removeItem('cupon_activo')
            localStorage.removeItem('cupon_descuento')
            return { monto: 0, codigo: null, tipo: null }
        }
        
        // Validar fecha de expiración
        if (data.expiracion) {
            const hoy = new Date()
            const expiracion = new Date(data.expiracion)
            if (hoy > expiracion) {
                localStorage.removeItem('cupon_activo')
                return { monto: 0, codigo: null, tipo: null }
            }
        }
        
        // Validar usos máximos
        if (data.usos_actuales >= data.max_usos) {
            localStorage.removeItem('cupon_activo')
            return { monto: 0, codigo: null, tipo: null }
        }
        
        // Calcular descuento
        const subtotal = carrito.subtotal()
        let monto = 0
        
        if (data.tipo === 'porcentaje') {
            monto = subtotal * (data.descuento / 100)
            // Limitar al 100% del subtotal
            monto = Math.min(monto, subtotal)
        } else {
            monto = data.descuento // Monto fijo
            // No puede ser mayor al subtotal
            monto = Math.min(monto, subtotal)
        }
        
        return {
            monto,
            codigo: data.codigo,
            id: data.id,
            tipo: data.tipo,
            descuento: data.descuento
        }
        
    } catch (error) {
        console.error('Error validando cupón:', error)
        return { monto: 0, codigo: null, tipo: null }
    }
}

/**
 * VERIFICACIÓN ATÓMICA DE STOCK
 * Usa transacción SQL para evitar condiciones de carrera
 * @param {Array} items - Items del carrito
 * @returns {Promise<Object>} Resultado de la verificación
 */
async function verificarStockAtomico(items) {
    try {
        // Construir array de verificaciones
        const verificaciones = items.map(item => ({
            id: item.producto_id,
            cantidad_requerida: item.cantidad
        }))
        
        // Llamar a función RPC en Supabase (edge function)
        const { data, error } = await supabase
            .rpc('verificar_stock_transaccion', {
                items_verificar: verificaciones
            })
        
        if (error) throw error
        
        return {
            success: true,
            suficiente: data.todos_disponibles,
            items_sin_stock: data.items_sin_stock || [],
            mensaje: data.mensaje
        }
        
    } catch (error) {
        console.error('Error en verificación atómica:', error)
        
        // Fallback: verificación manual (menos segura)
        let suficiente = true
        let itemsSinStock = []
        
        for (const item of items) {
            const { data, error: dbError } = await supabase
                .from('productos')
                .select('stock, nombre')
                .eq('id', item.producto_id)
                .single()
            
            if (dbError || !data) {
                suficiente = false
                itemsSinStock.push({
                    ...item,
                    razon: 'Producto no encontrado'
                })
                continue
            }
            
            if (data.stock < item.cantidad) {
                suficiente = false
                itemsSinStock.push({
                    ...item,
                    stock_actual: data.stock,
                    razon: 'Stock insuficiente'
                })
            }
        }
        
        return {
            success: true,
            suficiente,
            items_sin_stock: itemsSinStock,
            mensaje: suficiente ? 'Stock OK' : 'Stock insuficiente'
        }
    }
}

/**
 * PROCESAR PEDIDO - Versión mejorada
 * @param {Object} datosFormulario - Datos del formulario de checkout
 * @returns {Promise<boolean>} Éxito de la operación
 */
export async function procesarPedido(datosFormulario) {
    
    // ========== PREVENIR DOBLE CLIC ==========
    if (checkoutEnProgreso) {
        console.log('Checkout ya en progreso, ignorando...')
        return false
    }
    
    checkoutEnProgreso = true
    const botonConfirmar = document.querySelector('.contact-form-button.soracustomform-ok')
    const botonOriginalText = botonConfirmar?.value || 'Confirmar Pedido'
    
    try {
        // ========== BLOQUEAR BOTÓN ==========
        if (botonConfirmar) {
            botonConfirmar.disabled = true
            botonConfirmar.value = 'Procesando...'
        }
        
        // ========== 1. VALIDAR FORMULARIO ==========
        const validacion = validarFormulario(datosFormulario)
        if (!validacion.valido) {
            const mensaje = `Campos requeridos:\n• ${validacion.errores.join('\n• ')}`
            alert(mensaje)
            return false
        }
        
        // ========== 2. VALIDAR CARRITO ==========
        if (carrito.items.length === 0) {
            alert('Tu carrito está vacío')
            window.location.href = '/p/cart.html'
            return false
        }
        
        // ========== 3. VERIFICAR STOCK (ATÓMICO) ==========
        const itemsParaCheckout = carrito.getItemsForCheckout()
        const verificacionStock = await verificarStockAtomico(itemsParaCheckout)
        
        if (!verificacionStock.suficiente) {
            let mensaje = 'No hay suficiente stock:\n'
            verificacionStock.items_sin_stock.forEach(item => {
                mensaje += `• ${item.nombre}: solicitaste ${item.cantidad}, disponible ${item.stock_actual || 0}\n`
            })
            alert(mensaje)
            
            // Actualizar carrito con stock real
            await carrito.verificarStockCarrito()
            return false
        }
        
        // ========== 4. CALCULAR TOTALES ==========
        const subtotal = carrito.subtotal()
        
        // Obtener costo de envío
        const ciudadSelect = document.getElementById('ciudad')
        const costoEnvio = ciudadSelect && ciudadSelect.options[ciudadSelect.selectedIndex]
            ? parseFloat(ciudadSelect.options[ciudadSelect.selectedIndex].getAttribute('data-costo')) || 0
            : 0
        
        // Obtener descuento
        const descuentoInfo = await obtenerDescuentoAplicado()
        const descuento = descuentoInfo.monto || 0
        
        // Calcular total
        const total = subtotal + costoEnvio - descuento
        
        // ========== 5. CONSTRUIR OBJETO DE PEDIDO (ESTRUCTURA EXACTA DEL XML) ==========
        const pedido = {
            items: carrito.items.map(item => ({
                producto_id: item.producto_id, // CORREGIDO: usar producto_id, NO item.id
                nombre: item.nombre,
                precio: item.precio,
                cantidad: item.cantidad,
                subtotal: item.precio * item.cantidad,
                opciones: item.opciones || {} // IMPORTANTE: preservar tallas, colores, etc.
            })),
            subtotal: parseFloat(subtotal.toFixed(2)),
            envio: parseFloat(costoEnvio.toFixed(2)),
            descuento: parseFloat(descuento.toFixed(2)),
            total: parseFloat(total.toFixed(2)),
            cliente: {
                nombre: datosFormulario.nombre?.trim() || '',
                email: datosFormulario.email?.trim() || '',
                telefono: datosFormulario.telefono?.replace(/\s/g, '') || '',
                direccion: datosFormulario.direccion?.trim() || '',
                referencia: datosFormulario.referencia?.trim() || '',
                localidad: datosFormulario.localidad?.trim() || '',
                carnet: datosFormulario.carnet?.trim() || '',
                notas: datosFormulario.notas?.trim() || ''
            },
            metodo_pago: datosFormulario.metodo_pago || 'efectivo',
            cupon_aplicado: descuentoInfo.codigo || null,
            created_at: new Date().toISOString()
        }
        
        // ========== 6. INSERTAR EN SUPABASE ==========
        const { data, error } = await supabase
            .from('pedidos')
            .insert([pedido])
            .select()
            .single()
        
        if (error) {
            console.error('Error de Supabase:', error)
            
            // Manejar errores específicos
            if (error.code === '23505') {
                alert('Este pedido ya fue procesado. Por favor recarga la página.')
            } else if (error.message.includes('stock')) {
                alert('Error de stock. Por favor verifica tu carrito.')
                await carrito.verificarStockCarrito()
            } else {
                alert('Error al procesar el pedido. Por favor intenta de nuevo.')
            }
            return false
        }
        
        // ========== 7. ACTUALIZAR CUPÓN (INCREMENTAR USOS) ==========
        if (descuentoInfo.codigo && descuentoInfo.id) {
            try {
                await supabase
                    .from('cupones')
                    .update({ 
                        usos_actuales: supabase.raw('usos_actuales + 1')
                    })
                    .eq('id', descuentoInfo.id)
            } catch (cuponError) {
                console.error('Error actualizando usos del cupón:', cuponError)
                // No bloqueamos el pedido por esto
            }
        }
        
        // ========== 8. ACTUALIZAR EMAIL CON RESUMEN ==========
        await actualizarEmailConResumen(pedido, data.id)
        
        // ========== 9. ÉXITO: LIMPIAR Y MOSTRAR CONFIRMACIÓN ==========
        ultimoPedidoId = data.id
        
        // Vaciar carrito
        carrito.vaciar()
        
        // Limpiar cupón
        localStorage.removeItem('cupon_activo')
        localStorage.removeItem('cupon_descuento')
        
        // Guardar ID del pedido
        localStorage.setItem('ultimo_pedido_id', data.id)
        sessionStorage.setItem('pedido_exitoso', JSON.stringify({
            id: data.id,
            total: pedido.total,
            fecha: new Date().toISOString()
        }))
        
        // ========== 10. MOSTRAR CONFIRMACIÓN (NO REDIRIGIR INMEDIATAMENTE) ==========
        mostrarConfirmacionPedido(data, pedido)
        
        return true
        
    } catch (error) {
        console.error('Error crítico en procesarPedido:', error)
        alert('Error inesperado. Por favor intenta de nuevo o contacta a soporte.')
        return false
        
    } finally {
        // ========== REVERTIR BLOQUEO ==========
        checkoutEnProgreso = false
        if (botonConfirmar) {
            botonConfirmar.disabled = false
            botonConfirmar.value = botonOriginalText
        }
    }
}

/**
 * Actualiza el campo de email con el resumen completo del pedido
 * @param {Object} pedido - Objeto del pedido
 * @param {string} pedidoId - UUID del pedido
 */
async function actualizarEmailConResumen(pedido, pedidoId) {
    try {
        const mensajeField = document.getElementById('ContactForm1_contact-form-email-message')
        if (!mensajeField) return
        
        // Generar resumen en el mismo formato del XML original
        let resumen = `=== RESUMEN DE PEDIDO ===\n`
        resumen += `ID: ${pedidoId}\n`
        resumen += `Fecha: ${new Date().toLocaleString('es-ES')}\n\n`
        resumen += `PRODUCTOS:\n`
        
        pedido.items.forEach((item, index) => {
            resumen += `${index + 1}. ${item.nombre}`
            if (item.opciones?.talla) resumen += ` (Talla: ${item.opciones.talla})`
            resumen += ` - ${item.cantidad} x $${item.precio.toFixed(2)} = $${item.subtotal.toFixed(2)}\n`
        })
        
        resumen += `\nSubtotal: $${pedido.subtotal.toFixed(2)} CUP\n`
        resumen += `Envío: $${pedido.envio.toFixed(2)} CUP\n`
        
        if (pedido.descuento > 0) {
            resumen += `Descuento (${pedido.cupon_aplicado}): -$${pedido.descuento.toFixed(2)} CUP\n`
        }
        
        resumen += `TOTAL: $${pedido.total.toFixed(2)} CUP\n`
        resumen += `Método de pago: ${pedido.metodo_pago}\n`
        resumen += `========================`
        
        mensajeField.value = resumen
        
        // Forzar eventos para que Blogger lo capture
        mensajeField.dispatchEvent(new Event('input', { bubbles: true }))
        mensajeField.dispatchEvent(new Event('change', { bubbles: true }))
        
    } catch (error) {
        console.error('Error actualizando email:', error)
    }
}

/**
 * Muestra la confirmación del pedido en la misma página (sorasuccessbox)
 * @param {Object} pedidoData - Datos del pedido desde Supabase
 * @param {Object} pedido - Datos del pedido original
 */
function mostrarConfirmacionPedido(pedidoData, pedido) {
    // Ocultar formulario
    const formulario = document.querySelector('.contact-form-widget.sora-billing-form')
    if (formulario) formulario.style.display = 'none'
    
    // Mostrar caja de éxito
    const successBox = document.getElementById('order-success-box')
    if (!successBox) return
    
    // Actualizar campos con datos del pedido
    const campos = {
        'success-customer-name': pedido.cliente.nombre,
        'success-payment-method': pedido.metodo_pago === 'efectivo' ? 'Efectivo' : pedido.metodo_pago,
        'success-order-id': pedidoData.id,
        'success-order-date': new Date().toLocaleString('es-ES'),
        'resumen-domicilio': `$${pedido.envio.toFixed(2)} CUP`,
        'success-total': `$${pedido.total.toFixed(2)} CUP`,
        'success-fullname': pedido.cliente.nombre,
        'success-email': pedido.cliente.email,
        'success-phone': pedido.cliente.telefono,
        'success-address': pedido.cliente.direccion,
        'success-reference': pedido.cliente.referencia || 'N/A',
        'success-locality': pedido.cliente.localidad
    }
    
    Object.entries(campos).forEach(([id, valor]) => {
        const el = document.getElementById(id)
        if (el) el.textContent = valor
    })
    
    successBox.style.display = 'block'
    
    // Scroll suave hasta la confirmación
    successBox.scrollIntoView({ behavior: 'smooth' })
}

/**
 * Inicializa los event listeners del checkout
 */
export function initCheckout() {
    // Botón Confirmar Pedido
    const confirmBtn = document.querySelector('.contact-form-button.soracustomform-ok')
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async (e) => {
            e.preventDefault()
            
            // Recolectar datos del formulario
            const form = document.querySelector('form[name="contact-form"]')
            if (!form) return
            
            const formData = new FormData(form)
            const metodoPago = document.querySelector('input[name="payment_method"]:checked')?.value || 'efectivo'
            
            const datos = {
                nombre: formData.get('name'),
                email: formData.get('email'),
                telefono: formData.get('phone'),
                direccion: formData.get('address'),
                referencia: formData.get('city'),
                localidad: formData.get('state'),
                carnet: formData.get('identity'),
                notas: formData.get('order_notes'),
                metodo_pago: metodoPago
            }
            
            await procesarPedido(datos)
        })
    }
    
    // Botón de impresión
    const printBtn = document.querySelector('.printsora')
    if (printBtn) {
        printBtn.addEventListener('click', (e) => {
            e.preventDefault()
            window.print()
        })
    }
}

// Inicializar automáticamente
document.addEventListener('DOMContentLoaded', initCheckout)

// Exponer función global para debugging
window.procesarPedido = procesarPedido