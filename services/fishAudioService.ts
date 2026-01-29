
import * as msgpack from "msgpack-lite";

/**
 * Configuración del servicio Fish Audio
 */
const FISH_AUDIO_CONFIG = {
    API_URL_TTS: "https://api.fish.audio/v1/tts",
    // La API Key se inyectará. Para desarrollo local la ponemos aquí (temporalmente).
    // Fish Audio usa MessagePack para enviar el audio binario, es muy eficiente.
    API_KEY: process.env.VITE_FISH_AUDIO_API_KEY || "b6f11525a2d146b5b7babac88e7a1901",
};

/**
 * Genera audio clonado usando Fish Audio.
 * Este método es "instantáneo": le envías el audio de referencia y el texto en la misma petición.
 */
export async function generateFishAudioTTS(
    text: string,
    audioSampleBase64: string,
    onStatus?: (status: { stage: string, position: number }) => void
): Promise<{ data: string, mimeType: string }> {

    if (!audioSampleBase64) {
        throw new Error("Muestra de voz necesaria para Fish Audio.");
    }

    // Notificar estado
    if (onStatus) onStatus({ stage: "Usando Pez Mágico (Fish Audio)...", position: 1 });

    try {
        // 1. Convertir la muestra de Base64 a Bytes (ArrayBuffer)
        const audioReferenceResponse = await fetch(`data:audio/wav;base64,${audioSampleBase64}`);
        const audioReferenceBlob = await audioReferenceResponse.blob();
        // Necesitamos convertir el blob a un Array de bytes para enviarlo
        const audioReferenceBuffer = await audioReferenceBlob.arrayBuffer();
        // Convertirlo a array de números para el JSON si es necesario, 
        // pero Fish Audio suele pedir referencias subidas o bytes.
        // Revisando doc: Fish Audio tiene endpoint /v1/tts que acepta "references" como objetos con "audio" (bytes/base64).

        // Preparar el cuerpo de la petición (MessagePack es preferido por Fish Audio para eficiencia)
        // Pero su API REST estándar acepta JSON con referencias en hexadecimal o base64?
        // Vamos a usar el endpoint estándar JSON para simplificar primero.

        // Fish Audio API Request Object
        const requestBody = {
            text: text,
            chunk_length: 200, // Speed optimization
            format: "mp3",
            mp3_bitrate: 128,
            references: [
                {
                    audio: await blobToBytes(audioReferenceBlob), // Enviamos los bytes crudos si usamos MessagePack
                    text: "" // Texto de referencia opcional
                }
            ],
            reference_id: null,
            normalize: true,
            latency: "normal"
        };

        // Para usar MessagePack (requerido para enviar audio binario en la misma request eficientemente)
        const encodedBody = msgpack.encode(requestBody);

        const response = await fetch(FISH_AUDIO_CONFIG.API_URL_TTS, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${FISH_AUDIO_CONFIG.API_KEY}`,
                "Content-Type": "application/msgpack", // Importante: indicamos que enviamos msgpack
            },
            body: encodedBody,
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Fish Audio Error:", errorText);
            throw new Error(`Error en Fish Audio: ${response.status}`);
        }

        const responseBuffer = await response.arrayBuffer();
        // La respuesta es el archivo de audio directo (bytes)

        // Convertir a Base64 para la App
        const base64Audio = arrayBufferToBase64(responseBuffer);

        return { data: base64Audio, mimeType: 'audio/mp3' };

    } catch (error: any) {
        console.error("Error crítico en Fish Audio Service:", error);
        throw new Error("El Pez Mágico no respondió.");
    }
}

// Utilidad: Blob a Array de Bytes (Uint8Array)
async function blobToBytes(blob: Blob): Promise<Uint8Array> {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
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
