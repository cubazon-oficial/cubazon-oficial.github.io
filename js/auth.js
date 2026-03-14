// ============================================
// auth.js - VERSIÓN FINAL CORREGIDA
// CON VERIFICACIÓN DE BANEO
// ============================================

import { supabase } from './supabase-client.js'

// ========== ESTADO GLOBAL ==========
let usuarioActual = null
let listeners = []

// ========== CLASE DE AUTENTICACIÓN ==========
export class AuthManager {
    constructor() {
        this.init()
    }

    async init() {
        try {
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.user) {
                await this.cargarUsuario(session.user.id)
            }
        } catch (error) {
            console.error('Error en init:', error)
        }
    }

    // ========== VERIFICAR SI EL USUARIO ESTÁ BANEADO ==========
    async verificarBaneo(userId) {
        try {
            const { data, error } = await supabase
                .from('perfiles')
                .select('estado, motivo_baneo')
                .eq('id', userId)
                .maybeSingle()
            
            if (error) {
                console.error('Error verificando baneo:', error)
                return false
            }
            
            return data?.estado === 'baneado'
        } catch (error) {
            console.error('Error en verificarBaneo:', error)
            return false
        }
    }

    // ========== CARGAR USUARIO ==========
    async cargarUsuario(userId) {
        try {
            console.log('👤 Cargando usuario:', userId)
            
            // Verificar si está baneado
            const baneado = await this.verificarBaneo(userId)
            if (baneado) {
                console.log('🚫 Usuario baneado, cerrando sesión')
                await this.cerrarSesion()
                return null
            }
            
            const { data, error } = await supabase
                .from('perfiles')
                .select('*')
                .eq('id', userId)
                .maybeSingle()
            
            if (error) {
                console.error('Error cargando perfil:', error)
            }
            
            if (data) {
                usuarioActual = {
                    id: userId,
                    ...data
                }
                console.log('✅ Usuario cargado desde perfiles:', usuarioActual.email)
            } else {
                const { data: userData } = await supabase.auth.getUser()
                
                if (userData?.user) {
                    usuarioActual = {
                        id: userId,
                        email: userData.user.email,
                        nombre: userData.user.user_metadata?.nombre || userData.user.email?.split('@')[0] || 'Usuario',
                        telefono: userData.user.user_metadata?.telefono || '',
                        estado: 'activo'
                    }
                }
            }
            
            this.notificarCambio()
            return usuarioActual
            
        } catch (error) {
            console.error('Error cargando usuario:', error)
            return null
        }
    }

    // ========== LOGIN ==========
    async login(email, password) {
        try {
            console.log('🔑 Iniciando sesión:', email)
            
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })
            
            if (error) {
                console.error('❌ Error de login:', error)
                return {
                    success: false,
                    error: error.message || 'Email o contraseña incorrectos'
                }
            }
            
            console.log('✅ Login exitoso en Supabase:', data.user.id)
            
            // VERIFICAR SI EL USUARIO ESTÁ BANEADO
            const baneado = await this.verificarBaneo(data.user.id)
            if (baneado) {
                console.log('🚫 Usuario baneado, cerrando sesión')
                await supabase.auth.signOut()
                return {
                    success: false,
                    error: 'Tu cuenta ha sido suspendida. Contacta al administrador.'
                }
            }
            
            await this.cargarUsuario(data.user.id)
            
            return {
                success: true,
                user: data.user,
                session: data.session
            }
            
        } catch (error) {
            console.error('❌ Error en login:', error)
            return {
                success: false,
                error: error.message || 'Error al iniciar sesión'
            }
        }
    }

    // ========== REGISTRO ==========
    async registrar(email, password, datos) {
        try {
            console.log('📝 Registrando usuario:', email)
            
            // Validaciones básicas
            if (!email || !email.includes('@')) {
                throw new Error('Email inválido')
            }
            
            if (!password || password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres')
            }
            
            // Registrar usuario en Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        nombre: datos.nombre || '',
                        telefono: datos.telefono || ''
                    }
                }
            })
            
            if (authError) {
                console.error('❌ Error de auth:', authError)
                
                if (authError.message?.includes('already registered')) {
                    throw new Error('Este email ya está registrado. Intenta iniciar sesión.')
                }
                if (authError.message?.includes('password')) {
                    throw new Error('La contraseña debe tener al menos 6 caracteres.')
                }
                
                throw authError
            }
            
            if (authData.user) {
                console.log('✅ Usuario creado en Auth:', authData.user.id)
                
                // El perfil se creará mediante trigger o en el login
                
                return {
                    success: true,
                    user: authData.user,
                    message: '✅ Registro exitoso. Revisa tu email para confirmar tu cuenta.'
                }
            }
            
            return {
                success: false,
                error: 'No se pudo crear el usuario'
            }
            
        } catch (error) {
            console.error('❌ Error en registro:', error)
            return {
                success: false,
                error: error.message || 'Error al crear la cuenta. Intenta de nuevo.'
            }
        }
    }

    // ========== CERRAR SESIÓN ==========
    async cerrarSesion() {
        try {
            await supabase.auth.signOut()
            usuarioActual = null
            this.notificarCambio()
            return { success: true }
        } catch (error) {
            console.error('❌ Error al cerrar sesión:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== RECUPERAR CONTRASEÑA ==========
    async recuperarPassword(email) {
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/actualizar-password.html`
            })
            
            if (error) throw error
            
            return {
                success: true,
                message: 'Te hemos enviado un email para recuperar tu contraseña'
            }
            
        } catch (error) {
            console.error('❌ Error recuperando contraseña:', error)
            return {
                success: false,
                error: error.message || 'Error al enviar el email'
            }
        }
    }

    // ========== ACTUALIZAR PERFIL ==========
    async actualizarPerfil(datos) {
        if (!usuarioActual) {
            return { success: false, error: 'No hay usuario autenticado' }
        }
        
        // Verificar que no esté baneado
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
            console.log('📝 Actualizando perfil:', usuarioActual.id)
            
            const { error } = await supabase
                .from('perfiles')
                .update({
                    nombre: datos.nombre,
                    telefono: datos.telefono,
                    direccion: datos.direccion || null,
                    localidad: datos.localidad || null,
                    referencia: datos.referencia || null,
                    carnet: datos.carnet || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', usuarioActual.id)
            
            if (error) throw error
            
            // Actualizar usuario actual
            usuarioActual = { ...usuarioActual, ...datos }
            this.notificarCambio()
            
            return { success: true, message: '✅ Perfil actualizado' }
            
        } catch (error) {
            console.error('❌ Error actualizando perfil:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== CAMBIAR CONTRASEÑA ==========
    async cambiarPassword(passwordActual, passwordNuevo) {
        if (!usuarioActual) {
            return { success: false, error: 'No hay usuario autenticado' }
        }
        
        // Verificar que no esté baneado
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
            // Verificar contraseña actual
            const { error: signError } = await supabase.auth.signInWithPassword({
                email: usuarioActual.email,
                password: passwordActual
            })
            
            if (signError) {
                return { success: false, error: 'Contraseña actual incorrecta' }
            }
            
            // Cambiar contraseña
            const { error } = await supabase.auth.updateUser({
                password: passwordNuevo
            })
            
            if (error) throw error
            
            return { success: true, message: '✅ Contraseña actualizada' }
            
        } catch (error) {
            console.error('❌ Error cambiando contraseña:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== DIRECCIONES ==========
    async obtenerDirecciones() {
        if (!usuarioActual) return []
        
        // Verificar que no esté baneado
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return []
        }
        
        try {
            const { data, error } = await supabase
                .from('direcciones')
                .select('*')
                .eq('usuario_id', usuarioActual.id)
                .order('es_principal', { ascending: false })
            
            if (error) throw error
            return data || []
            
        } catch (error) {
            console.error('❌ Error obteniendo direcciones:', error)
            return []
        }
    }

    async agregarDireccion(direccion) {
        if (!usuarioActual) {
            return { success: false, error: 'No hay usuario autenticado' }
        }
        
        // Verificar que no esté baneado
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
            // Si es principal, quitar principal de otras
            if (direccion.es_principal) {
                await supabase
                    .from('direcciones')
                    .update({ es_principal: false })
                    .eq('usuario_id', usuarioActual.id)
            }
            
            const { data, error } = await supabase
                .from('direcciones')
                .insert([{
                    usuario_id: usuarioActual.id,
                    ...direccion
                }])
                .select()
                .single()
            
            if (error) throw error
            
            return { success: true, data, message: '✅ Dirección agregada' }
            
        } catch (error) {
            console.error('❌ Error agregando dirección:', error)
            return { success: false, error: error.message }
        }
    }

    async eliminarDireccion(id) {
        if (!usuarioActual) return { success: false, error: 'No hay usuario autenticado' }
        
        // Verificar que no esté baneado
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
            const { error } = await supabase
                .from('direcciones')
                .delete()
                .eq('id', id)
                .eq('usuario_id', usuarioActual.id)
            
            if (error) throw error
            
            return { success: true, message: '✅ Dirección eliminada' }
            
        } catch (error) {
            console.error('❌ Error eliminando dirección:', error)
            return { success: false, error: error.message }
        }
    }

    // ========== PEDIDOS DEL USUARIO ==========
    async obtenerPedidos() {
        if (!usuarioActual) return []
        
        // Verificar que no esté baneado
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return []
        }
        
        try {
            const { data, error } = await supabase
                .from('pedidos')
                .select('*')
                .filter('cliente->>email', 'eq', usuarioActual.email)
                .order('created_at', { ascending: false })
            
            if (error) throw error
            return data || []
            
        } catch (error) {
            console.error('❌ Error obteniendo pedidos:', error)
            return []
        }
    }

    // ========== GETTERS ==========
    getUsuario() {
        return usuarioActual
    }

    isAuthenticated() {
        return usuarioActual !== null
    }

    // ========== VERIFICAR SI ESTÁ BANEADO (MÉTODO PÚBLICO) ==========
    async isBaneado() {
        if (!usuarioActual) return false
        return await this.verificarBaneo(usuarioActual.id)
    }

    // ========== LISTENERS ==========
    onCambio(callback) {
        listeners.push(callback)
        return () => {
            listeners = listeners.filter(l => l !== callback)
        }
    }

    notificarCambio() {
        listeners.forEach(cb => cb(usuarioActual))
        window.dispatchEvent(new CustomEvent('auth-change', {
            detail: { user: usuarioActual }
        }))
    }
}

// ========== INSTANCIA GLOBAL ==========
export const auth = new AuthManager()
window.auth = auth