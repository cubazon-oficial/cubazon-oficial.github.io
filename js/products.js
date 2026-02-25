// ============================================
// products.js - VERSIÓN CORREGIDA
// LINKS A producto.html?id= EN VEZ DE /producto/id
// ============================================

import { supabase } from './supabase-client.js'

export class ProductManager {
    constructor() {
        this.productos = []
        this.cargarProductos()
    }
    
    async cargarProductos() {
        try {
            const { data, error } = await supabase
                .from('productos')
                .select('*')
            
            if (error) throw error
            this.productos = data || []
            console.log(`✅ ${this.productos.length} productos cargados`)
            
            this.renderizarTodo()
            
        } catch (error) {
            console.error('Error cargando productos:', error)
        }
    }
    
    // ========== FILTROS ==========
    
    getProductosDestacados(limite = 8) {
        return this.productos
            .filter(p => p.destacado === true)
            .slice(0, limite)
    }
    
    getProductosOferta(limite = 4) {
        return this.productos
            .filter(p => p.oferta === true)
            .slice(0, limite)
    }
    
    getProductosPorEtiqueta(etiqueta, limite = 10) {
        return this.productos
            .filter(p => p.etiquetas && p.etiquetas.includes(etiqueta))
            .slice(0, limite)
    }
    
    getProductosRandom(limite = 12) {
        const shuffled = [...this.productos].sort(() => 0.5 - Math.random())
        return shuffled.slice(0, limite)
    }
    
    // ========== RENDERIZADO ==========
    
    renderizarTodo() {
        if (document.getElementById('home-slider')?.children.length === 0) {
            this.renderizarSlider()
        }
        if (document.getElementById('featured-products')?.children.length === 0) {
            this.renderizarDestacados()
        }
        if (document.getElementById('hot-posts-container')?.children.length === 0) {
            this.renderizarOfertas()
        }
        if (document.getElementById('consumibles-products')?.children.length === 0) {
            this.renderizarConsumibles()
        }
        if (document.getElementById('limpieza-products')?.children.length === 0) {
            this.renderizarLimpieza()
        }
        if (document.getElementById('latest-products')?.children.length === 0) {
            this.renderizarUltimos()
        }
    }
    
    renderizarSlider() {
        const container = document.getElementById('home-slider')
        if (!container) return
        
        const productos = this.getProductosDestacados(5)
        if (productos.length === 0) return
        
        let html = ''
        productos.forEach(p => {
            html += `
                <div class="slider-item">
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/1200x400'}" alt="${p.nombre}">
                    </a>
                    <div class="post-info-wrap">
                        <span class="post-tag">${p.etiquetas?.[0] || 'Destacado'}</span>
                        <h2 class="post-title">
                            <a href="/producto.html?id=${p.id}">${p.nombre}</a>
                        </h2>
                    </div>
                </div>
            `
        })
        
        container.innerHTML = html
    }
    
    // ========== PRODUCTOS DESTACADOS ==========
    renderizarDestacados() {
        const container = document.getElementById('featured-products')
        if (!container || container.children.length > 0) return
        
        const productos = this.getProductosDestacados(8)
        if (productos.length === 0) return
        
        productos.forEach(p => {
            const card = document.createElement('div')
            card.className = 'product-card'
            
            if (p.stock <= 0) {
                // ✅ PRODUCTO AGOTADO
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" class="product-image" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                        <h3 class="product-title">${p.nombre}</h3>
                    </a>
                    <div class="product-rating">
                        <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star-half-o"></i>
                    </div>
                    <div style="margin: 20px 0;">
                        <span class="product-agotado" style="display: block; width: 100%;">
                            <i class="fa fa-ban"></i> AGOTADO
                        </span>
                    </div>
                    <div style="color: #6c757d; font-size: 13px; text-align: center; margin-top: 10px;">
                        No disponible por el momento
                    </div>
                `
            } else {
                // ✅ PRODUCTO CON STOCK
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" class="product-image" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                        <h3 class="product-title">${p.nombre}</h3>
                    </a>
                    <div class="product-rating">
                        <i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star"></i><i class="fa fa-star-half-o"></i>
                    </div>
                    <div class="product-price">$${p.precio.toFixed(2)} <small>CUP</small></div>
                    <div class="product-stock">
                        <i class="fa fa-check-circle" style="color: #007600;"></i> Stock: ${p.stock} unidades
                    </div>
                    <button class="btn-add-cart" onclick="window.cart.agregar(${p.id}, 1)">
                        <i class="fa fa-shopping-cart"></i> Agregar
                    </button>
                `
            }
            
            container.appendChild(card)
        })
    }
    
    // ========== OFERTAS CALIENTES ==========
    renderizarOfertas() {
        const container = document.getElementById('hot-posts-container')
        if (!container || container.children.length > 0) return
        
        const productos = this.getProductosOferta(4)
        if (productos.length === 0) return
        
        productos.forEach(p => {
            const card = document.createElement('div')
            card.className = 'product-card'
            
            if (p.stock <= 0) {
                // ✅ PRODUCTO AGOTADO
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" class="product-image" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                        <h3 class="product-title">${p.nombre}</h3>
                    </a>
                    <div style="margin: 20px 0;">
                        <span class="product-agotado" style="display: block; width: 100%;">
                            <i class="fa fa-ban"></i> AGOTADO
                        </span>
                    </div>
                    <div style="color: #6c757d; font-size: 13px; text-align: center;">
                        Producto sin stock
                    </div>
                `
            } else {
                // ✅ PRODUCTO CON OFERTA Y STOCK
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" class="product-image" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                        <h3 class="product-title">${p.nombre}</h3>
                    </a>
                    <div class="product-price">
                        $${(p.precio_oferta || p.precio).toFixed(2)} <small>CUP</small>
                        ${p.precio_oferta ? `<span style="text-decoration: line-through; color: #999; font-size: 14px; margin-left: 8px;">$${p.precio.toFixed(2)}</span>` : ''}
                    </div>
                    <button class="btn-add-cart" onclick="window.cart.agregar(${p.id}, 1)">
                        <i class="fa fa-shopping-cart"></i> Agregar
                    </button>
                `
            }
            
            container.appendChild(card)
        })
    }
    
    // ========== CONSUMIBLES ==========
    renderizarConsumibles() {
        const container = document.getElementById('consumibles-products')
        if (!container || container.children.length > 0) return
        
        const productos = this.getProductosPorEtiqueta('Consumibles', 3)
        if (productos.length === 0) return
        
        productos.forEach(p => {
            const card = document.createElement('div')
            card.className = 'product-card'
            card.style.flexDirection = 'row'
            card.style.alignItems = 'center'
            
            if (p.stock <= 0) {
                // ✅ PRODUCTO AGOTADO
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" style="width: 100px; height: 100px; object-fit: contain; margin-right: 20px;" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <div style="flex: 1;">
                        <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                            <h3 class="product-title" style="height: auto;">${p.nombre}</h3>
                        </a>
                        <span class="product-agotado" style="display: inline-block; margin: 10px 0;">
                            <i class="fa fa-ban"></i> AGOTADO
                        </span>
                    </div>
                `
            } else {
                // ✅ PRODUCTO CON STOCK
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" style="width: 100px; height: 100px; object-fit: contain; margin-right: 20px;" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <div style="flex: 1;">
                        <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                            <h3 class="product-title" style="height: auto;">${p.nombre}</h3>
                        </a>
                        <div class="product-price">$${p.precio.toFixed(2)} CUP</div>
                        <button class="btn-add-cart" style="width: auto;" onclick="window.cart.agregar(${p.id}, 1)">
                            <i class="fa fa-shopping-cart"></i> Agregar
                        </button>
                    </div>
                `
            }
            
            container.appendChild(card)
        })
    }
    
    // ========== LIMPIEZA ==========
    renderizarLimpieza() {
        const container = document.getElementById('limpieza-products')
        if (!container || container.children.length > 0) return
        
        const productos = this.getProductosPorEtiqueta('Limpieza', 3)
        if (productos.length === 0) return
        
        productos.forEach(p => {
            const card = document.createElement('div')
            card.className = 'product-card'
            card.style.flexDirection = 'row'
            card.style.alignItems = 'center'
            
            if (p.stock <= 0) {
                // ✅ PRODUCTO AGOTADO
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" style="width: 100px; height: 100px; object-fit: contain; margin-right: 20px;" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <div style="flex: 1;">
                        <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                            <h3 class="product-title" style="height: auto;">${p.nombre}</h3>
                        </a>
                        <span class="product-agotado" style="display: inline-block; margin: 10px 0;">
                            <i class="fa fa-ban"></i> AGOTADO
                        </span>
                    </div>
                `
            } else {
                // ✅ PRODUCTO CON STOCK
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" style="width: 100px; height: 100px; object-fit: contain; margin-right: 20px;" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <div style="flex: 1;">
                        <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                            <h3 class="product-title" style="height: auto;">${p.nombre}</h3>
                        </a>
                        <div class="product-price">$${p.precio.toFixed(2)} CUP</div>
                        <button class="btn-add-cart" style="width: auto;" onclick="window.cart.agregar(${p.id}, 1)">
                            <i class="fa fa-shopping-cart"></i> Agregar
                        </button>
                    </div>
                `
            }
            
            container.appendChild(card)
        })
    }
    
    // ========== ÚLTIMOS PRODUCTOS ==========
    renderizarUltimos() {
        const container = document.getElementById('latest-products')
        if (!container || container.children.length > 0) return
        
        const productos = this.getProductosRandom(12)
        if (productos.length === 0) return
        
        productos.forEach(p => {
            const card = document.createElement('div')
            card.className = 'product-card'
            
            if (p.stock <= 0) {
                // ✅ PRODUCTO AGOTADO
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" class="product-image" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                        <h3 class="product-title">${p.nombre}</h3>
                    </a>
                    <div style="margin: 20px 0;">
                        <span class="product-agotado" style="display: block; width: 100%;">
                            <i class="fa fa-ban"></i> AGOTADO
                        </span>
                    </div>
                    <div style="color: #6c757d; font-size: 13px; text-align: center;">
                        Sin stock disponible
                    </div>
                `
            } else {
                // ✅ PRODUCTO CON STOCK
                card.innerHTML = `
                    <a href="/producto.html?id=${p.id}">
                        <img src="${p.imagen || 'https://via.placeholder.com/400'}" class="product-image" alt="${p.nombre}" onerror="this.src='https://via.placeholder.com/400'">
                    </a>
                    <a href="/producto.html?id=${p.id}" style="text-decoration: none; color: inherit;">
                        <h3 class="product-title">${p.nombre}</h3>
                    </a>
                    <div class="product-price">$${p.precio.toFixed(2)} <small>CUP</small></div>
                    <button class="btn-add-cart" onclick="window.cart.agregar(${p.id}, 1)">
                        <i class="fa fa-shopping-cart"></i> Agregar
                    </button>
                `
            }
            
            container.appendChild(card)
        })
    }
}

// ========== INSTANCIA GLOBAL ==========
export const productManager = new ProductManager()
window.productManager = productManager
// ========== LISTA DE DESEOS ==========
export const listaDeseos = {
    async obtenerLista(usuarioId) {
        if (!usuarioId) return [];
        
        const { data, error } = await supabase
            .from('lista_deseos')
            .select('producto_id')
            .eq('usuario_id', usuarioId);
        
        if (error) {
            console.error('Error cargando lista de deseos:', error);
            return [];
        }
        
        return data.map(item => item.producto_id);
    },
    
    async toggle(productoId, usuarioId) {
        if (!usuarioId) {
            Swal.fire({
                icon: 'info',
                title: 'Inicia sesión',
                text: 'Debes iniciar sesión para guardar productos en tu lista de deseos',
                showCancelButton: true,
                confirmButtonText: 'Iniciar sesión',
                cancelButtonText: 'Cancelar'
            }).then(result => {
                if (result.isConfirmed) {
                    window.location.href = '/login.html';
                }
            });
            return false;
        }
        
        // Verificar si ya está en la lista
        const { data: existe } = await supabase
            .from('lista_deseos')
            .select('id')
            .eq('usuario_id', usuarioId)
            .eq('producto_id', productoId)
            .maybeSingle();
        
        if (existe) {
            // Eliminar de la lista
            const { error } = await supabase
                .from('lista_deseos')
                .delete()
                .eq('usuario_id', usuarioId)
                .eq('producto_id', productoId);
            
            if (!error) {
                Swal.fire({
                    icon: 'success',
                    title: 'Eliminado',
                    text: 'Producto eliminado de tu lista de deseos',
                    timer: 1500,
                    showConfirmButton: false
                });
                return false;
            }
        } else {
            // Agregar a la lista
            const { error } = await supabase
                .from('lista_deseos')
                .insert([{ usuario_id: usuarioId, producto_id: productoId }]);
            
            if (!error) {
                Swal.fire({
                    icon: 'success',
                    title: '¡Guardado!',
                    text: 'Producto agregado a tu lista de deseos',
                    timer: 1500,
                    showConfirmButton: false
                });
                return true;
            }
        }
    }
};

// Exponer globalmente
window.listaDeseos = listaDeseos;