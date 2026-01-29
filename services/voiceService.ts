
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

  try {
    // Conectamos con el servidor de Hugging Face
    const client = await Client.connect(VOICE_SERVICE_CONFIG.SPACE_NAME);

    // Convertimos la muestra Base64 a un Blob
    const res = await fetch(`data:${audioMimeType || 'audio/wav'};base64,${audioSampleBase64}`);
    const voiceBlob = await res.blob();

    // Usamos .submit() que devuelve un iterable asíncrono
    // Parámetros: [target_text, ref_audio, ref_text, use_xvector_only, language, model_size]
    const job = client.submit(1, [
      text,            // target_text
      voiceBlob,       // ref_audio
      "",              // ref_text
      false,           // use_xvector_only
      "Spanish",       // language
      "1.7B-Base",     // model_size
    ]);

    // Iteramos sobre los eventos que nos va enviando Gradio
    for await (const event of job) {
      // Evento de status (posición en cola, etc.)
      if (event.type === "status") {
        const stage = event.stage || "unknown";
        const position = event.queue_position || 0;
        console.log(`Estado (Hugging Face): ${stage} - Posición: ${position}`);

        if (onStatus) {
          onStatus({ stage, position });
        }
      }

      // Evento de data (resultado final)
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

      // Evento de error
      if (event.type === "error") {
        console.error("Error en el Job de Gradio:", event);
        throw new Error("El Bosque de Hugging Face está saturado. Intenta de nuevo en unos segundos.");
      }
    }

    // Si llegamos aquí sin haber retornado, algo salió mal
    throw new Error("No se recibió audio del servidor de voz.");

  } catch (error: any) {
    console.error("Error en Qwen3-TTS (Hugging Face):", error);
    throw new Error("El bosque mágico de Hugging Face está muy concurrido. Por favor, inténtalo de nuevo en unos momentos.");
  }
}
