import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { audioBase64, text, voiceId: overrideVoiceId } = req.body;
        if (!text) return res.status(400).json({ error: 'Missing text' });

        const MINIMAX_API_KEY = (process.env.MINIMAX_API_KEY || process.env.VITE_MINIMAX_API_KEY || '').trim();
        const MINIMAX_GROUP_ID = (process.env.MINIMAX_GROUP_ID || process.env.VITE_MINIMAX_GROUP_ID || '').trim();

        const targetVoiceId = overrideVoiceId || process.env.VITE_MINIMAX_VOICE_ID;
        let fileId = null;

        // Subida de voz para clonación
        if (!targetVoiceId || targetVoiceId === 'MINIMAX_LOCAL') {
            if (!audioBase64) return res.status(400).json({ error: 'No audio sample for cloning' });

            const formData = new FormData();
            const blob = new Blob([Buffer.from(audioBase64, 'base64')], { type: 'audio/wav' });
            formData.append('file', blob, 'voice.wav');
            formData.append('purpose', 'voice_clone');

            const upRes = await fetch(`https://api.minimax.io/v1/files/upload?GroupId=${MINIMAX_GROUP_ID}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
                body: formData
            });
            const upData = await upRes.json();
            fileId = upData.file_id;
        }

        // Generación de Audio con el modelo CORRECTO
        const ttsPayload = {
            model: "speech-01-turbo", // Este es el nombre exacto que reconoce la API V2
            text: text,
            voice_setting: {
                voice_id: fileId ? "voice_clone" : (targetVoiceId || "male-qn-01"),
                speed: 1.0,
                vol: 1.0,
                pitch: 0
            },
            voice_clone_file_id: fileId || undefined
        };

        const ttsRes = await fetch(`https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(ttsPayload)
        });

        const ttsData = await ttsRes.json();

        if (ttsData.base_resp?.status_code !== 0) {
            return res.status(500).json({
                error: ttsData.base_resp?.status_msg || 'Error en MiniMax',
                code: ttsData.base_resp?.status_code
            });
        }

        if (ttsData.data?.audio) {
            const buffer = Buffer.from(ttsData.data.audio, 'hex');
            return res.status(200).json({ data: buffer.toString('base64'), mimeType: 'audio/mp3' });
        }

        return res.status(500).json({ error: 'No se recibió audio', details: ttsData });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
