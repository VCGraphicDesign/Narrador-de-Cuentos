import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. Use GET to access this diagnostic.' });
    }

    try {
        // Read environment variables
        const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || process.env.VITE_MINIMAX_API_KEY;
        const MINIMAX_GROUP_ID = process.env.MINIMAX_GROUP_ID || process.env.VITE_MINIMAX_GROUP_ID;
        const MINIMAX_VOICE_ID = process.env.MINIMAX_VOICE_ID || process.env.VITE_MINIMAX_VOICE_ID;

        // Mask the API key for security (show only first 10 chars)
        const maskedKey = MINIMAX_API_KEY
            ? `${MINIMAX_API_KEY.substring(0, 10)}...`
            : 'NOT_FOUND';

        const diagnosticInfo = {
            timestamp: new Date().toISOString(),
            environment: {
                MINIMAX_API_KEY_STATUS: MINIMAX_API_KEY ? 'FOUND' : 'MISSING',
                MINIMAX_API_KEY_PREVIEW: maskedKey,
                MINIMAX_API_KEY_LENGTH: MINIMAX_API_KEY?.length || 0,
                MINIMAX_GROUP_ID_STATUS: MINIMAX_GROUP_ID ? 'FOUND' : 'MISSING',
                MINIMAX_GROUP_ID_VALUE: MINIMAX_GROUP_ID || 'NOT_FOUND',
                MINIMAX_VOICE_ID_STATUS: MINIMAX_VOICE_ID ? 'FOUND' : 'MISSING',
                MINIMAX_VOICE_ID_VALUE: MINIMAX_VOICE_ID || 'NOT_FOUND',
            },
            test: {
                message: 'Testing connection to MiniMax API...',
                status: 'PENDING'
            }
        };

        // Test actual connection to MiniMax
        if (MINIMAX_API_KEY && MINIMAX_GROUP_ID) {
            try {
                const testResponse = await fetch(
                    `https://api.minimax.chat/v1/t2a_v2?GroupId=${MINIMAX_GROUP_ID}`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${MINIMAX_API_KEY}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            model: "speech-01-turbo-240228",
                            text: "Test",
                            stream: false,
                            voice_setting: {
                                voice_id: MINIMAX_VOICE_ID || "voice_clone",
                                speed: 1.0,
                                vol: 1.0,
                                pitch: 0,
                                emotion: "happy",
                            },
                            audio_setting: {
                                sample_rate: 32000,
                                bitrate: 128000,
                                format: "mp3",
                                channel: 1,
                            }
                        }),
                    }
                );

                diagnosticInfo.test.status = testResponse.ok ? 'SUCCESS' : 'FAILED';
                diagnosticInfo.test['http_status'] = testResponse.status;
                diagnosticInfo.test['http_status_text'] = testResponse.statusText;

                if (!testResponse.ok) {
                    const errorText = await testResponse.text();
                    diagnosticInfo.test['error_response'] = errorText;
                }
            } catch (testError: any) {
                diagnosticInfo.test.status = 'ERROR';
                diagnosticInfo.test['error_message'] = testError.message;
            }
        } else {
            diagnosticInfo.test.status = 'SKIPPED';
            diagnosticInfo.test['reason'] = 'Missing API_KEY or GROUP_ID';
        }

        return res.status(200).json({
            diagnostic: diagnosticInfo,
            instructions: {
                step1: 'Revisa que todas las variables digan "FOUND"',
                step2: 'Verifica que MINIMAX_API_KEY_PREVIEW coincida con tu llave',
                step3: 'Verifica que MINIMAX_GROUP_ID_VALUE sea el correcto',
                step4: 'Si test.status es FAILED, lee error_response para ver qué dice MiniMax',
                step5: 'Comparte esta información conmigo para ayudarte'
            }
        });

    } catch (error: any) {
        return res.status(500).json({
            error: 'Diagnostic failed',
            message: error.message
        });
    }
}
