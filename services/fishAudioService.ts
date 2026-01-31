
import { encode } from "@msgpack/msgpack";

/**
 * Configuración del servicio Fish Audio
 */
const FISH_AUDIO_CONFIG = {
    API_URL_TTS: "https://api.fish.audio/v1/tts",
    // La API Key se inyectará. Para desarrollo local la ponemos aquí (temporalmente).
    API_KEY: (import.meta as any).env?.VITE_FISH_AUDIO_API_KEY || (window as any).process?.env?.VITE_FISH_AUDIO_API_KEY || "b6f11525a2d146b5b7babac88e7a1901",
};

/**
 * Genera audio clonado usando Fish Audio.
 * Este método es "instantáneo": le envías el audio de referencia y el texto en la misma petición.
 */
export async function generateFishAudioTTS(
    text: string,
    audioSampleBase64: string,
    onStatus?: (status: { stage: string, position: number }) => void,
    referenceId?: string
): Promise<{ data: string, mimeType: string }> {

    if (!audioSampleBase64 && !referenceId) {
        throw new Error("Muestra de voz o Reference ID necesario para Fish Audio.");
    }

    // Notificar estado
    if (onStatus) onStatus({ stage: "Usando Pez Mágico (Fish Audio)...", position: 1 });

    try {
        // Call our serverless function instead of direct API
        const response = await fetch('/api/fishaudio', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audioBase64: audioSampleBase64,
                text: text,
                referenceId: referenceId
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Fish Audio API Error:", errorData);
            throw new Error(`Error en Fish Audio: ${errorData.error}`);
        }

        const data = await response.json();
        return { data: data.data, mimeType: data.mimeType };

    } catch (error: any) {
        console.error("Error crítico en Fish Audio Service:", error);
        throw new Error(error.message || "El Pez Mágico no respondió.");
    }
}

// Utilidad: ArrayBuffer a Base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}
