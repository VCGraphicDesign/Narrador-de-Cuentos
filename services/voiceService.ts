import { generateMiniMaxTTS } from './minimaxService';

/**
 * Valida que la muestra de voz sea correcta.
 */
export async function createExternalVoiceProfile(audioBase64: string, mimeType: string): Promise<string> {
  if (!audioBase64) {
    const storedMiniMaxVoiceId = (import.meta as any).env?.VITE_MINIMAX_VOICE_ID;
    if (storedMiniMaxVoiceId) return "MINIMAX_STORED";
    throw new Error("Muestra de voz no encontrada.");
  }
  return "MINIMAX_LOCAL";
}

/**
 * Genera audio utilizando MiniMax como motor principal único.
 */
export async function generateExternalTTS(
  text: string,
  voiceId: string,
  audioSampleBase64?: string,
  audioMimeType?: string,
  onStatus?: (status: { stage: string, position: number }) => void
): Promise<{ data: string, mimeType: string }> {

  const storedMiniMaxVoiceId = (import.meta as any).env?.VITE_MINIMAX_VOICE_ID;

  if (!audioSampleBase64 && !storedMiniMaxVoiceId) {
    throw new Error("No hay muestra de voz ni ID de MiniMax guardado.");
  }

  try {
    console.log("Generando audio con MiniMax...");
    if (onStatus) onStatus({ stage: "Generando voz con MiniMax...", position: 1 });

    const result = await generateMiniMaxTTS(
      text,
      audioSampleBase64 || "",
      audioMimeType,
      onStatus,
      storedMiniMaxVoiceId
    );
    return result;

  } catch (error: any) {
    console.error("Fallo crítico en MiniMax:", error);
    throw new Error(error.message || "Error al conectar con el narrador de MiniMax.");
  }
}
