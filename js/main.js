// ============================================
// main.js - CONTROL DE INICIALIZACIÓN
// Garantiza que el carrito se cargue PRIMERO
// ============================================

import { initCarrito } from './cart.js'
import { productManager } from './products.js'
import { cuponManager } from './coupons.js'

// Estado de inicialización
let initialized = false

export async function initApp() {
    if (initialized) return
    initialized = true
    
    console.log('🚀 Inicializando CUBAZON...')
    
    // 1. PRIMERO: Inicializar carrito
    const carrito = initCarrito()
    window.cart = carrito
    carrito.cargarDeLocalStorage()
    carrito.actualizarInterfaz()
    
    // 2. SEGUNDO: Cargar productos
    setTimeout(() => {
        productManager.cargarProductos()
    }, 100)
    
    // 3. Guardar antes de cerrar
    window.addEventListener('beforeunload', () => {
        carrito.guardarEnLocalStorage()
    })
}

// Iniciar inmediatamente
initApp()

export default initApp