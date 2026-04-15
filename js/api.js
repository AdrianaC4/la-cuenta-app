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

En esta imagen aparece el tablero del juego con cartas jugadas en la mesa durante una ronda.

REGLAS DE CÁLCULO — aplícalas exactamente:

1. TAPAS (cartas de colores: naranja=carne, azul=pescado, verde=vegetal)
   - Suma el valor numérico impreso en cada carta de tapa visible.

2. VINO TINTO (cartas de color turquesa/azul claro con una copa)
   - REGLA FIJA: cada carta de vino vale SIEMPRE 30€, sin excepción.
   - Cuenta cuántas cartas de vino hay y multiplica por 30.
   - Máximo posible: 6 cartas × 30€ = 180€.

3. CAFÉ (cartas de café/marrón)
   - Detecta la carta pero no suma nada.

4. TAPA PREMIUM (carta negra con símbolo x2)
   - Dobla el valor de la tapa junto a la que se jugó.

5. PLATO QUEMADO (carta negra con valor negativo)
   - Resta su valor del total.

6. PROPINA (carta negra especial jugada al pedir la cuenta)
   - Si ves una o más cartas de Propina:
     a) Identifica el valor más bajo entre todas las tapas visibles.
     b) Multiplica ese valor × número de cartas de Propina jugadas.
     c) Añade ese resultado al total.

NO incluyas en el cálculo: Cumpleaños, A Pachas, A Medias, Baño, Cambio de Sentido.

RESPONDE ÚNICAMENTE con este JSON exacto (sin texto adicional, sin markdown):
{
  "importe": <número entero en euros>,
  "detalle": "<resumen breve, máx 80 caracteres, ej: Tapas 90€ + Vino 2x30€ + Propina 20€ = 170€>"
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
