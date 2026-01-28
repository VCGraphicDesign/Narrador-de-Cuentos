
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

    // Llamamos a la función de síntesis del espacio
    // Usamos api_name: "/predict" si está disponible o el fn_index: 1
    const result: any = await client.predict(1, [
      text,            // target_text
      voiceBlob,       // ref_audio
      "",              // ref_text
      false,           // use_xvector_only
      "Spanish",       // language
      "1.7B-Base",     // model_size
    ]);

    // Si el resultado es un objeto de estado (cola de espera), 
    // significa que el cliente no esperó automáticamente. 
    // Intentamos extraer la data si el result es exitoso o reintentamos.
    let finalResult = result;

    // Si lo que recibimos es una notificación de estado, 
    // es que necesitamos usar el método 'submit' para esperar a la cola.
    if (result && result.type === 'status') {
      console.log("Detectada cola de espera en HF, sincronizando...");
      // Reintentamos una vez con un patron de espera
      await new Promise(r => setTimeout(r, 2000));
      const retry: any = await client.predict(1, [text, voiceBlob, "", false, "Spanish", "1.7B-Base"]);
      finalResult = retry;
    }

    // Validamos la respuesta del servidor
    if (!finalResult || !finalResult.data || !finalResult.data[0]) {
      console.error("Respuesta final fallida de HF:", finalResult);
      throw new Error("El bosque de Hugging Face está saturado (Error de Cola). Intenta con un cuento más corto.");
    }

    const audioDataUrl = finalResult.data[0].url;
    if (!audioDataUrl) {
      throw new Error("El servidor no devolvió una URL de audio válida.");
    }

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
