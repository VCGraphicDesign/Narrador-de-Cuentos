
import { GoogleGenAI } from "@google/genai";

/**
 * Genera el texto del cuento utilizando Gemini.
 */
export async function generateStory(prompt: string): Promise<{ title: string; content: string }> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
    throw new Error("No se ha configurado la Llave de Gemini (GEMINI_API_KEY). Por favor, agrégala en la configuración de Vercel.");
  }

  const ai = new GoogleGenAI({ apiKey });

  let attempts = 0;
  const maxAttempts = 3;
  let response: any = null;

  while (attempts < maxAttempts) {
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Escribe un cuento infantil largo, mágico y detallado basado en esta idea: "${prompt}". 
        El cuento debe ser cautivador, apropiado para niños y tener una estructura narrativa completa (inicio, nudo y desenlace).
        Extiéndete todo lo que sea necesario para que la historia sea profunda y emocionante.
        Formatea tu respuesta exactamente así:
        Título: [Título del cuento]
        Contenido: [Cuento completo]`,
        config: { temperature: 0.8 },
      });
      break; // Éxito, salimos del bucle
    } catch (error: any) {
      attempts++;
      const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded');

      if (isOverloaded && attempts < maxAttempts) {
        console.log(`Gemini saturado (intento ${attempts}). Reintentando en ${attempts * 2}s...`);
        await new Promise(r => setTimeout(r, attempts * 2000));
        continue;
      }
      throw error; // Si no es sobrecarga o agotamos intentos, lanzamos error
    }
  }

  // Access .text property directly as it is a getter, not a method.
  const text = response.text || '';
  const titleMatch = text.match(/Título:\s*(.*)/i);
  const contentMatch = text.match(/Contenido:\s*([\s\S]*)/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : "Una Nueva Aventura",
    content: contentMatch ? contentMatch[1].trim() : text.replace(/Título:.*|Contenido:/gi, '').trim(),
  };
}
