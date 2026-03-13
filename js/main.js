// js/main.js - Sistema de autenticación y carrito global

// Verificar si el usuario está logueado al cargar cada página
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    updateCartCount();
    setupCartPreview();
});

// Función para verificar autenticación
function checkAuthStatus() {
    const userSection = document.getElementById('user-section');
    if (!userSection) return;
    
    // Verificar si hay usuario en sessionStorage/localStorage
    const userData = JSON.parse(localStorage.getItem('cubazon_user') || sessionStorage.getItem('cubazon_user') || 'null');
    
    if (userData && userData.id) {
        // Usuario autenticado - mostrar datos del usuario
        userSection.innerHTML = `
            <div class="user-dropdown">
                <button class="user-btn">
                    <i class="fas fa-user-circle"></i>
                    <span class="user-name">${userData.nombre || 'Mi cuenta'}</span>
                    <i class="fas fa-chevron-down"></i>
                </button>
                <div class="dropdown-menu">
                    <a href="mi-cuenta.html"><i class="fas fa-user"></i> Mi perfil</a>
                    <a href="mis-pedidos.html"><i class="fas fa-box"></i> Mis pedidos</a>
                    <a href="lista-deseos.html"><i class="fas fa-heart"></i> Lista de deseos</a>
                    <a href="notificaciones.html"><i class="fas fa-bell"></i> Notificaciones</a>
                    ${userData.tipo === 'vendedor' ? '<a href="panel-vendedor.html"><i class="fas fa-store"></i> Panel vendedor</a>' : ''}
                    ${userData.tipo === 'admin' ? '<a href="admin/"><i class="fas fa-cog"></i> Administración</a>' : ''}
                    <div class="dropdown-divider"></div>
                    <a href="#" onclick="logout(); return false;"><i class="fas fa-sign-out-alt"></i> Cerrar sesión</a>
                </div>
            </div>
        `;
        
        // Actualizar enlaces de "Iniciar sesión" en toda la página
        updateLoginLinks();
    } else {
        // Usuario no autenticado - mostrar botón de login/registro
        userSection.innerHTML = `
            <div class="auth-buttons">
                <a href="login.html" class="btn-login"><i class="fas fa-sign-in-alt"></i> Iniciar sesión</a>
                <a href="registro.html" class="btn-register"><i class="fas fa-user-plus"></i> Registrarse</a>
            </div>
        `;
    }
}

// Función para cerrar sesión
function logout() {
    localStorage.removeItem('cubazon_user');
    sessionStorage.removeItem('cubazon_user');
    window.location.href = 'index.html';
}

// Actualizar enlaces de login en toda la página
function updateLoginLinks() {
    document.querySelectorAll('a[href="login.html"]').forEach(link => {
        link.addEventListener('click', function(e) {
            if (localStorage.getItem('cubazon_user') || sessionStorage.getItem('cubazon_user')) {
                e.preventDefault();
                window.location.href = 'mi-cuenta.html';
            }
        });
    });
}

// Función para actualizar contador del carrito
function updateCartCount() {
    const cart = JSON.parse(localStorage.getItem('cubazon_cart') || '[]');
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const totalItems = cart.reduce((sum, item) => sum + (item.cantidad || 1), 0);
        cartCount.textContent = totalItems;
        cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
    }
}

// Configurar preview del carrito
function setupCartPreview() {
    const cartIcon = document.querySelector('.cart-icon');
    const cartPreview = document.getElementById('cart-preview');
    
    if (cartIcon && cartPreview) {
        cartIcon.addEventListener('mouseenter', function() {
            showCartPreview();
        });
        
        cartIcon.addEventListener('mouseleave', function() {
            setTimeout(() => {
                if (!cartPreview.matches(':hover')) {
                    cartPreview.classList.remove('show');
                }
            }, 200);
        });
        
        cartPreview.addEventListener('mouseleave', function() {
            cartPreview.classList.remove('show');
        });
    }
}

function showCartPreview() {
    const cart = JSON.parse(localStorage.getItem('cubazon_cart') || '[]');
    const cartPreview = document.getElementById('cart-preview');
    
    if (cart.length === 0) {
        cartPreview.innerHTML = '<p class="cart-empty">Tu carrito está vacío</p>';
    } else {
        let html = '<div class="cart-items">';
        let total = 0;
        
        cart.slice(0, 3).forEach(item => {
            const subtotal = item.precio * (item.cantidad || 1);
            total += subtotal;
            html += `
                <div class="cart-preview-item">
                    <img src="${item.imagen || 'img/default-product.jpg'}" alt="${item.nombre}">
                    <div class="item-info">
                        <h4>${item.nombre}</h4>
                        <p>${item.cantidad || 1} x $${item.precio.toFixed(2)}</p>
                    </div>
                </div>
            `;
        });
        
        if (cart.length > 3) {
            html += `<p class="cart-more">Y ${cart.length - 3} productos más...</p>`;
        }
        
        html += `</div>
                <div class="cart-total">Total: $${total.toFixed(2)}</div>
                <a href="carrito.html" class="btn-view-cart">Ver carrito completo</a>`;
        
        cartPreview.innerHTML = html;
    }
    
    cartPreview.classList.add('show');
}

// Añadir al carrito (función global)
function addToCart(producto) {
    let cart = JSON.parse(localStorage.getItem('cubazon_cart') || '[]');
    
    const existingItem = cart.find(item => item.id === producto.id);
    
    if (existingItem) {
        existingItem.cantidad = (existingItem.cantidad || 1) + 1;
    } else {
        cart.push({
            ...producto,
            cantidad: 1
        });
    }
    
    localStorage.setItem('cubazon_cart', JSON.stringify(cart));
    updateCartCount();
    showNotification('Producto añadido al carrito', 'success');
}

// Sistema de notificaciones
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}