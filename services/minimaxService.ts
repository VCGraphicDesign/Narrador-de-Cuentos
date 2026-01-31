
import { VoiceProfile } from '../types';

/**
 * Configuración del servicio MiniMax
 */
const MINIMAX_CONFIG = {
    API_URL_T2A: "https://api.minimax.chat/v1/t2a_v2", // URL correcta para Text-to-Audio v2
    API_URL_FILE_UPLOAD: "https://api.minimax.chat/v1/files/upload", // Para subir la muestra de voz
    // La API Key y el Group ID se inyectarán desde las variables de entorno o la configuración interna
    // Nota: Por seguridad, en un entorno real NO se debería poner la API Key en el código cliente.
    // Como esto es un prototipo local/Vercel, usaremos una variable o la inyectaremos.
    API_KEY: (import.meta as any).env?.VITE_MINIMAX_API_KEY || (window as any).process?.env?.VITE_MINIMAX_API_KEY || "sk-api-rRtqtw786Yo-13yvI62LlfySbFcPBH7i0ckzo2kIREBxOW2f2r8lqKF9JCNuiSLWtHt6t9LxP6Omi8lP1yKYjjSCCM4MrdsdbxsCGLbma7VMSRBmzhJsbnE",
    GROUP_ID: (import.meta as any).env?.VITE_MINIMAX_GROUP_ID || (window as any).process?.env?.VITE_MINIMAX_GROUP_ID || "473267587529936904",
    MODEL_ID: "speech-01-turbo-240228", // Modelo rápido recomendado
};

/**
 * Sube el archivo de audio (muestra de voz) a MiniMax para obtener un File ID.
 * MiniMax requiere que subas el archivo primero.
 */
async function uploadVoiceSampleToMiniMax(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    // MiniMax espera un archivo 'file' y el propósito 'voice_clone'
    formData.append('file', audioBlob, 'voice_sample.wav');
    formData.append('purpose', 'voice_clone');

    try {
        const response = await fetch(`${MINIMAX_CONFIG.API_URL_FILE_UPLOAD}?GroupId=${MINIMAX_CONFIG.GROUP_ID}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MINIMAX_CONFIG.API_KEY}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("MiniMax Upload Error:", errText);
            throw new Error(`Error subiendo voz a MiniMax: ${response.status}`);
        }

        const data = await response.json();
        if (!data.file_id) {
            throw new Error("MiniMax no devolvió un File ID.");
        }

        // Devolvemos el ID del archivo subido
        return data.file_id.toString();

    } catch (error) {
        console.error("Error en uploadVoiceSampleToMiniMax:", error);
        throw error;
    }
}

/**
 * Genera el audio clonado usando MiniMax (T2A v2).
 * Usa el File ID que obtuvimos al subir la muestra.
 */
export async function generateMiniMaxTTS(
    text: string,
    audioSampleBase64: string,
    audioMimeType: string = 'audio/wav',
    onStatus?: (status: { stage: string, position: number }) => void,
    voiceId?: string
): Promise<{ data: string, mimeType: string }> {

    if (!audioSampleBase64 && !voiceId) {
        throw new Error("Muestra de voz o Voice ID necesario para MiniMax.");
    }

    // Notificar estado
    if (onStatus) onStatus({ stage: "Generando con MiniMax...", position: 1 });

    try {
        // Call our serverless function instead of direct API
        const response = await fetch('/api/minimax', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audioBase64: audioSampleBase64,
                text: text,
                voiceId: voiceId
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("MiniMax API Error:", errorData);
            throw new Error(`Error en MiniMax: ${errorData.error}`);
        }

        const data = await response.json();
        return { data: data.data, mimeType: data.mimeType };

    } catch (error: any) {
        console.error("Error crítico en MiniMax Service:", error);
        throw new Error(error.message || "Error al conectar con el narrador veloz (MiniMax).");
    }
}

/**
 * Utilidad: Convertir Hex String a Base64
 * (MiniMax devuelve audio en Hex)
 */
function hexToBase64(hexstring: string): string {
    const match = hexstring.match(/\w{2}/g);
    if (!match) return "";
    const uint8Array = new Uint8Array(match.map(h => parseInt(h, 16)));
    // Convertir Uint8Array a String binario
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(uint8Array[i]);
    }
    // Convertir a Base64
    return window.btoa(binary);
}
