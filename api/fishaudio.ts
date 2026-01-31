import type { VercelRequest, VercelResponse } from '@vercel/node';
import { encode } from '@msgpack/msgpack';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { audioBase64, text, referenceId: overrideRefId } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing text' });
        }

        const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY || process.env.VITE_FISH_AUDIO_API_KEY;
        const DEFAULT_REFERENCE_ID = process.env.FISH_AUDIO_REFERENCE_ID || process.env.VITE_FISH_AUDIO_REFERENCE_ID;

        if (!FISH_AUDIO_API_KEY) {
            return res.status(500).json({ error: 'Falta la FISH_AUDIO_API_KEY en las variables de entorno de Vercel.' });
        }

        const targetRefId = overrideRefId || DEFAULT_REFERENCE_ID;

        // Prepare msgpack request
        const requestBody: any = {
            text: text,
            chunk_length: 200,
            format: "mp3",
            mp3_bitrate: 128,
            normalize: true,
            latency: "normal",
            references: []
        };

        if (targetRefId) {
            requestBody.reference_id = targetRefId;
        } else if (audioBase64) {
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const audioBytes = new Uint8Array(audioBuffer);
            requestBody.references = [
                {
                    audio: audioBytes,
                    text: ""
                }
            ];
        } else {
            return res.status(400).json({ error: 'No Reference ID provided and no audio sample to clone.' });
        }

        const encodedBody = encode(requestBody);

        const response = await fetch('https://api.fish.audio/v1/tts', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${FISH_AUDIO_API_KEY}`,
                'Content-Type': 'application/msgpack',
            },
            body: Buffer.from(encodedBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Fish Audio Error:', errorText);

            // Try to parse as JSON for better error message
            try {
                const errJson = JSON.parse(errorText);
                return res.status(500).json({ error: 'Failed to generate TTS from Fish Audio', details: errJson });
            } catch (e) {
                return res.status(500).json({ error: 'Failed to generate TTS', details: errorText });
            }
        }

        const responseBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(responseBuffer).toString('base64');

        return res.status(200).json({
            data: base64Audio,
            mimeType: 'audio/mp3'
        });

    } catch (error: any) {
        console.error('Fish Audio API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
