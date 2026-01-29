
import { generateMiniMaxTTS } from './minimaxService';
import { generateFishAudioTTS } from './fishAudioService';

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
  return "DUAL_ENGINE_LOCAL";
}

/**
 * Genera audio utilizando MiniMax (Prioridad 1) y Fish Audio (Prioridad 2).
 * Sistema de doble motor para máxima fiabilidad gratuita.
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

  // --- INTENTO 1: MiniMax (Prioritario, Rápido) ---
  try {
    console.log("Iniciando generación con MiniMax...");
    if (onStatus) onStatus({ stage: "Usando Narrador Veloz (MiniMax)...", position: 1 });

    // Llamamos al servicio de MiniMax
    const miniMaxResult = await generateMiniMaxTTS(text, audioSampleBase64, audioMimeType, onStatus);
    return miniMaxResult;

  } catch (miniMaxError: any) {
    console.warn("Fallo MiniMax, activando motor de respaldo (Fish Audio):", miniMaxError);
    if (onStatus) onStatus({ stage: "Activando motor de respaldo (Fish Audio)...", position: 2 });

    // --- INTENTO 2: Fish Audio (Respaldo) ---
    try {
      const fishResult = await generateFishAudioTTS(text, audioSampleBase64, onStatus);
      return fishResult;
    } catch (fishError: any) {
      console.error("Fallo crítico en ambos motores:", fishError);
      throw new Error("Lo sentimos, ambos narradores mágicos están durmiendo. Intenta más tarde.");
    }
  }
}
