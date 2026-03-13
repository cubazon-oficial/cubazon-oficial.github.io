// ============================================
// meta-tags.js - Configuración SEO para todas las páginas
// ============================================

export const metaConfig = {
  default: {
    title: 'CUBAZON · Tienda online en Sagua de Tánamo',
    description: 'Compra productos en Sagua de Tánamo y toda Cuba. Ropa, electrónica, hogar y más. Vendedores locales verificados.',
    keywords: 'CUBAZON, tienda online, Sagua de Tánamo, comprar en Cuba, productos Cuba, vendedores locales',
    image: 'https://cubazon.com/assets/images/og-image.jpg'
  },
  '/producto-vendedor.html': {
    title: ' producto en CUBAZON',
    description: 'Compra este producto de un vendedor local en Sagua de Tánamo. Pago contra entrega.',
  },
  '/mi-cuenta.html': {
    title: 'Mi cuenta · CUBAZON',
    description: 'Gestiona tu perfil, pedidos y tienda en CUBAZON.',
    noindex: true
  },
  '/admin/': {
    noindex: true
  }
};

export function generarMetaTags(path, data = {}) {
  let config = metaConfig.default;
  
  // Buscar configuración específica para esta ruta
  for (const [ruta, conf] of Object.entries(metaConfig)) {
    if (path.includes(ruta)) {
      config = { ...config, ...conf };
      break;
    }
  }
  
  // Reemplazar variables
  let titulo = config.title;
  let descripcion = config.description;
  
  if (data.producto) {
    titulo = titulo.replace(' producto', ` ${data.producto.nombre}`);
    descripcion = descripcion.replace('este producto', `${data.producto.nombre} por $${data.producto.precio}`);
  }
  
  return {
    title: titulo,
    description: descripcion,
    keywords: config.keywords,
    image: config.image,
    noindex: config.noindex || false
  };
}