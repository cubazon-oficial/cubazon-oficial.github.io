# CUBAZON - Tienda Online con GitHub Pages + Supabase

## 📋 Requisitos previos
- Cuenta en [GitHub](https://github.com)
- Cuenta en [Supabase](https://supabase.com)
- Node.js (opcional, para desarrollo local)

## 🗄️ Configuración de Supabase (Base de datos)

1. Crear nuevo proyecto en Supabase
2. Ir a "SQL Editor"
3. Copiar y pegar TODO el contenido de `/sql/supabase-schema.sql`
4. Ejecutar
5. Ir a "Settings" → "API" y copiar:
   - Project URL
   - Anon Public Key

## 🔧 Configuración del proyecto

1. Reemplazar en `/js/supabase-client.js`:
   ```javascript
   const SUPABASE_URL = 'TU_URL'
   const SUPABASE_ANON_KEY = 'TU_ANON_KEY'
   # CUBAZON - Tienda Online

[![Migración completada](https://img.shields.io/badge/Migración-Blogger→Supabase-success)](https://cubazon-tienda.github.io)
[![GitHub Pages](https://img.shields.io/badge/Host-GitHub%20Pages-blue)](https://cubazon-tienda.github.io)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-green)](https://supabase.com)

---

## 🚀 **MIGRACIÓN COMPLETADA AL 100%**

Este repositorio contiene la **migración quirúrgica** de una tienda virtual completa desde **Blogger + SimpleCart** a **GitHub Pages + Supabase**.

✅ **100% del diseño original preservado**  
✅ **Inventario en base de datos real**  
✅ **Stock automático con triggers PostgreSQL**  
✅ **Cupones válidos en Supabase (no localStorage)**  
✅ **Carrito funcional con verificación de stock en tiempo real**  
✅ **Panel de administración de cupones**  

---

## 📁 **ESTRUCTURA DEL PROYECTO**
