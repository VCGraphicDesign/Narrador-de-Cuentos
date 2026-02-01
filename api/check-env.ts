import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const vars = {
        MINIMAX_API_KEY: process.env.MINIMAX_API_KEY ? 'CONFIGURADA (Longitud: ' + process.env.MINIMAX_API_KEY.length + ')' : 'NO CONFIGURADA',
        MINIMAX_GROUP_ID: process.env.MINIMAX_GROUP_ID ? 'CONFIGURADA' : 'NO CONFIGURADA',
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV
    };

    return res.status(200).json(vars);
}
