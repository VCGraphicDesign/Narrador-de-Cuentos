
import { generateMiniMaxTTS } from './minimaxService';

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
  return "MINIMAX_LOCAL";
}

/**
 * Genera audio utilizando EXCLUSIVAMENTE MiniMax.
 * El respaldo de Hugging Face ha sido eliminado para simplificar y limpiar el código.
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

  // --- SOLO MiniMax (Prioritario, Rápido) ---
  try {
    console.log("Iniciando generación con MiniMax...");
    if (onStatus) onStatus({ stage: "Usando Narrador Veloz (MiniMax)...", position: 1 });

    // Llamamos al servicio de MiniMax
    const miniMaxResult = await generateMiniMaxTTS(text, audioSampleBase64, audioMimeType, onStatus);
    return miniMaxResult;

  } catch (miniMaxError: any) {
    console.error("Fallo crítico en MiniMax:", miniMaxError);
    if (onStatus) onStatus({ stage: "Error en el narrador...", position: 0 });

    throw new Error("El narrador veloz (MiniMax) tuvo un problema. Por favor intenta de nuevo.");
  }
}
