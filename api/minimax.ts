import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { audioBase64, text, voiceId: overrideVoiceId } = req.body;
        if (!text) return res.status(400).json({ error: 'Missing text' });

        const MINIMAX_API_KEY = (process.env.MINIMAX_API_KEY || process.env.VITE_MINIMAX_API_KEY || '').trim();
        const MINIMAX_GROUP_ID = (process.env.MINIMAX_GROUP_ID || process.env.VITE_MINIMAX_GROUP_ID || '').trim();

        if (!MINIMAX_API_KEY || !MINIMAX_GROUP_ID) {
            return res.status(500).json({ error: 'Configuración incompleta en Vercel (API Key o Group ID).' });
        }

        let fileId = null;
        let isCloning = false;

        // Intentar clonación solo si hay audio
        if (audioBase64 && (!overrideVoiceId || overrideVoiceId === 'MINIMAX_LOCAL')) {
            isCloning = true;
            try {
                const audioBuffer = Buffer.from(audioBase64, 'base64');
                const formData = new FormData();
                const blob = new Blob([audioBuffer], { type: 'audio/wav' });
                formData.append('file', blob, 'voice_sample.wav');
                formData.append('purpose', 'voice_clone');

                const uploadRes = await fetch(`https://api.minimax.io/v1/files/upload?GroupId=${MINIMAX_GROUP_ID}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${MINIMAX_API_KEY}` },
                    body: formData,
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    fileId = uploadData.file_id;
                }
            } catch (e) {
                console.warn("Fallo en la subida de voz, intentando voz estándar...");
            }
        }

        // Configurar Voz Final (Si falla el clon, usamos una voz default de MiniMax)
        const ttsPayload: any = {
            model: "speech-01-turbo-240228",
            text: text,
            voice_setting: {
                voice_id: (fileId) ? "voice_clone" : (overrideVoiceId || "male-qn-01"),
                speed: 1.0,
                vol: 1.0,
                pitch: 0
            }
        };

        if (fileId) ttsPayload.voice_clone_file_id = fileId;

        const ttsResponse = await fetch(`https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ttsPayload),
        });

        const ttsData = await ttsResponse.json();

        // Si da error de balance, intentamos UNA VEZ MÁS con una voz estándar forzada
        if (ttsData.base_resp?.status_code === 1007 || ttsData.base_resp?.status_msg?.includes('balance')) {
            console.log("Sin saldo para clonación, usando voz estándar gratuita...");
            ttsPayload.voice_setting.voice_id = "male-qn-01";
            delete ttsPayload.voice_clone_file_id;

            const secondTry = await fetch(`https://api.minimax.io/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(ttsPayload),
            });
            const secondData = await secondTry.json();

            if (secondData.data?.audio) {
                const buffer = Buffer.from(secondData.data.audio, 'hex');
                return res.status(200).json({ data: buffer.toString('base64'), mimeType: 'audio/mp3', info: 'Voz estándar (Saldo insuficiente para clon)' });
            }
        }

        if (ttsData.data?.audio) {
            const buffer = Buffer.from(ttsData.data.audio, 'hex');
            return res.status(200).json({ data: buffer.toString('base64'), mimeType: 'audio/mp3' });
        }

        return res.status(500).json({ error: ttsData.base_resp?.status_msg || 'Error desconocido' });

    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
}
