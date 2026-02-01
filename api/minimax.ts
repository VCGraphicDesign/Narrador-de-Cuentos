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
            return res.status(500).json({ error: 'Falta la MINIMAX_API_KEY en Vercel.' });
        }

        if (!MINIMAX_GROUP_ID) {
            return res.status(500).json({ error: 'Falta el MINIMAX_GROUP_ID en Vercel.' });
        }

        const targetVoiceId = overrideVoiceId || DEFAULT_VOICE_ID;
        let fileId = null;

        // 1. Si no hay ID de voz, subimos la muestra
        if (!targetVoiceId || targetVoiceId === 'MINIMAX_LOCAL' || targetVoiceId === 'PENDING') {
            if (!audioBase64) {
                return res.status(400).json({ error: 'No Voice ID provided and no audio sample to clone.' });
            }

            const audioBuffer = Buffer.from(audioBase64, 'base64');
            const formData = new FormData();
            const blob = new Blob([audioBuffer], { type: 'audio/wav' });
            formData.append('file', blob, 'voice_sample.wav');
            formData.append('purpose', 'voice_clone');

            const uploadResponse = await fetch(
                `https://api.minimax.io/v1/files/upload?GroupId=${MINIMAX_GROUP_ID}`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
                    body: formData,
                }
            );

            if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                return res.status(500).json({ error: 'Error subiendo voz', details: errorText });
            }

            const uploadData = await uploadResponse.json();
            fileId = uploadData.file_id;
        }

        // 2. Generar audio (Payload ULTRA-MÍNIMO)
        const ttsPayload: any = {
            model: "speech-01-turbo",
            text: text,
            voice_setting: {
                voice_id: (targetVoiceId && targetVoiceId !== 'MINIMAX_LOCAL') ? targetVoiceId : "voice_clone",
                speed: 1.0,
                vol: 1.0,
                pitch: 0
            }
        };

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

        const ttsData = await ttsResponse.json();

        if (ttsData.base_resp && ttsData.base_resp.status_code !== 0) {
            return res.status(500).json({
                error: ttsData.base_resp.status_msg,
                code: ttsData.base_resp.status_code
            });
        }

        if (ttsData.data && ttsData.data.audio) {
            const buffer = Buffer.from(ttsData.data.audio, 'hex');
            return res.status(200).json({
                data: buffer.toString('base64'),
                mimeType: 'audio/mp3'
            });
        }

        return res.status(500).json({ error: 'Formato de respuesta inesperado', full: ttsData });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
