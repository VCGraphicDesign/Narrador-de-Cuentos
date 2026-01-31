import type { VercelRequest, VercelResponse } from '@vercel/node';
import { encode } from '@msgpack/msgpack';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { audioBase64, text } = req.body;

        if (!audioBase64 || !text) {
            return res.status(400).json({ error: 'Missing audioBase64 or text' });
        }

        const FISH_AUDIO_API_KEY = process.env.FISH_AUDIO_API_KEY || "b6f11525a2d146b5b7babac88e7a1901";

        // Convert base64 to bytes
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        const audioBytes = new Uint8Array(audioBuffer);

        // Prepare msgpack request
        const requestBody = {
            text: text,
            chunk_length: 200,
            format: "mp3",
            mp3_bitrate: 128,
            references: [
                {
                    audio: audioBytes,
                    text: ""
                }
            ],
            reference_id: null,
            normalize: true,
            latency: "normal"
        };

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
            return res.status(500).json({ error: 'Failed to generate TTS', details: errorText });
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
