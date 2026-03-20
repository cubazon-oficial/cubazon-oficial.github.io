// ============================================
// admin-coupons.js - PANEL DE ADMINISTRACIÓN
// VERSIÓN CORREGIDA - SIN CONFLICTO DE VARIABLES
// ============================================

// Usar variable diferente para evitar conflicto
const adminSupabase = window.supabase;

// Estado global
let cuponesCache = []
let filtroActual = ''

// ========== CLASE PRINCIPAL ==========
export class AdminCoupons {
    
    constructor() {
        this.init()
    }
    
    async init() {
        await this.cargarCupones()
        this.initEventListeners()
        await this.actualizarEstadisticas()
        this.ocultarLoading()
    }
    
    // ========== LOADING ==========
    mostrarLoading() {
        const loading = document.getElementById('loadingIndicator')
        const list = document.getElementById('couponsList')
        if (loading) loading.style.display = 'block'
        if (list) list.style.opacity = '0.5'
    }
    
    ocultarLoading() {
        const loading = document.getElementById('loadingIndicator')
        const list = document.getElementById('couponsList')
        if (loading) loading.style.display = 'none'
        if (list) list.style.opacity = '1'
    }
    
    // ========== CRUD CUPONES ==========
    
    async cargarCupones() {
        try {
            this.mostrarLoading()
            
            const { data, error } = await adminSupabase
                .from('cupones')
                .select('*')
                .order('created_at', { ascending: false })
            
            if (error) throw error
            
            cuponesCache = data || []
            this.filtrarYRenderizar()
            await this.actualizarEstadisticas()
            
        } catch (error) {
            console.error('Error cargando cupones:', error)
            this.mostrarError('Error al cargar cupones')
        } finally {
            this.ocultarLoading()
        }
    }
    
    async crearCupon(cuponData) {
        try {
            // Validaciones
            if (!cuponData.codigo || cuponData.codigo.length < 5) {
                throw new Error('El código debe tener al menos 5 caracteres')
            }
            
            if (!cuponData.descuento || cuponData.descuento <= 0) {
                throw new Error('El descuento debe ser mayor a 0')
            }
            
            if (cuponData.tipo === 'porcentaje' && cuponData.descuento > 100) {
                throw new Error('El descuento porcentual no puede ser mayor a 100%')
            }
            
            // Normalizar código
            const codigoNormalizado = cuponData.codigo.toUpperCase().trim()
            
            // Verificar si ya existe
            const { data: existente, error: checkError } = await adminSupabase
                .from('cupones')
                .select('codigo')
                .eq('codigo', codigoNormalizado)
                .maybeSingle()
            
            if (checkError) throw checkError
            if (existente) {
                throw new Error('Ya existe un cupón con ese código')
            }
            
            // Crear cupón
            const nuevoCupon = {
                codigo: codigoNormalizado,
                descuento: parseFloat(cuponData.descuento),
                tipo: cuponData.tipo || 'porcentaje',
                max_usos: parseInt(cuponData.max_usos) || 1,
                usos_actuales: 0,
                expiracion: cuponData.expiracion || null,
                activo: cuponData.activo !== undefined ? cuponData.activo : true,
                created_at: new Date().toISOString()
            }
            
            const { data, error } = await adminSupabase
                .from('cupones')
                .insert([nuevoCupon])
                .select()
                .single()
            
            if (error) {
                if (error.code === '23505') {
                    throw new Error('Ya existe un cupón con ese código')
                }
                throw error
            }
            
            await this.cargarCupones()
            this.mostrarExito(`Cupón ${data.codigo} creado exitosamente`)
            return { success: true, data }
            
        } catch (error) {
            console.error('Error creando cupón:', error)
            this.mostrarError(error.message || 'Error al crear el cupón')
            return { success: false, error: error.message }
        }
    }
    
    async actualizarCupon(id, cuponData) {
        try {
            // Validar código único si se está cambiando
            if (cuponData.codigo) {
                const codigoNormalizado = cuponData.codigo.toUpperCase().trim()
                
                const { data: existente, error: checkError } = await adminSupabase
                    .from('cupones')
                    .select('id, codigo')
                    .eq('codigo', codigoNormalizado)
                    .neq('id', id)
                    .maybeSingle()
                
                if (checkError) throw checkError
                if (existente) {
                    throw new Error('Ya existe otro cupón con ese código')
                }
                
                cuponData.codigo = codigoNormalizado
            }
            
            // Validar descuento
            if (cuponData.descuento) {
                cuponData.descuento = parseFloat(cuponData.descuento)
                if (cuponData.descuento <= 0) {
                    throw new Error('El descuento debe ser mayor a 0')
                }
                if (cuponData.tipo === 'porcentaje' && cuponData.descuento > 100) {
                    throw new Error('El descuento porcentual no puede ser mayor a 100%')
                }
            }
            
            const { data, error } = await adminSupabase
                .from('cupones')
                .update({
                    codigo: cuponData.codigo,
                    descuento: cuponData.descuento,
                    tipo: cuponData.tipo,
                    max_usos: cuponData.max_usos ? parseInt(cuponData.max_usos) : undefined,
                    expiracion: cuponData.expiracion || null,
                    activo: cuponData.activo
                })
                .eq('id', id)
                .select()
                .single()
            
            if (error) throw error
            
            await this.cargarCupones()
            this.mostrarExito(`Cupón ${data.codigo} actualizado`)
            return { success: true, data }
            
        } catch (error) {
            console.error('Error actualizando cupón:', error)
            this.mostrarError(error.message || 'Error al actualizar el cupón')
            return { success: false, error: error.message }
        }
    }
    
    async eliminarCupon(id) {
        try {
            if (!confirm('¿Estás seguro de eliminar este cupón? Esta acción no se puede deshacer.')) {
                return { success: false, cancelled: true }
            }
            
            const { error } = await adminSupabase
                .from('cupones')
                .delete()
                .eq('id', id)
            
            if (error) throw error
            
            await this.cargarCupones()
            this.mostrarExito('Cupón eliminado exitosamente')
            return { success: true }
            
        } catch (error) {
            console.error('Error eliminando cupón:', error)
            this.mostrarError('Error al eliminar el cupón')
            return { success: false, error: error.message }
        }
    }
    
    async resetearUsos(id) {
        try {
            if (!confirm('¿Resetear el contador de usos de este cupón?')) {
                return { success: false, cancelled: true }
            }
            
            const { data, error } = await adminSupabase
                .from('cupones')
                .update({ usos_actuales: 0 })
                .eq('id', id)
                .select()
                .single()
            
            if (error) throw error
            
            await this.cargarCupones()
            this.mostrarExito(`Usos del cupón ${data.codigo} reseteados a 0`)
            return { success: true, data }
            
        } catch (error) {
            console.error('Error reseteando usos:', error)
            this.mostrarError('Error al resetear los usos')
            return { success: false, error: error.message }
        }
    }
    
    async resetearTodosLosUsos() {
        try {
            if (!confirm('⚠️ ¿Resetear TODOS los contadores de uso de TODOS los cupones?')) {
                return { success: false, cancelled: true }
            }
            
            if (!confirm('¿Estás ABSOLUTAMENTE SEGURO? Esta acción no se puede deshacer.')) {
                return { success: false, cancelled: true }
            }
            
            const { error } = await adminSupabase
                .from('cupones')
                .update({ usos_actuales: 0 })
                .neq('id', 0)
            
            if (error) throw error
            
            await this.cargarCupones()
            this.mostrarExito('Todos los contadores han sido reseteados')
            return { success: true }
            
        } catch (error) {
            console.error('Error reseteando usos:', error)
            this.mostrarError('Error al resetear los usos')
            return { success: false, error: error.message }
        }
    }
    
    async eliminarExpirados() {
        try {
            const hoy = new Date().toISOString().split('T')[0]
            
            const { data, error } = await adminSupabase
                .from('cupones')
                .delete()
                .lt('expiracion', hoy)
                .select()
            
            if (error) throw error
            
            await this.cargarCupones()
            
            if (data.length === 0) {
                this.mostrarExito('No hay cupones expirados', 'info')
            } else {
                this.mostrarExito(`${data.length} cupón(es) expirado(s) eliminado(s)`)
            }
            
            return { success: true, eliminados: data.length }
            
        } catch (error) {
            console.error('Error eliminando expirados:', error)
            this.mostrarError('Error al eliminar cupones expirados')
            return { success: false, error: error.message }
        }
    }
    
    // ========== ESTADÍSTICAS ==========
    
    async actualizarEstadisticas() {
        try {
            const { data, error } = await adminSupabase
                .from('cupones')
                .select('*')
            
            if (error) throw error
            
            const hoy = new Date()
            const total = data.length
            const activos = data.filter(c => {
                if (!c.activo) return false
                if (c.expiracion && new Date(c.expiracion) < hoy) return false
                if (c.usos_actuales >= c.max_usos) return false
                return true
            }).length
            
            const proximosExpiracion = data.filter(c => {
                if (!c.expiracion) return false
                const exp = new Date(c.expiracion)
                const diff = exp - hoy
                const dias = diff / (1000 * 60 * 60 * 24)
                return dias > 0 && dias <= 7
            }).length
            
            const totalUsos = data.reduce((acc, c) => acc + (c.usos_actuales || 0), 0)
            
            document.getElementById('stat-total').textContent = total
            document.getElementById('stat-active').textContent = activos
            document.getElementById('stat-expiring-soon').textContent = proximosExpiracion
            document.getElementById('stat-total-uses').textContent = totalUsos
            
        } catch (error) {
            console.error('Error actualizando estadísticas:', error)
        }
    }
    
    // ========== FILTROS ==========
    
    filtrarCupones() {
        if (!filtroActual) return cuponesCache
        
        const termino = filtroActual.toLowerCase()
        return cuponesCache.filter(c => 
            c.codigo.toLowerCase().includes(termino) ||
            c.descuento.toString().includes(termino) ||
            c.tipo.toLowerCase().includes(termino) ||
            (c.expiracion && c.expiracion.includes(termino))
        )
    }
    
    filtrarYRenderizar() {
        const filtrados = this.filtrarCupones()
        this.renderizarLista(filtrados)
    }
    
    // ========== RENDERIZADO ==========
    
    renderizarLista(cupones) {
        const container = document.getElementById('couponsList')
        const noCouponsMsg = document.getElementById('noCouponsMessage')
        
        if (!container) return
        
        if (cupones.length === 0) {
            container.innerHTML = ''
            if (noCouponsMsg) noCouponsMsg.style.display = 'block'
            return
        }
        
        if (noCouponsMsg) noCouponsMsg.style.display = 'none'
        
        let html = ''
        cupones.forEach(cupon => {
            const estado = this.obtenerEstadoCupon(cupon)
            const estadoClass = this.obtenerClaseEstado(estado)
            const estadoTexto = this.obtenerTextoEstado(estado)
            
            const fechaExpiracion = cupon.expiracion 
                ? new Date(cupon.expiracion).toLocaleDateString('es-ES')
                : 'Sin expiración'
            
            html += `
                <div class="coupon-card" data-cupon-id="${cupon.id}">
                    <div class="coupon-header">
                        <span class="coupon-code-display">${cupon.codigo}</span>
                        <span class="coupon-status ${estadoClass}">${estadoTexto}</span>
                    </div>
                    <div class="coupon-details">
                        <div class="coupon-detail-item">
                            <span class="detail-label">Descuento</span>
                            <span class="detail-value discount">
                                ${cupon.tipo === 'porcentaje' ? `${cupon.descuento}%` : `$${cupon.descuento.toFixed(2)} CUP`}
                            </span>
                        </div>
                        <div class="coupon-detail-item">
                            <span class="detail-label">Tipo</span>
                            <span class="detail-value">
                                ${cupon.tipo === 'porcentaje' ? 'Porcentaje' : 'Monto fijo'}
                            </span>
                        </div>
                        <div class="coupon-detail-item">
                            <span class="detail-label">Usos</span>
                            <span class="detail-value">
                                ${cupon.usos_actuales || 0} / ${cupon.max_usos}
                            </span>
                        </div>
                        <div class="coupon-detail-item">
                            <span class="detail-label">Expiración</span>
                            <span class="detail-value">${fechaExpiracion}</span>
                        </div>
                        <div class="coupon-detail-item">
                            <span class="detail-label">Estado</span>
                            <span class="detail-value">${cupon.activo ? 'Activo' : 'Inactivo'}</span>
                        </div>
                        <div class="coupon-detail-item">
                            <span class="detail-label">Creado</span>
                            <span class="detail-value">${new Date(cupon.created_at).toLocaleDateString('es-ES')}</span>
                        </div>
                    </div>
                    <div class="coupon-actions">
                        <button class="btn-admin btn-small btn-edit" onclick="window.adminCoupons.editarCupon(${cupon.id})">
                            <i class="fa fa-edit"></i> Editar
                        </button>
                        <button class="btn-admin btn-small btn-reset" onclick="window.adminCoupons.resetearUsos(${cupon.id})">
                            <i class="fa fa-refresh"></i> Resetear Usos
                        </button>
                        <button class="btn-admin btn-small btn-delete" onclick="window.adminCoupons.eliminarCupon(${cupon.id})">
                            <i class="fa fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `
        })
        
        container.innerHTML = html
    }
    
    obtenerEstadoCupon(cupon) {
        if (!cupon.activo) return 'inactive'
        
        if (cupon.expiracion) {
            const hoy = new Date()
            const expiracion = new Date(cupon.expiracion)
            if (hoy > expiracion) return 'expired'
        }
        
        if (cupon.usos_actuales >= cupon.max_usos) return 'used'
        
        return 'active'
    }
    
    obtenerClaseEstado(estado) {
        switch (estado) {
            case 'active': return 'status-active'
            case 'used': return 'status-used'
            case 'expired':
            case 'inactive': return 'status-expired'
            default: return ''
        }
    }
    
    obtenerTextoEstado(estado) {
        switch (estado) {
            case 'active': return 'ACTIVO'
            case 'used': return 'AGOTADO'
            case 'expired': return 'EXPIRADO'
            case 'inactive': return 'INACTIVO'
            default: return 'DESCONOCIDO'
        }
    }
    
    // ========== MODALES ==========
    
    abrirModalNuevo() {
        this.abrirModal({
            id: null,
            codigo: this.generarCodigoSugerido(),
            descuento: 10,
            tipo: 'porcentaje',
            max_usos: 100,
            expiracion: this.generarFechaExpiracion(),
            activo: true
        })
    }
    
    async editarCupon(id) {
        const cupon = cuponesCache.find(c => c.id === id)
        if (!cupon) {
            this.mostrarError('Cupón no encontrado')
            return
        }
        
        this.abrirModal({
            id: cupon.id,
            codigo: cupon.codigo,
            descuento: cupon.descuento,
            tipo: cupon.tipo,
            max_usos: cupon.max_usos,
            expiracion: cupon.expiracion?.split('T')[0] || '',
            activo: cupon.activo
        })
    }
    
    abrirModal(cupon) {
        const modal = document.getElementById('couponModal')
        const title = document.getElementById('modalTitle')
        const idField = document.getElementById('couponId')
        const codigoField = document.getElementById('couponCode')
        const descuentoField = document.getElementById('couponDiscount')
        const tipoField = document.getElementById('discountType')
        const maxUsesField = document.getElementById('couponMaxUses')
        const expiryField = document.getElementById('couponExpiry')
        const statusField = document.getElementById('couponStatus')
        
        if (!modal) return
        
        const esEdicion = cupon.id !== null
        
        title.innerHTML = esEdicion 
            ? '<i class="fa fa-edit"></i> Editar Cupón'
            : '<i class="fa fa-plus-circle"></i> Nuevo Cupón'
        
        idField.value = cupon.id || ''
        codigoField.value = cupon.codigo || ''
        codigoField.readOnly = esEdicion
        descuentoField.value = cupon.descuento || 10
        tipoField.value = cupon.tipo || 'porcentaje'
        maxUsesField.value = cupon.max_usos || 100
        expiryField.value = cupon.expiracion || this.generarFechaExpiracion()
        statusField.value = cupon.activo ? 'true' : 'false'
        
        modal.style.display = 'flex'
    }
    
    cerrarModal() {
        const modal = document.getElementById('couponModal')
        if (modal) modal.style.display = 'none'
    }
    
    async guardarCupon() {
        const id = document.getElementById('couponId')?.value
        const codigo = document.getElementById('couponCode')?.value
        const descuento = document.getElementById('couponDiscount')?.value
        const tipo = document.getElementById('discountType')?.value
        const maxUsos = document.getElementById('couponMaxUses')?.value
        const expiracion = document.getElementById('couponExpiry')?.value
        const activo = document.getElementById('couponStatus')?.value === 'true'
        
        if (!codigo || !descuento || !maxUsos) {
            this.mostrarError('Por favor completa todos los campos requeridos')
            return
        }
        
        const cuponData = {
            codigo,
            descuento: parseFloat(descuento),
            tipo,
            max_usos: parseInt(maxUsos),
            expiracion: expiracion || null,
            activo
        }
        
        let resultado
        if (id) {
            resultado = await this.actualizarCupon(parseInt(id), cuponData)
        } else {
            resultado = await this.crearCupon(cuponData)
        }
        
        if (resultado.success) {
            this.cerrarModal()
        }
    }
    
    // ========== UTILIDADES ==========
    
    generarCodigoSugerido() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        let codigo = ''
        for (let i = 0; i < 15; i++) {
            codigo += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return codigo
    }
    
    generarFechaExpiracion() {
        const fecha = new Date()
        fecha.setFullYear(fecha.getFullYear() + 1)
        return fecha.toISOString().split('T')[0]
    }
    
    // ========== EXPORTAR CSV ==========
    
    exportarCupones() {
        if (cuponesCache.length === 0) {
            this.mostrarError('No hay cupones para exportar')
            return
        }
        
        const columnas = ['Código', 'Descuento', 'Tipo', 'Usos', 'Máximo', 'Expiración', 'Estado', 'Creado']
        
        const filas = cuponesCache.map(c => [
            c.codigo,
            c.tipo === 'porcentaje' ? `${c.descuento}%` : `$${c.descuento}`,
            c.tipo === 'porcentaje' ? 'Porcentaje' : 'Fijo',
            c.usos_actuales || 0,
            c.max_usos,
            c.expiracion ? new Date(c.expiracion).toLocaleDateString('es-ES') : 'Sin expiración',
            this.obtenerTextoEstado(this.obtenerEstadoCupon(c)),
            new Date(c.created_at).toLocaleDateString('es-ES')
        ])
        
        const csv = [
            columnas.join(','),
            ...filas.map(fila => fila.map(celda => `"${celda}"`).join(','))
        ].join('\n')
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        
        link.href = url
        link.setAttribute('download', `cupones_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }
    
    // ========== MENSAJES ==========
    
    mostrarExito(mensaje, tipo = 'success') {
        const alertDiv = document.getElementById('alertMessage')
        if (!alertDiv) {
            alert(mensaje)
            return
        }
        
        const icono = tipo === 'success' ? 'check-circle' : 'info-circle'
        alertDiv.className = `alert alert-${tipo}`
        alertDiv.innerHTML = `<i class="fa fa-${icono}"></i> ${mensaje}`
        alertDiv.style.display = 'flex'
        
        setTimeout(() => {
            alertDiv.style.display = 'none'
        }, 5000)
    }
    
    mostrarError(mensaje) {
        this.mostrarExito(mensaje, 'danger')
    }
    
    // ========== EVENT LISTENERS ==========
    
    initEventListeners() {
        // Botón nuevo cupón
        document.getElementById('createCouponBtn')?.addEventListener('click', () => {
            this.abrirModalNuevo()
        })
        
        // Botón resetear todos
        document.getElementById('resetAllCouponsBtn')?.addEventListener('click', () => {
            this.resetearTodosLosUsos()
        })
        
        // Botón eliminar expirados
        document.getElementById('deleteExpiredBtn')?.addEventListener('click', () => {
            this.eliminarExpirados()
        })
        
        // Botón exportar
        document.getElementById('exportCouponsBtn')?.addEventListener('click', () => {
            this.exportarCupones()
        })
        
        // Búsqueda
        const searchInput = document.getElementById('searchCoupon')
        const searchBtn = document.getElementById('searchBtn')
        
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                filtroActual = e.target.value
                this.filtrarYRenderizar()
            })
        }
        
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                if (searchInput) {
                    filtroActual = searchInput.value
                    this.filtrarYRenderizar()
                }
            })
        }
        
        // Modal
        document.getElementById('closeModalBtn')?.addEventListener('click', () => this.cerrarModal())
        document.getElementById('cancelModalBtn')?.addEventListener('click', () => this.cerrarModal())
        document.getElementById('saveCouponBtn')?.addEventListener('click', () => this.guardarCupon())
        
        // Cerrar modal al hacer clic fuera
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('couponModal')
            if (e.target === modal) {
                this.cerrarModal()
            }
        })
    }
}

// ========== INICIALIZACIÓN ==========
export async function initAdminCoupons() {
    if (!window.adminCoupons) {
        window.adminCoupons = new AdminCoupons()
    }
    return window.adminCoupons
}

// Auto-inicializar si estamos en admin
if (window.location.pathname.includes('/admin/coupons.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        // Verificar si ya hay sesión
        if (sessionStorage.getItem('couponAdminAuth') === 'true') {
            initAdminCoupons()
        }
    })
}

export default initAdminCoupons