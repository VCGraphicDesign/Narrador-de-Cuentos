import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'import.meta.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
      'import.meta.env.VITE_MINIMAX_VOICE_ID': JSON.stringify(env.VITE_MINIMAX_VOICE_ID || "moss_audio_c9fc4caa-fe5f-11f0-b201-fe4237361ca8"),
      'import.meta.env.VITE_FISH_AUDIO_REFERENCE_ID': JSON.stringify(env.VITE_FISH_AUDIO_REFERENCE_ID || "f90412dfe03d4e80bdf1b94bc6157b3e"),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
