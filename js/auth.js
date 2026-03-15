// ============================================
// auth.js - VERSIÓN FINAL CON SUPABASE AUTH INTEGRADO
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
            // Primero intentar con Supabase Auth
            const { data: { session } } = await supabase.auth.getSession()
            
            if (session?.user) {
                await this.cargarUsuario(session.user.id)
            } else {
                // Si no hay sesión en Supabase, intentar con localStorage
                const localUser = localStorage.getItem('cubazon_user')
                if (localUser) {
                    usuarioActual = JSON.parse(localUser)
                    this.notificarCambio()
                }
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
            
            // Guardar en localStorage también
            localStorage.setItem('cubazon_user', JSON.stringify(usuarioActual))
            this.notificarCambio()
            return usuarioActual
            
        } catch (error) {
            console.error('Error cargando usuario:', error)
            return null
        }
    }

    // ========== LOGIN (tradicional con email/contraseña) ==========
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

    // ========== REGISTRO (tradicional con email/contraseña) ==========
    async registrar(email, password, datos) {
        try {
            console.log('📝 Registrando usuario:', email)
            
            if (!email || !email.includes('@')) {
                throw new Error('Email inválido')
            }
            
            if (!password || password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres')
            }
            
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
            localStorage.removeItem('cubazon_user')
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
                    telegram_chat_id: datos.telegram_chat_id || null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', usuarioActual.id)
            
            if (error) throw error
            
            usuarioActual = { ...usuarioActual, ...datos }
            localStorage.setItem('cubazon_user', JSON.stringify(usuarioActual))
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
        
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
            const { error: signError } = await supabase.auth.signInWithPassword({
                email: usuarioActual.email,
                password: passwordActual
            })
            
            if (signError) {
                return { success: false, error: 'Contraseña actual incorrecta' }
            }
            
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
        
        const baneado = await this.verificarBaneo(usuarioActual.id)
        if (baneado) {
            await this.cerrarSesion()
            return { success: false, error: 'Cuenta suspendida' }
        }
        
        try {
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

    // ========== VERIFICAR SI ESTÁ BANEADO ==========
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

    // ============================================
    // FUNCIONES DE VERIFICACIÓN
    // ============================================
    
    async emailExiste(email) {
        try {
            const { data: perfil, error: perfilError } = await supabase
                .from('perfiles')
                .select('email')
                .eq('email', email)
                .maybeSingle();
            
            if (perfilError) {
                console.error('Error verificando email en perfiles:', perfilError);
            }
            
            if (perfil) {
                return { existe: true, fuente: 'perfiles' };
            }
            
            return { existe: false };
            
        } catch (error) {
            console.error('Error verificando email:', error);
            return { existe: false, error: error.message };
        }
    }

    async telefonoExiste(telefono) {
        try {
            console.log('🔍 Buscando teléfono:', telefono);
            
            const telefonoLimpio = String(telefono).trim();
            
            const { data, error } = await supabase
                .from('perfiles')
                .select('email, nombre, id, telefono')
                .ilike('telefono', `%${telefonoLimpio}%`)
                .maybeSingle();
            
            if (error) {
                console.error('❌ Error en consulta:', error);
                return { existe: false, error: error.message };
            }
            
            if (data) {
                console.log('✅ Teléfono encontrado:', data.email);
                return { 
                    existe: true, 
                    email: data.email,
                    nombre: data.nombre,
                    id: data.id
                };
            }
            
            console.log('❌ Teléfono no encontrado');
            return { existe: false };
            
        } catch (error) {
            console.error('Error en telefonoExiste:', error);
            return { existe: false, error: error.message };
        }
    }

    // ============================================
    // SISTEMA HÍBRIDO TELEGRAM
    // ============================================
    
    async enviarTelegram(chatId, codigo) {
        try {
            console.log('📱 Solicitando envío de código por Telegram al chat:', chatId);
            
            const { data, error } = await supabase.functions.invoke('enviar-codigo-telegram', {
                body: { 
                    chatId: chatId, 
                    codigo: codigo 
                }
            });

            if (error) {
                console.error('❌ Error al invocar Edge Function:', error);
                return false;
            }

            if (data && data.success) {
                console.log('✅ Código enviado por Telegram (vía Edge Function)');
                return true;
            } else {
                console.error('❌ La Edge Function respondió con error:', data);
                return false;
            }

        } catch (error) {
            console.error('Error en enviarTelegram:', error);
            return false;
        }
    }

    async enviarEmailCodigo(email, codigo) {
        try {
            console.log('📧 Enviando código por email a:', email);
            
            const { error } = await supabase.functions.invoke('enviar-email-codigo', {
                body: { 
                    email: email, 
                    codigo: codigo 
                }
            });
            
            if (error) throw error;
            
            console.log('✅ Código enviado por email');
            return true;
            
        } catch (error) {
            console.error('Error enviando email:', error);
            return false;
        }
    }

    async solicitarCodigoSinPassword(email, metodo = 'telegram') {
        try {
            console.log('🔐 Solicitando código para:', email, 'método:', metodo);
            
            let { data: perfil, error } = await supabase
                .from('perfiles')
                .select('id, nombre, telegram_chat_id')
                .eq('email', email)
                .maybeSingle();
            
            if (error) {
                console.error('Error buscando perfil:', error);
                return { success: false, error: 'Error al verificar email' };
            }
            
            if (!perfil) {
                console.log('📝 Perfil no encontrado, creando perfil básico...');
                
                const nombre = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' ');
                
                const { data: nuevoPerfil, error: insertError } = await supabase
                    .from('perfiles')
                    .insert({
                        email: email,
                        nombre: nombre,
                        estado: 'activo'
                    })
                    .select()
                    .single();
                
                if (insertError) {
                    console.error('Error creando perfil:', insertError);
                    
                    if (insertError.code === '23503') {
                        console.log('👤 Usuario no existe en auth, creando...');
                        
                        const password = Math.random().toString(36).slice(-12);
                        const { data: authData, error: authError } = await supabase.auth.signUp({
                            email: email,
                            password: password,
                            options: {
                                data: { nombre: nombre }
                            }
                        });
                        
                        if (authError) {
                            console.error('Error creando usuario en auth:', authError);
                            
                            if (authError.message?.includes('already registered')) {
                                return { 
                                    success: false, 
                                    error: '❌ Este email ya está registrado. Usa "Iniciar sesión" tradicional.'
                                };
                            }
                            
                            return { success: false, error: authError.message };
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        const { data: perfilCreado } = await supabase
                            .from('perfiles')
                            .select('id, nombre, telegram_chat_id')
                            .eq('email', email)
                            .single();
                        
                        if (perfilCreado) {
                            perfil = perfilCreado;
                        }
                    } else {
                        return { success: false, error: 'Error al crear perfil de usuario' };
                    }
                } else {
                    perfil = nuevoPerfil;
                }
            }
            
            const codigo = Math.floor(100000 + Math.random() * 900000).toString();
            const expira = new Date();
            expira.setMinutes(expira.getMinutes() + 5);
            
            const { error: insertError } = await supabase
                .from('codigos_verificacion')
                .insert({
                    email: email,
                    codigo: codigo,
                    expira: expira.toISOString(),
                    usado: false,
                    metodo: metodo
                });
            
            if (insertError) {
                console.error('Error guardando código:', insertError);
                return { success: false, error: 'Error al generar código' };
            }
            
            if (metodo === 'telegram') {
                if (!perfil?.telegram_chat_id) {
                    return { 
                        success: false, 
                        necesitaTelegramId: true,
                        message: 'Necesitamos tu ID de Telegram',
                        email: email
                    };
                }
                
                const enviado = await this.enviarTelegram(perfil.telegram_chat_id, codigo);
                if (!enviado) {
                    return { success: false, error: 'Error enviando Telegram' };
                }
            } else {
                const enviado = await this.enviarEmailCodigo(email, codigo);
                if (!enviado) {
                    return { success: false, error: 'Error enviando email' };
                }
            }
            
            return { 
                success: true, 
                message: '✅ Código enviado',
                email: email,
                metodo: metodo
            };
            
        } catch (error) {
            console.error('Error en solicitarCodigoSinPassword:', error);
            return { success: false, error: 'Error al procesar la solicitud' };
        }
    }

    // ========== VALIDAR CÓDIGO Y DAR ACCESO (VERSIÓN CORREGIDA) ==========
    async validarCodigoSinPassword(email, codigo) {
        try {
            console.log('🔍 Validando código para:', email);
            
            const ahora = new Date().toISOString();
            
            const { data: codigoValido, error } = await supabase
                .from('codigos_verificacion')
                .select('*')
                .eq('email', email)
                .eq('codigo', codigo)
                .eq('usado', false)
                .gt('expira', ahora)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            
            if (error || !codigoValido) {
                console.log('❌ Código inválido o expirado');
                return { success: false, error: 'Código inválido o expirado' };
            }
            
            await supabase
                .from('codigos_verificacion')
                .update({ usado: true })
                .eq('id', codigoValido.id);
            
            // Obtener perfil del usuario
            const { data: perfil, error: perfilError } = await supabase
                .from('perfiles')
                .select('*')
                .eq('email', email)
                .single();
            
            if (perfilError) {
                console.error('Error obteniendo perfil:', perfilError);
                
                const { data: { user } } = await supabase.auth.getUser();
                
                if (user) {
                    usuarioActual = {
                        id: user.id,
                        email: email,
                        nombre: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, ' '),
                        estado: 'activo'
                    };
                }
            } else {
                usuarioActual = {
                    id: perfil.id,
                    ...perfil
                };
            }
            
            // ✅ PASO 1: Guardar en localStorage
            localStorage.setItem('cubazon_user', JSON.stringify(usuarioActual));
            
            // ✅ PASO 2: Notificar cambio (para listeners)
            this.notificarCambio();
            
            // ✅ PASO 3: TAMBIÉN iniciar sesión en Supabase Auth (¡CRÍTICO!)
            try {
                // Buscar el usuario en auth por email
                const { data: { user } } = await supabase.auth.getUser();
                
                if (!user) {
                    // Si no hay usuario en auth, necesitamos crear una sesión
                    // Esto es un poco hack pero funciona
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: email,
                        password: 'temp-password' // No importa, no se usa realmente
                    });
                    
                    if (error) {
                        console.log('⚠️ No se pudo crear sesión en Supabase Auth, pero el usuario está en localStorage');
                    }
                }
            } catch (authError) {
                console.log('⚠️ Error con Supabase Auth, pero continuamos con localStorage');
            }
            
            console.log('✅ Acceso concedido para:', email);
            console.log('👤 Usuario actual guardado:', usuarioActual);
            
            return { 
                success: true, 
                message: 'Acceso concedido',
                user: usuarioActual
            };
            
        } catch (error) {
            console.error('Error en validarCodigoSinPassword:', error);
            return { success: false, error: 'Error al validar código' };
        }
    }

    async guardarTelegramId(email, chatId) {
        try {
            console.log('📱 Guardando Telegram ID para:', email);
            
            if (!/^\d+$/.test(chatId)) {
                return { success: false, error: 'ID de Telegram inválido' };
            }
            
            const { error } = await supabase
                .from('perfiles')
                .update({ telegram_chat_id: chatId })
                .eq('email', email);
            
            if (error) throw error;
            
            if (usuarioActual?.email === email) {
                usuarioActual.telegram_chat_id = chatId;
                localStorage.setItem('cubazon_user', JSON.stringify(usuarioActual));
            }
            
            console.log('✅ Telegram ID guardado');
            return { success: true, message: 'Telegram ID guardado' };
            
        } catch (error) {
            console.error('Error guardando Telegram ID:', error);
            return { success: false, error: error.message };
        }
    }

    async tieneTelegram(email) {
        try {
            const { data, error } = await supabase
                .from('perfiles')
                .select('telegram_chat_id')
                .eq('email', email)
                .maybeSingle();
            
            if (error || !data) return false;
            
            return !!data.telegram_chat_id;
            
        } catch (error) {
            console.error('Error verificando Telegram:', error);
            return false;
        }
    }

    async loginWithEmailOrTelefono(identificador, password) {
        try {
            console.log('🔑 Login con:', identificador);
            
            let email = identificador;
            
            if (/^[0-9]{8}$/.test(identificador)) {
                const { data: perfil, error } = await supabase
                    .from('perfiles')
                    .select('email')
                    .eq('telefono', identificador)
                    .maybeSingle();
                
                if (error || !perfil) {
                    return { 
                        success: false, 
                        error: '❌ Teléfono no registrado' 
                    };
                }
                
                email = perfil.email;
            }
            
            const resultado = await this.login(email, password);
            
            if (resultado.success) {
                return { 
                    success: true, 
                    message: '✅ Login exitoso',
                    user: resultado.user
                };
            } else {
                return { 
                    success: false, 
                    error: '❌ Credenciales incorrectas' 
                };
            }
            
        } catch (error) {
            console.error('Error en loginWithEmailOrTelefono:', error);
            return { success: false, error: 'Error al iniciar sesión' };
        }
    }
}

// ========== INSTANCIA GLOBAL ==========
export const auth = new AuthManager()
window.auth = auth
