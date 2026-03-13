// js/includes.js - SOLUCIÓN SIMPLE
// ESTE CÓDIGO ARREGLA TODAS LAS PÁGINAS AUTOMÁTICAMENTE

(function() {
  // Esperar a que la página cargue
  document.addEventListener('DOMContentLoaded', function() {
    
    // 1. VERIFICAR USUARIO AUTENTICADO
    const userData = JSON.parse(localStorage.getItem('cubazon_user') || sessionStorage.getItem('cubazon_user') || 'null');
    
    // 2. BUSCAR TODOS LOS BOTONES DE LOGIN/REGISTRO
    const loginLinks = document.querySelectorAll('a[href="login.html"]');
    const registerLinks = document.querySelectorAll('a[href="registro.html"]');
    
    // 3. SI EL USUARIO ESTÁ LOGUEADO, CAMBIAR LOS BOTONES
    if (userData && userData.id) {
      // Ocultar todos los enlaces de login/registro
      loginLinks.forEach(link => {
        link.style.display = 'none';
      });
      
      registerLinks.forEach(link => {
        link.style.display = 'none';
      });
      
      // Buscar dónde poner el nombre del usuario
      const userSections = document.querySelectorAll('.user-section, .header-right, .user-menu, [class*="user"], [class*="login"]');
      
      userSections.forEach(section => {
        // Verificar si ya tiene el nombre del usuario
        if (!section.querySelector('.user-name')) {
          // Agregar nombre del usuario
          const userHTML = `
                        <div class="user-info" style="display: inline-block; margin-left: 10px;">
                            <span style="font-weight: bold; color: #4a90e2;">👤 ${userData.nombre || 'Mi Cuenta'}</span>
                            <a href="mi-cuenta.html" style="margin-left: 10px; color: #666;">Perfil</a>
                            <a href="#" onclick="logout(); return false;" style="margin-left: 10px; color: #ff4444;">Salir</a>
                        </div>
                    `;
          section.innerHTML += userHTML;
        }
      });
    }
    
    // 4. ARREGLAR PRECIOS Y CARRITO
    fixPricesAndCart();
    
    // 5. ACTUALIZAR CONTADOR DEL CARRITO
    updateCartCountSimple();
  });
  
  // Función para arreglar precios
  function fixPricesAndCart() {
    // Buscar elementos que deberían tener precio
    document.querySelectorAll('.product-price, [class*="price"], [class*="precio"]').forEach(el => {
      // Si el elemento está vacío o tiene texto genérico
      if (!el.textContent.trim() || el.textContent.includes('Precio') || el.textContent.includes('$0')) {
        // Intentar obtener precio del localStorage o poner precio por defecto
        const productId = el.closest('[data-product-id]')?.dataset.productId;
        if (productId) {
          const savedPrice = localStorage.getItem(`product_price_${productId}`);
          if (savedPrice) {
            el.textContent = `$${parseFloat(savedPrice).toFixed(2)}`;
          }
        } else {
          // Si no hay ID, buscar en datos del producto
          const productData = findProductData(el);
          if (productData && productData.precio) {
            el.textContent = `$${parseFloat(productData.precio).toFixed(2)}`;
          }
        }
      }
    });
  }
  
  // Función para encontrar datos del producto
  function findProductData(element) {
    // Buscar en atributos data-
    const productDiv = element.closest('[data-product]');
    if (productDiv && productDiv.dataset.product) {
      try {
        return JSON.parse(productDiv.dataset.product);
      } catch (e) {}
    }
    
    // Buscar en variables globales
    if (window.productoActual) return window.productoActual;
    if (window.product) return window.product;
    
    return null;
  }
  
  // Función simple para actualizar carrito
  function updateCartCountSimple() {
    const cart = JSON.parse(localStorage.getItem('cubazon_cart') || '[]');
    const cartCounts = document.querySelectorAll('.cart-count, [class*="cart"] .count, [class*="carrito"] .contador');
    
    const totalItems = cart.reduce((sum, item) => sum + (item.cantidad || 1), 0);
    
    cartCounts.forEach(el => {
      el.textContent = totalItems;
      el.style.display = totalItems > 0 ? 'inline-block' : 'none';
    });
  }
  
  // Hacer logout global
  window.logout = function() {
    localStorage.removeItem('cubazon_user');
    sessionStorage.removeItem('cubazon_user');
    window.location.reload();
  };
  
  // Función para añadir al carrito simple
  window.addToCartSimple = function(productId, productName, productPrice) {
    let cart = JSON.parse(localStorage.getItem('cubazon_cart') || '[]');
    
    const existingItem = cart.find(item => item.id == productId);
    
    if (existingItem) {
      existingItem.cantidad = (existingItem.cantidad || 1) + 1;
    } else {
      cart.push({
        id: productId,
        nombre: productName || 'Producto',
        precio: parseFloat(productPrice) || 0,
        cantidad: 1
      });
    }
    
    localStorage.setItem('cubazon_cart', JSON.stringify(cart));
    updateCartCountSimple();
    alert('✅ Producto añadido al carrito');
  };
  
})();