// api/chat.js
// Función serverless (Vercel) que recibe la consulta del chat de la web
// y la reenvía a la API de Anthropic (Claude), usando tu clave privada.
//
// La clave NUNCA se expone al navegador: vive solo en el servidor,
// como variable de entorno ANTHROPIC_API_KEY.

const SYSTEM_PROMPT = `Sos el asistente virtual del sitio web de Misiti & Asociados,
un estudio jurídico de Buenos Aires (CABA y GBA) especializado en accidentes de trabajo,
accidentes in itinere y enfermedades profesionales, encabezado por el Dr. Damián M. Misiti.
El estudio también atiende despidos, accidentes de tránsito, sucesiones y derecho de familia
a través de su equipo de abogados asociados.

Tu trabajo es:
- Responder dudas GENERALES sobre estos temas (qué es un accidente in itinere, qué es una
  enfermedad profesional, cómo es el proceso general ante la ART, qué documentación conviene
  juntar, etc.), con un tono cercano, claro y profesional.
- NUNCA dar cifras de indemnización, plazos exactos ni asesoramiento legal específico sobre
  el caso puntual de la persona: para eso siempre invitala a dejar sus datos en el formulario
  de contacto o a escribir por WhatsApp para que el estudio evalúe su caso sin cargo.
- Mantené las respuestas breves (2 a 4 oraciones), en español rioplatense, sin tecnicismos
  innecesarios.
- Si te preguntan algo que no tiene que ver con temas legales/laborales, respondé amablemente
  que estás para ayudar con consultas sobre el estudio y sus áreas de trabajo.`;

export default async function handler(req, res) {
  // CORS: permite que tu sitio (en otro dominio) llame a esta función
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Falta el mensaje' });
  }

  const safeHistory = Array.isArray(history) ? history.slice(-12) : [];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [...safeHistory, { role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Error de la API de Anthropic:', errText);
      return res.status(502).json({ error: 'Error al conectar con el asistente' });
    }

    const data = await response.json();
    const reply =
      data?.content?.find((block) => block.type === 'text')?.text ||
      'Perdón, no pude procesar tu consulta. Escribinos por WhatsApp.';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
