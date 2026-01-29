
import { Client } from "@gradio/client";

/**
 * Configuración del servicio de voz (Hugging Face / Qwen3-TTS).
 * Usamos el espacio gratuito de Qwen en Hugging Face.
 */
const VOICE_SERVICE_CONFIG = {
  SPACE_NAME: "Qwen/Qwen3-TTS",
};

/**
 * Para el espacio de Hugging Face, no creamos un perfil persistente en su servidor,
 * sino que guardamos la muestra localmente y la enviamos en cada petición.
 * Esta función simplemente valida que la muestra sea correcta.
 */
export async function createExternalVoiceProfile(audioBase64: string, mimeType: string): Promise<string> {
  if (!audioBase64) {
    throw new Error("Muestra de voz no encontrada.");
  }

  // En esta versión, el "profileId" es solo un marcador interno.
  // La muestra real se guarda en el estado de la App y se envía a HF.
  return "HF_V3_QWEN_LOCAL";
}

/**
 * Genera audio utilizando el modelo Qwen3-TTS en Hugging Face.
 * Envía el texto y la muestra de voz (audioBase64) en cada petición.
 */
import { generateMiniMaxTTS } from './minimaxService';

export async function generateExternalTTS(
  text: string,
  voiceId: string,
  audioSampleBase64?: string,
  audioMimeType?: string,
  onStatus?: (status: { stage: string, position: number }) => void
): Promise<{ data: string, mimeType: string }> {

  if (!audioSampleBase64) {
    throw new Error("No hay muestra de voz para realizar la clonación.");
  }

  // --- INTENTO 1: MiniMax (Prioritario, Rápido) ---
  try {
    console.log("Iniciando generación con MiniMax (Prioritario)...");
    if (onStatus) onStatus({ stage: "Usando Narrador Veloz (MiniMax)...", position: 1 });

    // Llamamos al servicio de MiniMax
    const miniMaxResult = await generateMiniMaxTTS(text, audioSampleBase64, audioMimeType, onStatus);
    return miniMaxResult;

  } catch (miniMaxError: any) {
    console.warn("Fallo MiniMax, cambiando a Hugging Face (Fallback):", miniMaxError);
    if (onStatus) onStatus({ stage: "MiniMax ocupado, cambiando al Bosque Mágico...", position: 5 });

    // --- INTENTO 2: Hugging Face (Respaldo, Gratis pero Lento) ---
    return await generateHuggingFaceTTS(text, audioSampleBase64, audioMimeType, onStatus);
  }
}

/**
 * Lógica original de Hugging Face (Qwen3)
 * Se mantiene como respaldo por si se acaban los créditos de MiniMax
 */
async function generateHuggingFaceTTS(
  text: string,
  audioSampleBase64: string,
  audioMimeType?: string,
  onStatus?: (status: { stage: string, position: number }) => void
): Promise<{ data: string, mimeType: string }> {

  try {
    // Conectamos con el servidor de Hugging Face
    const client = await Client.connect(VOICE_SERVICE_CONFIG.SPACE_NAME);

    const res = await fetch(`data:${audioMimeType || 'audio/wav'};base64,${audioSampleBase64}`);
    const voiceBlob = await res.blob();

    const job = client.submit(1, [
      text,            // target_text
      voiceBlob,       // ref_audio
      "",              // ref_text
      false,           // use_xvector_only
      "Spanish",       // language
      "1.7B-Base",     // model_size
    ]);

    for await (const event of job) {
      if (event.type === "status") {
        const stage = event.stage || "unknown";
        const position = event.queue_position || 0;
        console.log(`Estado (Hugging Face): ${stage} - Posición: ${position}`);
        if (onStatus) onStatus({ stage, position });
      }

      if (event.type === "data") {
        if (event.data && event.data[0] && event.data[0].url) {
          const audioDataUrl = event.data[0].url;
          const audioResponse = await fetch(audioDataUrl);
          const audioBlobResult = await audioResponse.blob();

          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve({ data: base64String, mimeType: 'audio/wav' });
            };
            reader.onerror = () => reject(new Error("Error al procesar el audio devuelto por Hugging Face"));
            reader.readAsDataURL(audioBlobResult);
          });
        }
      }

      if (event.type === "error") {
        console.error("Error en el Job de Gradio:", event);
        throw new Error("El Bosque de Hugging Face está saturado.");
      }
    }

    throw new Error("No se recibió audio del servidor de voz.");

  } catch (error: any) {
    console.error("Error en Qwen3-TTS (Hugging Face):", error);
    throw new Error("El bosque mágico de Hugging Face está muy concurrido. Por favor, inténtalo de nuevo en unos momentos.");
  }
}
