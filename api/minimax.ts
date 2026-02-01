import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { audioBase64, text, voiceId: overrideVoiceId } = req.body;

        if (!text) {
            return res.status(400).json({ error: 'Missing text' });
        }

        const MINIMAX_API_KEY = (process.env.MINIMAX_API_KEY || process.env.VITE_MINIMAX_API_KEY || '').trim();
        const MINIMAX_GROUP_ID = (process.env.MINIMAX_GROUP_ID || process.env.VITE_MINIMAX_GROUP_ID || '').trim();
        const DEFAULT_VOICE_ID = (process.env.MINIMAX_VOICE_ID || process.env.VITE_MINIMAX_VOICE_ID || '').trim();

        if (!MINIMAX_API_KEY) {
            return res.status(500).json({ error: 'Falta la MINIMAX_API_KEY en Vercel. Por favor, añádela en Settings > Environment Variables.' });
        }

        if (!MINIMAX_GROUP_ID) {
            return res.status(500).json({ error: 'Falta el MINIMAX_GROUP_ID en Vercel. Este número es necesario para que MiniMax acepte tu llave.' });
        }

        const targetVoiceId = overrideVoiceId || DEFAULT_VOICE_ID;

        let fileId = null;

        // If we have a voice ID, we use it directly. 
        // If not, and we have audio, we attempt to upload.
        if (!targetVoiceId) {
            if (!audioBase64) {
                return res.status(400).json({ error: 'No Voice ID provided and no audio sample to clone.' });
            }

            // 1. Convert base64 to blob
            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const formData = new FormData();

            // In Node.js, we need to handle the blob correctly for FormData
            const blob = new Blob([audioBuffer], { type: 'audio/wav' });
            formData.append('file', blob, 'voice_sample.wav');
            formData.append('purpose', 'voice_clone');

            // 2. Upload voice sample
            const uploadResponse = await fetch(
                `https://api.minimax.io/v1/files/upload?GroupId=${MINIMAX_GROUP_ID}`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                    },
                    body: formData,
                }
            );

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error('MiniMax Upload Error:', errorText);
                return res.status(500).json({ error: 'Failed to upload voice sample', details: errorText });
            }

            const uploadData = await uploadResponse.json();
            fileId = uploadData.file_id;

            if (!fileId) {
                return res.status(500).json({ error: 'MiniMax upload did not return a file_id. Check API Key and balance.' });
            }
        }

        // 3. Generate TTS
        const ttsPayload: any = {
            model: "speech-01-turbo",
            text: text,
            stream: false,
            voice_setting: {
                // If we don't have a specific voiceId, we use "voice_clone" which works with voice_clone_file_id
                voice_id: targetVoiceId || "voice_clone",
                speed: 1.0,
                vol: 1.0,
                pitch: 0,
                emotion: "happy",
            },
            pronunciation_dict: {
                tone: [],
            },
            audio_setting: {
                sample_rate: 32000,
                bitrate: 128000,
                format: "mp3",
                channel: 1,
            }
        };

        // If we uploaded a file, attach it
        if (fileId) {
            ttsPayload.voice_clone_file_id = fileId;
        }

        const ttsResponse = await fetch(
            `https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(ttsPayload),
            }
        );

        if (!ttsResponse.ok) {
            const errorDetail = await ttsResponse.text();
            console.error('MiniMax TTS Error:', errorDetail);
            return res.status(500).json({ error: 'Failed to generate TTS', details: errorDetail });
        }

        const ttsData = await ttsResponse.json();

        if (ttsData.base_resp && ttsData.base_resp.status_code !== 0) {
            return res.status(500).json({ error: ttsData.base_resp.status_msg });
        }

        if (ttsData.data && ttsData.data.audio) {
            const hexString = ttsData.data.audio;
            const buffer = Buffer.from(hexString, 'hex');
            const base64Audio = buffer.toString('base64');

            return res.status(200).json({
                data: base64Audio,
                mimeType: 'audio/mp3'
            });
        }

        return res.status(500).json({ error: 'Unexpected response format from MiniMax' });

    } catch (error: any) {
        console.error('MiniMax API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
