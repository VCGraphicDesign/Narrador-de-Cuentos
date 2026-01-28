
import { GoogleGenAI } from "@google/genai";

/**
 * Genera el texto del cuento utilizando Gemini.
 */
export async function generateStory(prompt: string): Promise<{ title: string; content: string }> {
  // Use process.env.API_KEY directly as per the @google/genai SDK guidelines.
  // Re-initializing right before call ensure we use the latest key from the dialog.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    // Prompt mejorado para historias largas y envolventes
    contents: `Escribe un cuento infantil largo, mágico y detallado basado en esta idea: "${prompt}". 
    El cuento debe ser cautivador, apropiado para niños y tener una estructura narrativa completa (inicio, nudo y desenlace).
    Extiéndete todo lo que sea necesario para que la historia sea profunda y emocionante.
    Formatea tu respuesta exactamente así:
    Título: [Título del cuento]
    Contenido: [Cuento completo]`,
    config: {
      temperature: 0.8,
    },
  });

  // Access .text property directly as it is a getter, not a method.
  const text = response.text || '';
  const titleMatch = text.match(/Título:\s*(.*)/i);
  const contentMatch = text.match(/Contenido:\s*([\s\S]*)/i);

  return {
    title: titleMatch ? titleMatch[1].trim() : "Una Nueva Aventura",
    content: contentMatch ? contentMatch[1].trim() : text.replace(/Título:.*|Contenido:/gi, '').trim(),
  };
}
