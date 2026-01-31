
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
    onStatus?: (status: { stage: string, position: number }) => void
): Promise<{ data: string, mimeType: string }> {

    if (!audioSampleBase64) {
        throw new Error("Muestra de voz necesaria para MiniMax.");
    }

    // Notificar estado
    if (onStatus) onStatus({ stage: "Subiendo muestra de voz...", position: 1 });

    try {
        // 1. Convertir Base64 a Blob
        const res = await fetch(`data:${audioMimeType};base64,${audioSampleBase64}`);
        const audioBlob = await res.blob();

        // 2. Subir la muestra a MiniMax
        const fileId = await uploadVoiceSampleToMiniMax(audioBlob);
        console.log("Voz subida a MiniMax con ID:", fileId);

        // Notificar estado
        if (onStatus) onStatus({ stage: "Generando audio clonado...", position: 0 });

        // 3. Solicitar la generación del audio (Voice Cloning)
        // Según la doc de MiniMax T2A v2:
        // POST https://api.minimax.chat/v1/t2a_v2?GroupId={GroupID}
        const payload = {
            model: MINIMAX_CONFIG.MODEL_ID,
            text: text,
            stream: false, // Queremos el audio completo, no streaming por ahora para simplificar
            voice_setting: {
                voice_id: "voice_clone", // Indicamos que es un clon
                speed: 1.0,
                vol: 1.0,
                pitch: 0,
                emotion: "happy", // Podemos ajustar esto luego
            },
            pronunciation_dict: {
                tone: [],
            },
            voice_clone_file_id: fileId, // Aquí va el ID del archivo subido
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: "mp3",
                channel: 1,
            }
        };

        const ttsResponse = await fetch(`${MINIMAX_CONFIG.API_URL_T2A}?GroupId=${MINIMAX_CONFIG.GROUP_ID}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${MINIMAX_CONFIG.API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!ttsResponse.ok) {
            const errorDetail = await ttsResponse.text();
            console.error("MiniMax TTS Error:", errorDetail);
            throw new Error(`Error generando audio en MiniMax: ${ttsResponse.status}`);
        }

        const ttsData = await ttsResponse.json();

        // MiniMax devuelve la data binary en 'data.audio_file' (url) o 'data.audio_content' (hex/base64?)
        // Dependiendo de la versión, a veces devuelve una URL temporal o el contenido directamente.
        // Revisando documentación común: suele devolver { data: { audio_file_url: "..." } } o parecido.
        // Vamos a asumir que devuelve un JSON con audio_file (url) o content. 
        // NOTA: v2 a veces devuelve Hex string en 'data.audio'.

        // Ajuste según respuesta típica de MiniMax v2 (T2A):
        // Respuesta exitosa: { base_resp: { status_code: 0 ... }, data: { audio: "hex string...", extra_info: ... } }

        if (ttsData.base_resp && ttsData.base_resp.status_code !== 0) {
            throw new Error(`MiniMax API Error: ${ttsData.base_resp.status_msg}`);
        }

        if (ttsData.data && ttsData.data.audio) {
            // MiniMax v2 devuelve el audio como HEX STRING. Necesitamos convertirlo a Base64.
            const hexString = ttsData.data.audio;
            const base64String = hexToBase64(hexString);
            return { data: base64String, mimeType: 'audio/mp3' };
        } else {
            console.error("Respuesta inesperada de MiniMax:", ttsData);
            throw new Error("Formato de respuesta de MiniMax no reconocido.");
        }

    } catch (error: any) {
        console.error("Error crítico en MiniMax Service:", error);
        throw new Error("Error al conectar con el narrador veloz (MiniMax).");
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
