// ============================================
// cart.js - VERSIÓN DEFINITIVA
// Con imágenes corregidas y carrito que no se cierra
// Preview con productos en scroll y botones fijos
// ============================================

import { supabase } from './supabase-client.js'

export class Carrito {
    constructor() {
        this.items = []
    }
    
    // ========== PERSISTENCIA ==========
    
    cargarDeLocalStorage() {
        try {
            const guardado = localStorage.getItem('cubazon_carrito')
            if (guardado) {
                this.items = JSON.parse(guardado)
                console.log(`✅ Carrito cargado: ${this.cantidadTotal()} productos`)
            }
        } catch (e) {
            console.error('Error cargando carrito:', e)
            this.items = []
        }
        return this.items
    }
    
    guardarEnLocalStorage() {
        localStorage.setItem('cubazon_carrito', JSON.stringify(this.items))
    }
    
    // ========== OPERACIONES ==========
    
    async agregar(productoId, cantidad = 1, opciones = {}) {
        try {
            console.log('🔍 Buscando producto ID:', productoId)
            
            const { data: producto, error } = await supabase
                .from('productos')
                .select('id, nombre, precio, stock, oferta, precio_oferta, imagen_url')
                .eq('id', productoId)
                .single()
            
            if (error || !producto) {
                console.error('❌ Producto no encontrado:', error)
                this.mostrarError('Producto no encontrado')
                return false
            }
            
            if (producto.stock < cantidad) {
                this.mostrarError(`Solo hay ${producto.stock} unidades disponibles`)
                return false
            }
            
            const precioFinal = (producto.oferta && producto.precio_oferta) 
                ? producto.precio_oferta 
                : producto.precio
            
            const itemExistente = this.items.find(item => 
                item.producto_id === productoId && 
                JSON.stringify(item.opciones) === JSON.stringify(opciones)
            )
            
            if (itemExistente) {
                itemExistente.cantidad += cantidad
                itemExistente.precio = precioFinal
            } else {
                this.items.push({
                    id: `${productoId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    producto_id: productoId,
                    nombre: producto.nombre,
                    precio: precioFinal,
                    cantidad: cantidad,
                    imagen_url: producto.imagen_url || '/assets/images/no-image.png',
                    opciones: opciones
                })
            }
            
            this.guardarEnLocalStorage()
            this.actualizarInterfaz()
            this.mostrarExito(`${producto.nombre} agregado al carrito`)
            return true
            
        } catch (error) {
            console.error('Error al agregar:', error)
            this.mostrarError('Error al agregar producto')
            return false
        }
    }
    
    eliminar(itemId) {
        const item = this.items.find(i => i.id === itemId)
        if (item) {
            this.items = this.items.filter(i => i.id !== itemId)
            this.guardarEnLocalStorage()
            this.actualizarInterfaz()
            this.mostrarExito(`${item.nombre} eliminado del carrito`, 'info')
            return true
        }
        return false
    }
    
    vaciar() {
        if (this.items.length === 0) {
            this.mostrarExito('El carrito ya está vacío', 'info')
            return false
        }
        
        this.items = []
        this.guardarEnLocalStorage()
        this.actualizarInterfaz()
        this.mostrarExito('✅ Carrito vaciado completamente', 'success')
        
        if (window.location.pathname.includes('/p/cart.html')) {
            this.renderizarCarritoPage()
        }
        
        return true
    }
    
    // ========== FUNCIONES DE CANTIDAD ==========
    aumentarCantidad(id) {
        const item = this.items.find(i => i.id === id)
        if (item) {
            item.cantidad = (item.cantidad || 1) + 1
            this.guardarEnLocalStorage()
            this.actualizarInterfaz()
        }
    }
    
    disminuirCantidad(id) {
        const item = this.items.find(i => i.id === id)
        if (item) {
            if (item.cantidad <= 1) {
                this.eliminar(id)
            } else {
                item.cantidad -= 1
                this.guardarEnLocalStorage()
                this.actualizarInterfaz()
            }
        }
    }
    
    // ========== ALIAS PARA COMPATIBILIDAD ==========
    empty() { return this.vaciar() }
    simpleCart_empty() { return this.vaciar() }
    
    async actualizarCantidad(itemId, nuevaCantidad) {
        if (nuevaCantidad <= 0) return this.eliminar(itemId)
        
        const item = this.items.find(i => i.id === itemId)
        if (!item) return false
        
        const { data } = await supabase
            .from('productos')
            .select('stock')
            .eq('id', item.producto_id)
            .single()
        
        if (data && data.stock < nuevaCantidad) {
            this.mostrarError(`Solo hay ${data.stock} unidades disponibles`)
            return false
        }
        
        item.cantidad = nuevaCantidad
        this.guardarEnLocalStorage()
        this.actualizarInterfaz()
        return true
    }
    
    // ========== CÁLCULOS ==========
    subtotal() {
        return this.items.reduce((sum, item) => sum + (item.precio * item.cantidad), 0)
    }
    
    cantidadTotal() {
        return this.items.reduce((sum, item) => sum + item.cantidad, 0)
    }
    
    // ========== RENDERIZADO ==========
    
    actualizarInterfaz() {
        const cantidad = this.cantidadTotal()
        const subtotal = this.subtotal()
        
        document.querySelectorAll('.simpleCart_quantity, #cart-counter').forEach(el => {
            if (el) el.textContent = cantidad
        })
        
        document.querySelectorAll('.simpleCart_total, #cart-total').forEach(el => {
            if (el) el.textContent = `$${subtotal.toFixed(2)} CUP`
        })
        
        this.renderizarPreviewCarrito()
        
        if (window.location.pathname.includes('/p/cart.html')) {
            this.renderizarCarritoPage()
        }
        
        window.dispatchEvent(new CustomEvent('carrito-actualizado', {
            detail: { items: this.items, subtotal, cantidad }
        }))
    }
    
    // ========== PREVIEW CARRITO - CORREGIDO: solo productos, total en footer ==========
    renderizarPreviewCarrito() {
        const container = document.querySelector('.simpleCart_items');
        const totalContainer = document.getElementById('cart-preview-total-amount');
        if (!container) return
        
        if (this.items.length === 0) {
            container.innerHTML = '<p style="padding: 20px; text-align: center; color: #666;">Tu carrito está vacío</p>'
            if (totalContainer) totalContainer.textContent = '$0.00 CUP'
            return
        }
        
        let html = ''
        let totalGeneral = 0
        
        this.items.forEach(item => {
            const cantidad = item.cantidad || 1
            const subtotal = (item.precio || 0) * cantidad
            totalGeneral += subtotal
            
            const imagenSrc = item.imagen_url || item.imagen || '/assets/images/no-image.png'
            
            html += `
                <div class="cart-preview-item" data-id="${item.id}">
                    <img src="${imagenSrc}" 
                         alt="${item.nombre}"
                         onerror="this.src='/assets/images/no-image.png'">
                    <div class="cart-preview-item-details">
                        <div class="cart-preview-item-name">${item.nombre}</div>
                        <div class="cart-preview-item-price">$${item.precio} CUP</div>
                        <div class="cart-preview-item-quantity">
                            <button class="cart-preview-quantity-btn" onclick="event.stopPropagation(); window.cart.disminuirCantidad('${item.id}')">
                                <i class="fa fa-minus"></i>
                            </button>
                            <span class="cart-preview-quantity-number">${cantidad}</span>
                            <button class="cart-preview-quantity-btn" onclick="event.stopPropagation(); window.cart.aumentarCantidad('${item.id}')">
                                <i class="fa fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="cart-preview-item-remove" onclick="event.stopPropagation(); window.cart.eliminar('${item.id}')" title="Eliminar producto">
                        <i class="fa fa-trash"></i>
                    </div>
                </div>
                <div class="cart-preview-subtotal">
                    Subtotal: <strong style="color: #b12704;">$${subtotal.toFixed(2)} CUP</strong>
                </div>
            `
        })
        
        container.innerHTML = html
        
        // Actualizar total en el footer
        if (totalContainer) {
            totalContainer.textContent = `$${totalGeneral.toFixed(2)} CUP`
        }
        
        // Actualizar otros totales si existen (por ejemplo en la página de carrito)
        const totalElement = document.getElementById('cart-total')
        if (totalElement) totalElement.textContent = `$${totalGeneral.toFixed(2)} CUP`
    }
    
    // ========== PÁGINA DE CARRITO COMPLETA ==========
    renderizarCarritoPage() {
        const container = document.getElementById('cart-content')
        if (!container) return
        
        if (this.items.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 80px 20px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <i class="fa fa-shopping-cart" style="font-size: 80px; color: #dee2e6; margin-bottom: 20px;"></i>
                    <h2 style="margin-bottom: 15px; color: #0f1111;">Tu carrito está vacío</h2>
                    <p style="color: #6c757d; margin-bottom: 30px;">Explora nuestros productos y encuentra lo que buscas.</p>
                    <a href="/index.html" style="display: inline-block; background: #ffd814; padding: 14px 50px; border-radius: 30px; color: #0f1111; font-weight: 600; text-decoration: none; font-size: 16px;">
                        <i class="fa fa-arrow-left"></i> Ir a comprar
                    </a>
                </div>
            `
            return
        }
        
        let itemsHtml = ''
        this.items.forEach(item => {
            const imagenSrc = item.imagen_url || item.imagen || '/assets/images/no-image.png'
            
            itemsHtml += `
                <div style="display: flex; gap: 25px; padding: 25px; border-bottom: 1px solid #dee2e6; background: white;">
                    <img src="${imagenSrc}" 
                         style="width: 120px; height: 120px; object-fit: contain; border: 1px solid #ddd; border-radius: 8px; background: #f8f9fa;" 
                         onerror="this.src='/assets/images/no-image.png'">
                    
                    <div style="flex: 1;">
                        <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px; color: #0f1111;">${item.nombre}</div>
                        
                        <div style="color: #b12704; font-weight: 700; font-size: 22px; margin-bottom: 15px;">
                            $${item.precio.toFixed(2)} CUP
                        </div>
                        
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="display: flex; align-items: center; gap: 12px; background: #f8f9fa; padding: 5px 10px; border-radius: 8px;">
                                <button onclick="window.cart.disminuirCantidad('${item.id}')" 
                                        style="width: 35px; height: 35px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 16px;">
                                    <i class="fa fa-minus"></i>
                                </button>
                                
                                <span style="min-width: 40px; text-align: center; font-weight: 600; font-size: 16px;">${item.cantidad}</span>
                                
                                <button onclick="window.cart.aumentarCantidad('${item.id}')" 
                                        style="width: 35px; height: 35px; background: white; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 16px;">
                                    <i class="fa fa-plus"></i>
                                </button>
                            </div>
                            
                            <button onclick="window.cart.eliminar('${item.id}')" 
                                    style="background: none; border: none; color: #dc3545; cursor: pointer; font-size: 16px; display: flex; align-items: center; gap: 5px;">
                                <i class="fa fa-trash"></i> Eliminar
                            </button>
                        </div>
                        
                        <div style="margin-top: 15px; font-size: 14px; color: #6c757d;">
                            ${item.opciones?.talla ? `<span>Talla: ${item.opciones.talla}</span>` : ''}
                        </div>
                    </div>
                    
                    <div style="font-weight: 700; color: #b12704; font-size: 22px; min-width: 150px; text-align: right;">
                        $${(item.precio * item.cantidad).toFixed(2)}
                    </div>
                </div>
            `
        })
        
        const subtotal = this.subtotal()
        const cantidad = this.cantidadTotal()
        
        container.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 400px; gap: 30px;">
                <div style="background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); overflow: hidden;">
                    <div style="padding: 25px; border-bottom: 2px solid #f0f2f5;">
                        <h2 style="font-size: 24px; font-weight: 700;">Carrito de Compras</h2>
                        <p style="color: #6c757d;">${cantidad} producto(s)</p>
                    </div>
                    ${itemsHtml}
                </div>
                
                <div style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); height: fit-content;">
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 25px;">Resumen del pedido</h3>
                    
                    <div style="display: flex; justify-content: space-between; margin: 15px 0;">
                        <span style="color: #6c757d;">Subtotal (${cantidad} productos):</span>
                        <span style="font-weight: 600;">$${subtotal.toFixed(2)} CUP</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin: 15px 0; color: #059669;">
                        <span>Envío:</span>
                        <span>Calculado al pagar</span>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; margin: 25px 0; padding-top: 25px; border-top: 2px solid #dee2e6; font-size: 24px; font-weight: 700;">
                        <span>Total:</span>
                        <span style="color: #b12704;">$${subtotal.toFixed(2)} CUP</span>
                    </div>
                    
                    <a href="/p/checkout.html" style="display: block; background: #ffd814; padding: 18px; border-radius: 30px; color: #0f1111; font-weight: 600; text-decoration: none; text-align: center; font-size: 18px; margin-top: 20px;">
                        <i class="fa fa-lock"></i> Proceder al pago
                    </a>
                    
                    <button onclick="window.cart.vaciar()" style="width: 100%; background: #f8f9fa; padding: 15px; border: 2px solid #dee2e6; border-radius: 30px; margin-top: 15px; cursor: pointer; font-weight: 600; font-size: 16px;">
                        <i class="fa fa-trash"></i> Vaciar carrito
                    </button>
                    
                    <a href="/index.html" style="display: block; text-align: center; margin-top: 20px; color: #007185; text-decoration: none;">
                        <i class="fa fa-arrow-left"></i> Seguir comprando
                    </a>
                </div>
            </div>
        `
    }
    
    // ========== NOTIFICACIONES ==========
    
    mostrarExito(mensaje, tipo = 'success') {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: tipo,
                title: tipo === 'success' ? '¡Listo!' : 'Información',
                text: mensaje,
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            })
        } else {
            alert(mensaje)
        }
    }
    
    mostrarError(mensaje) {
        this.mostrarExito(mensaje, 'error')
    }
}

// ========== EXPORTAR INICIALIZADOR ==========
let carritoInstance

export function initCarrito() {
    if (!carritoInstance) {
        carritoInstance = new Carrito()
    }
    return carritoInstance
}

export const carrito = initCarrito()
window.cart = carrito