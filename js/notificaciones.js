// ============================================
// notificaciones.js - Sistema de notificaciones en tiempo real
// ============================================

import { supabase } from './supabase-client.js';
import { auth } from './auth.js';

export class NotificacionesManager {
  constructor() {
    this.channel = null;
    this.notificaciones = [];
    this.listeners = [];
    this.inicializado = false;
    this.callbacks = {
      onNuevaNotificacion: null,
      onNotificacionesCargadas: null
    };
  }
  
  // ========== INICIALIZAR ==========
  async iniciar() {
    if (!auth.isAuthenticated()) {
      console.log('❌ Usuario no autenticado, no se inician notificaciones');
      return false;
    }
    
    if (this.inicializado) {
      console.log('⚠️ Notificaciones ya inicializadas');
      return true;
    }
    
    const usuario = auth.getUsuario();
    console.log('📢 Iniciando notificaciones para:', usuario.email);
    
    // Cargar notificaciones existentes
    await this.cargarNotificaciones();
    
    // Suscribirse a cambios en tiempo real
    this.suscribirse();
    
    this.inicializado = true;
    return true;
  }
  
  // ========== CARGAR NOTIFICACIONES EXISTENTES ==========
  async cargarNotificaciones() {
    const usuario = auth.getUsuario();
    if (!usuario) return [];
    
    const { data, error } = await supabase
      .from('notificaciones')
      .select('*')
      .eq('usuario_id', usuario.id)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (error) {
      console.error('Error cargando notificaciones:', error);
      return [];
    }
    
    this.notificaciones = data || [];
    
    if (this.callbacks.onNotificacionesCargadas) {
      this.callbacks.onNotificacionesCargadas(this.notificaciones);
    }
    
    return this.notificaciones;
  }
  
  // ========== SUSCRIBIRSE A CAMBIOS EN TIEMPO REAL ==========
  suscribirse() {
    const usuario = auth.getUsuario();
    if (!usuario) return;
    
    // Limpiar suscripción anterior si existe
    if (this.channel) {
      supabase.removeChannel(this.channel);
    }
    
    // Crear nuevo canal para notificaciones
    this.channel = supabase
      .channel('notificaciones-en-vivo')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${usuario.id}`
        },
        (payload) => this.handleNuevaNotificacion(payload.new)
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notificaciones',
          filter: `usuario_id=eq.${usuario.id}`
        },
        (payload) => this.handleNotificacionActualizada(payload.new)
      )
      .subscribe((status) => {
        console.log('📡 Canal de notificaciones:', status);
      });
    
    console.log('✅ Suscrito a notificaciones en tiempo real');
  }
  
  // ========== MANEJAR NUEVA NOTIFICACIÓN ==========
  handleNuevaNotificacion(notificacion) {
    console.log('🆕 Nueva notificación:', notificacion);
    
    // Añadir al inicio del array
    this.notificaciones.unshift(notificacion);
    
    // Reproducir sonido si está disponible
    this.reproducirSonido();
    
    // Mostrar notificación en pantalla si el usuario está en otra pestaña
    if (document.hidden) {
      this.mostrarNotificacionSistema(notificacion);
    }
    
    // Llamar al callback si existe
    if (this.callbacks.onNuevaNotificacion) {
      this.callbacks.onNuevaNotificacion(notificacion);
    }
    
    // Disparar evento personalizado
    window.dispatchEvent(new CustomEvent('nueva-notificacion', {
      detail: notificacion
    }));
  }
  
  // ========== MANEJAR NOTIFICACIÓN ACTUALIZADA (LEÍDA) ==========
  handleNotificacionActualizada(notificacion) {
    const index = this.notificaciones.findIndex(n => n.id === notificacion.id);
    if (index !== -1) {
      this.notificaciones[index] = notificacion;
    }
    
    // Disparar evento
    window.dispatchEvent(new CustomEvent('notificacion-actualizada', {
      detail: notificacion
    }));
  }
  
  // ========== MARCAR COMO LEÍDA ==========
  async marcarComoLeida(id) {
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('id', id);
    
    if (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  }
  
  async marcarTodasComoLeidas() {
    const usuario = auth.getUsuario();
    if (!usuario) return;
    
    const { error } = await supabase
      .from('notificaciones')
      .update({ leida: true })
      .eq('usuario_id', usuario.id)
      .eq('leida', false);
    
    if (error) {
      console.error('Error marcando todas como leídas:', error);
    } else {
      // Actualizar localmente
      this.notificaciones.forEach(n => n.leida = true);
      
      // Disparar evento
      window.dispatchEvent(new CustomEvent('notificaciones-actualizadas'));
    }
  }
  
  // ========== CONTAR NO LEÍDAS ==========
  contarNoLeidas() {
    return this.notificaciones.filter(n => !n.leida).length;
  }
  
  // ========== ELIMINAR NOTIFICACIÓN ==========
  async eliminar(id) {
    const { error } = await supabase
      .from('notificaciones')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error eliminando notificación:', error);
    } else {
      this.notificaciones = this.notificaciones.filter(n => n.id !== id);
      window.dispatchEvent(new CustomEvent('notificacion-eliminada', {
        detail: { id }
      }));
    }
  }
  
  // ========== UTILIDADES ==========
  reproducirSonido() {
    try {
      const audio = new Audio('https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3');
      audio.volume = 0.3;
      audio.play().catch(e => console.log('Error reproduciendo sonido:', e));
    } catch (e) {
      console.log('Error con audio:', e);
    }
  }
  
  mostrarNotificacionSistema(notificacion) {
    if (!("Notification" in window)) return;
    
    if (Notification.permission === "granted") {
      new Notification(notificacion.titulo, {
        body: notificacion.mensaje,
        icon: '/favicon.ico'
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }
  
  // ========== REGISTRAR CALLBACKS ==========
  onNuevaNotificacion(callback) {
    this.callbacks.onNuevaNotificacion = callback;
  }
  
  onNotificacionesCargadas(callback) {
    this.callbacks.onNotificacionesCargadas = callback;
  }
  
  // ========== DETENER SUSCRIPCIÓN ==========
  detener() {
    if (this.channel) {
      supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.inicializado = false;
  }
}

// ========== INSTANCIA GLOBAL ==========
export const notificaciones = new NotificacionesManager();
window.notificaciones = notificaciones;

// Inicializar cuando auth esté listo
auth.onCambio(async (usuario) => {
  if (usuario) {
    // Solicitar permiso para notificaciones del sistema
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    await notificaciones.iniciar();
  } else {
    notificaciones.detener();
  }
});