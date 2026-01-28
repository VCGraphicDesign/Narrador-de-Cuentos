
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
  audioMimeType?: string
): Promise<{ data: string, mimeType: string }> {

  if (!audioSampleBase64) {
    throw new Error("No hay muestra de voz para realizar la clonación.");
  }

  try {
    // Conectamos con el servidor de Hugging Face
    const client = await Client.connect(VOICE_SERVICE_CONFIG.SPACE_NAME);

    // Convertimos la muestra Base64 a un Blob para que Gradio lo entienda
    const res = await fetch(`data:${audioMimeType || 'audio/wav'};base64,${audioSampleBase64}`);
    const voiceBlob = await res.blob();

    // Llamamos a la función de síntesis (predict) del espacio
    // Nota: El orden de los parámetros depende del Space de Gradio.
    // Para Qwen3-TTS suele ser: text, reference_audio, speed, etc.
    // Llamamos a la función de síntesis del espacio
    // Usamos parámetros posicionales según la estructura estándar de Qwen3-TTS en Gradio
    const result: any = await client.predict(0, [
      text,       // input_text
      voiceBlob,  // raw_audio (reference audio)
    ]);

    // Gradio devuelve una URL del archivo generado o un objeto con la data
    const audioDataUrl = result.data[0].url;

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

  } catch (error: any) {
    console.error("Error en Qwen3-TTS (Hugging Face):", error);
    throw new Error("El bosque mágico de Hugging Face está muy concurrido. Por favor, inténtalo de nuevo en unos momentos.");
  }
}
