// ============================================
// crypto.js - VERSIÓN REAL CON NOWPayments
// MÍNIMO $1 USD - CORREGIDO
// ============================================

import { supabase } from './supabase-client.js'
import { auth } from './auth.js'

class CryptoManager {
  constructor() {
    this.init()
  }
  
  init() {
    // Escuchar cambios en autenticación
    auth.onCambio(() => {
      this.actualizarInterfaz()
    })
    
    // También actualizar cuando la página cargue
    setTimeout(() => {
      this.actualizarInterfaz()
    }, 500)
  }
  
  // ========== MOSTRAR MODAL DE RECARGA ==========
  mostrarModalRecarga() {
    const usuario = auth.getUsuario()
    
    if (!usuario) {
      Swal.fire({
        icon: 'warning',
        title: 'Inicia sesión',
        text: 'Debes iniciar sesión para recargar saldo',
        showCancelButton: true,
        confirmButtonText: 'Iniciar sesión',
        cancelButtonText: 'Cancelar'
      }).then(result => {
        if (result.isConfirmed) {
          window.location.href = '/login.html'
        }
      })
      return
    }
    
    // Montos actualizados con $1
    const montos = [1, 5, 10, 20, 50]
    
    Swal.fire({
      title: '💰 Recargar con Crypto',
      html: `
        <div style="margin: 20px 0;">
          <p style="margin-bottom: 15px; color: #4b5563;">Selecciona el monto en USD:</p>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 20px;">
            ${montos.map(m => `
              <button class="monto-btn" data-monto="${m}" 
                      style="padding: 12px; background: #f3f4f6; border: 2px solid #e5e7eb; 
                             border-radius: 12px; font-weight: 600; cursor: pointer;
                             transition: all 0.2s;">
                $${m}
              </button>
            `).join('')}
          </div>
          
          <div style="display: flex; gap: 10px; margin-bottom: 20px;">
            <input type="number" id="montoPersonalizado" 
                   placeholder="Otro monto (mín. $1)"
                   min="1" step="1" value="10"
                   style="flex: 1; padding: 12px; border: 2px solid #e5e7eb; 
                          border-radius: 12px; font-size: 16px;">
            <button id="btnRecargarModal" 
                    style="padding: 12px 25px; background: #f97316; color: white; 
                           border: none; border-radius: 12px; font-weight: 600; 
                           cursor: pointer; font-size: 16px;">
              Recargar
            </button>
          </div>
          
          <div style="background: #f0fdf4; padding: 15px; border-radius: 12px; 
                      text-align: left; border: 1px solid #bbf7d0;">
            <p style="color: #166534; margin-bottom: 8px;">
              <i class="fa fa-check-circle"></i> 
              <strong>Aceptamos:</strong>
            </p>
            <p style="font-family: monospace; font-size: 16px; color: #166534;">
              USDT (BEP20) · BNB Smart Chain
            </p>
            <p style="color: #4b5563; font-size: 13px; margin-top: 10px;">
              ⚡ Mínimo: $1 USD · La recarga es automática · Comisiones bajas
            </p>
          </div>
        </div>
      `,
      showConfirmButton: false,
      showCloseButton: true,
      didOpen: () => {
        // Seleccionar monto predefinido
        document.querySelectorAll('.monto-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            document.querySelectorAll('.monto-btn').forEach(b =>
              b.style.background = '#f3f4f6'
            )
            btn.style.background = '#f97316'
            btn.style.color = 'white'
            document.getElementById('montoPersonalizado').value = btn.dataset.monto
          })
        })
        
        // Botón recargar en modal
        document.getElementById('btnRecargarModal').addEventListener('click', () => {
          const monto = document.getElementById('montoPersonalizado').value
          if (!monto || monto < 1) {
            Swal.fire({
              icon: 'warning',
              title: 'Monto inválido',
              text: 'El monto mínimo es $1 USD'
            })
            return
          }
          
          Swal.close()
          this.procesarRecarga(parseFloat(monto))
        })
      }
    })
  }
  
  // ========== PROCESAR RECARGA ==========
  async procesarRecarga(monto) {
    const usuario = auth.getUsuario()
    
    if (!usuario) {
      window.location.href = '/login.html'
      return
    }
    
    Swal.fire({
      title: 'Procesando...',
      text: 'Conectando con procesador de pagos',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading()
      }
    })
    
    try {
      console.log('💰 Procesando recarga:', { usuarioId: usuario.id, monto })
      
      // LLAMADA A LA EDGE FUNCTION
      const { data, error } = await supabase.functions.invoke('crear-recarga-crypto', {
        body: {
          usuarioId: usuario.id,
          monto: monto,
          moneda: 'USDTBSC'
        }
      })
      
      if (error) {
        console.error('Error de función:', error)
        throw new Error(error.message || 'Error al conectar con el procesador')
      }
      
      if (!data || !data.direccionPago) {
        throw new Error('Respuesta inválida del procesador')
      }
      
      Swal.fire({
        icon: 'success',
        title: '¡Recarga iniciada!',
        html: `
          <div style="text-align: left;">
            <p><strong>Monto:</strong> $${monto} USD</p>
            <p><strong>Moneda:</strong> USDT (BEP20)</p>
            <p><strong>Dirección de pago:</strong></p>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; 
                      font-family: monospace; word-break: break-all; margin: 10px 0;
                      font-size: 14px; border: 1px solid #d1d5db;">
              ${data.direccionPago}
            </div>
            <p><strong>Cantidad exacta:</strong> ${parseFloat(data.montoCrypto).toFixed(2)} USDT</p>
            <p style="color: #dc2626; font-size: 14px; margin-top: 15px;">
              ⚠️ Envía EXACTAMENTE esa cantidad a esa dirección
            </p>
            <p style="color: #059669; font-size: 14px;">
              ⏳ Expira: ${new Date(data.expira).toLocaleString()}
            </p>
            <p style="font-size: 13px; color: #6b7280; margin-top: 10px;">
              La recarga se acreditará automáticamente cuando la red confirme la transacción.
            </p>
          </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#f97316'
      })
      
      // Guardar ID de transacción
      localStorage.setItem('ultima_recarga', JSON.stringify({
        id: data.transaccionId,
        monto: monto,
        expira: data.expira
      }))
      
    } catch (error) {
      console.error('Error en recarga:', error)
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.message || 'No se pudo procesar la recarga. Intenta de nuevo.'
      })
    }
  }
  
  // ========== VERIFICAR ESTADO ==========
  async verificarEstado(transaccionId) {
    try {
      const { data, error } = await supabase
        .from('transacciones_crypto')
        .select('estado, monto_usd')
        .eq('id', transaccionId)
        .single()
      
      if (error) throw error
      
      if (data.estado === 'confirmada') {
        window.dispatchEvent(new CustomEvent('saldo-actualizado'))
        Swal.fire({
          icon: 'success',
          title: '¡Recarga exitosa!',
          text: `Se acreditaron $${data.monto_usd} USD a tu saldo`
        })
      } else if (data.estado === 'pendiente') {
        Swal.fire({
          icon: 'info',
          title: 'Pago pendiente',
          text: 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.',
          timer: 3000
        })
      } else {
        Swal.fire({
          icon: 'warning',
          title: 'Estado: ' + data.estado,
          text: 'Contacta a soporte si el problema persiste'
        })
      }
    } catch (error) {
      console.error('Error verificando:', error)
    }
  }
  
  // ========== ACTUALIZAR INTERFAZ ==========
  actualizarInterfaz() {
    const usuario = auth.getUsuario()
    const botonesRecarga = document.querySelectorAll('.btn-recarga-mini, .btn-crypto')
    
    botonesRecarga.forEach(btn => {
      if (usuario) {
        btn.disabled = false
        btn.style.opacity = '1'
        btn.style.pointerEvents = 'auto'
        btn.title = 'Recargar saldo con crypto'
      } else {
        btn.disabled = true
        btn.style.opacity = '0.5'
        btn.style.pointerEvents = 'none'
        btn.title = 'Inicia sesión para recargar'
      }
    })
  }
}

// Crear y exportar instancia única
export const cryptoManager = new CryptoManager()
window.cryptoManager = cryptoManager

console.log('✅ CryptoManager cargado - Mínimo: $1 USD')