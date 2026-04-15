// ═══════════════════════════════════════════════════════
// LA CUENTA APP — Integración con Claude API
// Las llamadas van al Cloudflare Worker proxy, que añade
// la API key de forma segura. Nunca se expone en el cliente.
// ═══════════════════════════════════════════════════════

const API = {

  /**
   * Analiza una imagen del tablero de La Cuenta y devuelve el importe total.
   * @param {string} base64Image  Imagen en base64 (sin prefijo data:...)
   * @param {string} mediaType    Ej: 'image/jpeg'
   * @returns {Promise<{ importe: number, descripcion: string }>}
   */
  async analizarTablero(base64Image, mediaType = 'image/jpeg') {
    const prompt = `Eres el asistente de la app de soporte del juego de cartas español "La Cuenta" (2 Tomatoes Games).

En esta imagen aparece el tablero del juego con cartas de tapas jugadas en la mesa durante una ronda.

Tu tarea es calcular el IMPORTE TOTAL FINAL de la cuenta, teniendo en cuenta las siguientes reglas del juego:

TIPOS DE CARTAS EN EL TABLERO:
- Tapas (carne/naranja, pescado/azul, vegetal/verde): suman su valor a la cuenta
- Vino (turquesa): suman su valor a la cuenta
- Café: suma su valor a la cuenta
- Plato Quemado (negro con signo negativo): RESTA el valor indicado y CIERRA esa pila
- Tapa Premium (negro con "x2"): DOBLA el valor de la tapa a la que se aplicó

INSTRUCCIONES:
1. Identifica todas las cartas visibles en el tablero
2. Aplica los modificadores (Plato Quemado resta, Premium dobla)
3. Suma el TOTAL FINAL de todas las cartas (ya ajustado)
4. Si no puedes leer con claridad algún valor, estima razonablemente

RESPONDE ÚNICAMENTE con este formato JSON (sin texto adicional, sin markdown):
{
  "importe": <número entero en euros>,
  "detalle": "<breve descripción de las cartas identificadas>"
}`;

    try {
      const response = await fetch(CONFIG.WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: CONFIG.CLAUDE_MODEL,
          max_tokens: 256,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Image,
                  },
                },
                {
                  type: 'text',
                  text: prompt,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `Error HTTP ${response.status}`);
      }

      const data = await response.json();
      const texto = data.content?.[0]?.text || '';

      // Parsear JSON de la respuesta
      const clean = texto.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      return {
        importe: Math.round(Number(parsed.importe) || 0),
        descripcion: parsed.detalle || '',
      };

    } catch (err) {
      console.error('Error al analizar tablero:', err);
      throw err;
    }
  },
};
