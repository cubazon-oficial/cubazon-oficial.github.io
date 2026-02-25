// /functions/api/contacto.js
export async function onRequest(context) {
  const { request, env } = context;
  
  // 1. Solo aceptar peticiones POST
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: {
        "Content-Type": "application/json",
        "Allow": "POST",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
  
  try {
    // 2. Obtener los datos enviados desde el formulario
    const { name, email, phone, subject, message } = await request.json();
    
    // 3. Validar datos básicos
    if (!name || !email || !subject || !message) {
      return new Response(JSON.stringify({ error: "Faltan campos requeridos" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    // 4. Obtener las claves de EmailJS desde las variables de entorno (SEGURAS)
    const emailjsPublicKey = env.EMAILJS_PUBLIC_KEY;
    const emailjsServiceId = env.EMAILJS_SERVICE_ID;
    const emailjsTemplateId = env.EMAILJS_TEMPLATE_ID;
    
    if (!emailjsPublicKey || !emailjsServiceId || !emailjsTemplateId) {
      console.error("Faltan variables de entorno de EmailJS");
      return new Response(JSON.stringify({ error: "Error de configuración del servidor" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    // 5. Preparar los datos para EmailJS (con los nombres que espera su plantilla)
    const templateParams = {
      name: name,
      email: email,
      phone: phone || 'No proporcionado',
      title: subject,
      message: message
    };
    
    // 6. Enviar el email usando EmailJS
    const emailjsResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        service_id: emailjsServiceId,
        template_id: emailjsTemplateId,
        user_id: emailjsPublicKey,
        template_params: templateParams
      })
    });
    
    if (!emailjsResponse.ok) {
      const errorText = await emailjsResponse.text();
      console.error("Error al enviar con EmailJS:", errorText);
      return new Response(JSON.stringify({ error: "Error al enviar el mensaje" }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
    
    // 7. Responder éxito
    return new Response(JSON.stringify({
      success: true,
      message: "Mensaje enviado correctamente"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
    
  } catch (error) {
    console.error("Error en la función contacto:", error);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}