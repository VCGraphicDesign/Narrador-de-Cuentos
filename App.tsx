
import React, { useState, useRef, useEffect } from 'react';
import { generateStory } from './services/geminiService';
import { generateExternalTTS, createExternalVoiceProfile } from './services/voiceService';
import { StoryState, VoiceProfile } from './types';
import { decodeBase64 } from './utils/audioUtils';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const Header: React.FC = () => (
  <header className="pt-20 pb-12 px-4 text-center">
    <h1 className="text-5xl md:text-6xl font-lexend font-black text-rose-600 mb-2 drop-shadow-[0_4px_0_rgba(255,255,255,1)]">
      Narrador de Cuentos
    </h1>
    <p className="text-xl text-rose-400 max-w-2xl mx-auto font-bold italic drop-shadow-sm">
      ¡Convierte tus sueños en historias con tu propia voz!
    </p>
  </header>
);

const VoiceProfileSection: React.FC<{
  profile: VoiceProfile | null;
  onProfileCreated: (profile: VoiceProfile) => void;
  isRecording: boolean;
  setIsRecording: (val: boolean) => void;
  isCreatingProfile: boolean;
  error: string | null;
  onSelectKey: () => void;
}> = ({ profile, onProfileCreated, isRecording, setIsRecording, isCreatingProfile, error, onSelectKey }) => {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = (reader.result as string).split(',')[1];
          onProfileCreated({ id: 'PENDING', sampleBase64: base64data, mimeType: 'audio/wav', createdAt: Date.now() });
        };
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("¡Ups! Necesitamos permiso para usar el micrófono.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const hasRealId = profile && profile.id !== 'PENDING';

  return (
    <div className="glass-card rounded-[3rem] p-8 mb-6 shadow-xl border-rose-200 bg-rose-50/50 relative overflow-hidden">
      <div className="flex flex-col items-center gap-4 relative z-10 text-center">
        <div className="bg-rose-100 text-rose-600 px-5 py-1.5 rounded-2xl text-xs font-black uppercase tracking-widest mb-2 border-2 border-rose-200">
          Paso 1: Tu Voz Mágica
        </div>

        <h2 className="text-3xl font-lexend font-black text-rose-800">
          {hasRealId ? "¡Voz Guardada! 🍃" : profile ? "¡Voz Recibida! ✨" : "¿Cómo es tu voz?"}
        </h2>

        {isCreatingProfile && (
          <div className="text-rose-400 font-black animate-bounce text-sm uppercase bg-white px-4 py-1 rounded-full shadow-sm">
            Haciendo magia... 🧚‍♀️
          </div>
        )}

        {error && !isRecording && (
          <div className="bg-rose-50 border-2 border-rose-200 p-5 rounded-[2rem] text-rose-800 text-xs font-bold shadow-inner">
            {error}
            <button onClick={onSelectKey} className="block mt-3 bg-rose-600 text-white px-5 py-2 rounded-full mx-auto shadow-md active:translate-y-1">Configurar Llave</button>
          </div>
        )}

        {hasRealId ? (
          <p className="text-rose-800 font-bold bg-white/50 px-4 py-1 rounded-full border border-rose-200">¡Tu clon de voz está listo para narrar!</p>
        ) : profile ? (
          <p className="text-rose-400 text-sm font-bold animate-pulse">Sincronizando tu esencia...</p>
        ) : (
          !error && <p className="text-rose-400 text-sm font-bold">Graba un saludo corto para que aprenda a hablar como tú.</p>
        )}

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isCreatingProfile && !isRecording}
          className={`group relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-[1.5rem] text-white font-black transition-all shadow-[0_5px_0_rgb(225,29,72)] active:shadow-none active:translate-y-1 text-base ${isRecording ? 'bg-rose-600 hover:bg-rose-700 shadow-[0_5px_0_rgb(159,18,57)]' : 'bg-rose-400 hover:bg-rose-500'
            }`}
        >
          <span className="text-xl">{isRecording ? "⏹️" : "🎤"}</span>
          {isRecording ? "¡LISTO!" : profile ? "REHACER GRABACIÓN" : "GRABAR MI VOZ"}
        </button>
      </div>
    </div>
  );
};

const StoryInput: React.FC<{
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  isVoiceRecorded: boolean;
}> = ({ onSubmit, isGenerating, isVoiceRecorded }) => {
  const [prompt, setPrompt] = useState('');
  return (
    <div className="glass-card rounded-[3rem] p-8 mb-8 shadow-xl border-rose-200 bg-rose-50/60">
      <div className="flex flex-col gap-5 text-center">
        <div className="bg-rose-100 text-rose-600 px-5 py-1.5 rounded-2xl text-xs font-black uppercase tracking-widest self-center mb-2 border-2 border-rose-200">
          Paso 2: La Gran Idea
        </div>
        <h2 className="text-3xl font-lexend font-black text-rose-800">¿De qué trata el cuento?</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ej: Un unicornio verde que comía manzanas de cristal..."
          disabled={isGenerating}
          className="w-full p-6 rounded-[2.5rem] border-4 border-rose-100 focus:border-rose-300 focus:ring-0 transition-all bg-white text-rose-950 placeholder-rose-200 text-xl font-bold min-h-[120px]"
        />
        <button
          onClick={() => onSubmit(prompt)}
          disabled={isGenerating || !isVoiceRecorded || !prompt.trim()}
          className="group relative flex items-center justify-center gap-2 px-8 py-3 rounded-[1.5rem] text-white font-black transition-all shadow-[0_5px_0_rgb(225,29,72)] active:shadow-none active:translate-y-1 text-lg bg-rose-400 hover:bg-rose-500 disabled:opacity-50 disabled:bg-rose-400 disabled:text-rose-100 self-center"
        >
          {isGenerating ? 'LANZANDO HECHIZOS...' : 'CREA EL CUENTO CON AYUDA DE LA IA'}
        </button>
      </div>
    </div>
  );
};

const StoryViewer: React.FC<{ state: StoryState; onSelectKey: () => void }> = ({ state, onSelectKey }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (state.audioBase64 && audioRef.current) {
      const bytes = decodeBase64(state.audioBase64);
      const audioBlob = new Blob([bytes], { type: state.audioMimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(audioBlob);
      audioRef.current.src = url;
      audioRef.current.load();
      return () => URL.revokeObjectURL(url);
    }
  }, [state.audioBase64, state.audioMimeType]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play().catch(console.error);
  };

  if (state.status === 'idle') return null;

  return (
    <div className="glass-card rounded-[4rem] p-10 mb-8 shadow-2xl border-rose-300 bg-rose-50/40 animate-fade-in border-4">
      {state.status === 'error' && (
        <div className="bg-rose-100 text-rose-800 p-8 rounded-[3rem] text-center border-4 border-rose-300 shadow-inner">
          <p className="font-black text-2xl mb-2">¡Algo falló en el bosque!</p>
          <p className="font-bold mb-4">{state.error}</p>
          <button onClick={onSelectKey} className="bg-rose-600 text-white px-8 py-3 rounded-full font-black shadow-lg">Arreglar Clave</button>
        </div>
      )}

      {state.isLoading && (
        <div className="flex flex-col items-center py-16 gap-8">
          <div className="relative">
            <div className="w-24 h-24 border-[10px] border-rose-100 border-t-rose-500 rounded-full animate-spin shadow-lg" />
            <div className="absolute inset-0 flex items-center justify-center text-4xl">🪄</div>
          </div>
          <p className="text-rose-600 font-black animate-pulse text-2xl uppercase tracking-[0.2em] text-center">
            {state.status === 'generating-text' ? 'Escribiendo magia...' :
              state.status === 'generating-audio' ? 'Grabando tu voz...' :
                'Preparando aventura...'}
          </p>
        </div>
      )}

      {state.content && !state.isLoading && (
        <div className="animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-lexend font-black text-rose-500 mb-8 text-center drop-shadow-[0_2px_0_rgba(255,255,255,1)] leading-tight">
            {state.title}
          </h2>
          <div className="text-rose-950 leading-relaxed text-2xl whitespace-pre-wrap mb-10 max-h-[500px] overflow-y-auto pr-6 custom-scrollbar bg-white/60 p-10 rounded-[3rem] border-4 border-rose-100 font-bold italic shadow-inner">
            {state.content}
          </div>

          {state.audioBase64 && (
            <div className="mt-8 p-12 bg-gradient-to-br from-rose-100 to-rose-200 rounded-[4rem] border-4 border-white flex flex-col items-center gap-8 shadow-2xl relative">
              <div className="absolute -top-6 -left-6 text-5xl animate-bounce">🍭</div>
              <div className="absolute -top-6 -right-6 text-5xl animate-bounce delay-150">⭐</div>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-5xl animate-pulse">👑</div>

              <audio ref={audioRef} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} className="hidden" />
              <button
                onClick={togglePlay}
                className="w-32 h-32 flex items-center justify-center bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-[0_12px_0_rgb(190,18,60)] active:shadow-none active:translate-y-2 transition-all hover:scale-110 border-4 border-white"
              >
                {isPlaying ? (
                  <svg className="h-16 w-16" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                ) : (
                  <svg className="h-16 w-16 ml-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                )}
              </button>
              <div className="text-center">
                <p className="text-rose-700 font-black text-xl uppercase tracking-[0.3em] mb-1">REPRODUCIR</p>
                <p className="text-rose-400 font-black text-sm uppercase bg-white/80 px-4 py-1 rounded-full shadow-sm">✨ Con tu voz mágica ✨</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [profile, setProfile] = useState<VoiceProfile | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [story, setStory] = useState<StoryState>({
    title: '', content: '', audioBase64: null, audioMimeType: null,
    isLoading: false, status: 'idle', error: null
  });

  const profileRef = useRef<VoiceProfile | null>(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  const handleSelectKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        setProfileError(null);
        setStory(prev => ({ ...prev, error: null, status: 'idle' }));
      } else {
        alert("Para que la App funcione en Vercel, debes añadir la variable de entorno 'GEMINI_API_KEY' en el panel de control de Vercel y hacer un 'Redeploy'.");
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (profile && profile.id === 'PENDING' && !isCreatingProfile) {
      const syncVoice = async () => {
        setIsCreatingProfile(true);
        setProfileError(null);
        try {
          const voiceId = await createExternalVoiceProfile(profile.sampleBase64, profile.mimeType);
          setProfile(prev => prev ? { ...prev, id: voiceId } : null);
        } catch (err: any) {
          setProfileError(err.message);
          if (!err.message.includes('Clave')) setProfile(null);
        } finally { setIsCreatingProfile(false); }
      };
      syncVoice();
    }
  }, [profile, isCreatingProfile]);

  const handleGenerateStory = async (prompt: string) => {
    if (!profile) return alert("¡Necesitamos escuchar tu voz primero!");

    setStory({ ...story, isLoading: true, status: 'generating-text', error: null, content: '', audioBase64: null, audioMimeType: null });

    try {
      const { title, content } = await generateStory(prompt);
      setStory(prev => ({ ...prev, title, content, status: 'generating-audio' }));

      let currentId = profileRef.current?.id;
      let attempts = 0;
      while ((!currentId || currentId === 'PENDING') && attempts < 40) {
        await new Promise(r => setTimeout(r, 1000));
        currentId = profileRef.current?.id;
        attempts++;
      }

      if (!currentId || currentId === 'PENDING') {
        throw new Error("Tu voz se está preparando. Por favor, espera unos segundos e intenta de nuevo.");
      }

      // IMPORTANTE: Aquí implementamos el "Splitting" para cuentos largos
      const { splitTextIntoChunks, concatenateAudioBase64 } = await import('./utils/audioUtils');

      // Dividimos el cuento en trozos de ~250 caracteres para XTTS-v2
      const chunks = splitTextIntoChunks(content, 250);
      const audioResults: { data: string, mimeType: string }[] = [];

      for (let i = 0; i < chunks.length; i++) {
        // Actualizamos el estado para mostrar progreso (opcional)
        console.log(`Generando parte ${i + 1} de ${chunks.length}...`);
        const partResult = await generateExternalTTS(
          chunks[i],
          currentId,
          profileRef.current?.sampleBase64,
          profileRef.current?.mimeType
        );
        audioResults.push(partResult);
      }

      // Unimos todos los audios generados en uno solo de forma fluida
      const finalAudio = await concatenateAudioBase64(audioResults);

      setStory(prev => ({
        ...prev,
        audioBase64: finalAudio.data,
        audioMimeType: finalAudio.mimeType,
        status: 'ready',
        isLoading: false
      }));

    } catch (err: any) {
      setStory(prev => ({
        ...prev,
        isLoading: false,
        status: 'error',
        error: err.message || 'La magia tuvo un pequeño tropiezo.'
      }));
    }
  };

  return (
    <div className="min-h-screen font-lexend pb-32 selection:bg-rose-200">
      <div className="max-w-3xl mx-auto px-6">
        <Header />
        <main className="space-y-10">
          <VoiceProfileSection
            profile={profile}
            onProfileCreated={setProfile}
            isRecording={isRecording}
            setIsRecording={setIsRecording}
            isCreatingProfile={isCreatingProfile}
            error={profileError}
            onSelectKey={handleSelectKey}
          />
          <StoryInput
            onSubmit={handleGenerateStory}
            isGenerating={story.isLoading}
            isVoiceRecorded={!!profile}
          />
          <StoryViewer state={story} onSelectKey={handleSelectKey} />
        </main>
      </div>
      <footer className="text-center py-16 opacity-80">
        <p className="text-rose-400 font-black text-lg tracking-[0.4em] animate-pulse">
          HECHO CON AMOR Y MAGIA
        </p>
      </footer>
    </div>
  );
}
