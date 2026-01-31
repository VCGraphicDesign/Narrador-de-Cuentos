
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
          {hasRealId || profile?.id === 'STORED_VOICE_MODE' ? "¡VOZ DE LA ABU DETECTADA! ✨" : profile ? "¡Voz Recibida! ✨" : "¿Cómo es tu voz?"}
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

        {hasRealId || profile?.id === 'STORED_VOICE_MODE' ? (
          <p className="text-rose-800 font-bold bg-white/50 px-4 py-1 rounded-full border border-rose-200">¡Tu esencia está lista para narrar cuentos!</p>
        ) : profile ? (
          <p className="text-rose-400 text-sm font-bold animate-pulse">Sincronizando tu esencia...</p>
        ) : (
          !error && <p className="text-rose-400 text-sm font-bold">Graba un saludo corto para que aprenda a hablar como tú.</p>
        )}

        {profile?.id === 'STORED_VOICE_MODE' ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center justify-center gap-3 px-8 py-3 rounded-[1.5rem] bg-rose-500 text-white font-black shadow-[0_5px_0_rgb(159,18,57)] scale-105">
              <img
                src="/book.png"
                className="w-10 h-10 object-contain animate-float"
                alt="Libro Mágico"
              />
              <span className="text-lg">VOZ DE LA ABU ACTIVA</span>
            </div>
            <p className="text-rose-600 text-[10px] font-black uppercase mt-4 bg-white px-3 py-1 rounded-full shadow-sm border border-rose-100 italic">
              Conectado a tu voz mágica guardada
            </p>
          </div>
        ) : (
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isCreatingProfile && !isRecording}
            className={`group relative flex items-center justify-center gap-2 px-6 py-2.5 rounded-[1.5rem] text-white font-black transition-all shadow-[0_5px_0_rgb(225,29,72)] active:shadow-none active:translate-y-1 text-base ${isRecording ? 'bg-rose-600 hover:bg-rose-700 shadow-[0_5px_0_rgb(159,18,57)]' : 'bg-rose-400 hover:bg-rose-500'
              }`}
          >
            <img
              src="/mic.png"
              className={`w-10 h-10 object-contain transition-transform ${isRecording ? 'scale-125' : 'group-hover:rotate-12'}`}
              alt="Microfono"
            />
            {isRecording ? "¡LISTO!" : profile ? "REHACER GRABACIÓN" : "GRABAR MI VOZ"}
          </button>
        )}
      </div>
    </div>
  );
};

const StoryInput: React.FC<{
  onSubmit: (prompt: string) => void;
  isGenerating: boolean;
  isVoiceRecorded: boolean;
  isStoredMode: boolean;
}> = ({ onSubmit, isGenerating, isVoiceRecorded, isStoredMode }) => {
  const [prompt, setPrompt] = useState('');
  return (
    <div className="glass-card rounded-[3rem] p-8 mb-8 shadow-xl border-rose-200 bg-rose-50/60">
      <div className="flex flex-col gap-5 text-center">
        {isStoredMode ? (
          <div className="bg-rose-100/50 text-rose-800 px-6 py-3 rounded-2xl text-sm font-bold mb-2 border-2 border-rose-200 animate-fade-in">
            ¡Abu, tu voz ya está detectada! Solo empieza a crear el cuento para que la magia comience. ✨
          </div>
        ) : (
          <div className="bg-rose-100 text-rose-600 px-5 py-1.5 rounded-2xl text-xs font-black uppercase tracking-widest self-center mb-2 border-2 border-rose-200">
            Paso 1: La Gran Idea
          </div>
        )}
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
      const audioBlob = new Blob([bytes.buffer as ArrayBuffer], { type: state.audioMimeType || 'audio/mpeg' });
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
        <div className="flex flex-col items-center py-16 gap-10">
          <div className="relative">
            {state.status === 'generating-text' ? (
              <div className="relative group">
                <img src="/book.png" className="w-40 h-40 object-contain animate-float" alt="Libro" />
                <div className="absolute -top-4 -right-4 text-3xl animate-bounce">🖋️</div>
              </div>
            ) : (
              <div className="relative group">
                <img src="/hourglass.png" className="w-32 h-32 object-contain animate-spin-slow" alt="Espera" />
              </div>
            )}
          </div>

          <div className="text-center space-y-4">
            <p className="text-rose-600 font-black animate-pulse text-2xl uppercase tracking-[0.2em]">
              {state.status === 'generating-text' ? 'Escribiendo magia...' :
                state.status === 'generating-audio' ? 'Narrando tu aventura...' :
                  'Preparando hechizos...'}
            </p>

            {state.progress && (
              <div className="bg-rose-100 rounded-full h-4 w-64 mx-auto overflow-hidden border-2 border-rose-300 shadow-inner">
                <div
                  className="bg-rose-500 h-full transition-all duration-500 ease-out"
                  style={{ width: `${(state.progress.current / state.progress.total) * 100}%` }}
                />
                <div className="flex justify-between items-center mt-6">
                  <p className="text-rose-400 font-bold text-xs uppercase tracking-widest">
                    Página {state.progress.current} de {state.progress.total}
                  </p>
                  {state.progress.queuePosition !== undefined && state.progress.queuePosition > 0 && (
                    <p className="text-rose-500 font-black text-xs uppercase tracking-tighter bg-white px-3 py-1 rounded-full shadow-sm animate-bounce">
                      Posición en cola: #{state.progress.queuePosition}
                    </p>
                  )}
                </div>
              </div>
            )}

            {state.status === 'generating-audio' && (
              <p className="text-rose-400 font-medium italic text-sm mt-4 max-w-[280px] mx-auto">
                Estamos en la cola del bosque mágico. Tu voz llegará pronto...
              </p>
            )}
          </div>
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
                className="group relative w-32 h-32 flex items-center justify-center transition-all active:scale-95 shadow-none p-0"
              >
                <img
                  src="/play.png"
                  className={`w-full h-full object-contain ${isPlaying ? 'animate-pulse' : 'hover:scale-110'}`}
                  alt="Play"
                />
              </button>

              <div className="flex flex-col gap-4 w-full px-8">
                <div className="text-center">
                  <p className="text-rose-700 font-black text-xl uppercase tracking-[0.3em] mb-1">REPRODUCIR</p>
                  <p className="text-rose-400 font-black text-sm uppercase bg-white/80 px-4 py-1 rounded-full shadow-sm">✨ Con tu voz mágica ✨</p>
                </div>

                <a
                  href={`data:${state.audioMimeType || 'audio/mpeg'};base64,${state.audioBase64}`}
                  download={`Cuento-${state.title.replace(/\s+/g, '-')}.mp3`}
                  className="group flex flex-col items-center gap-2 transition-all active:scale-95 mx-auto"
                >
                  <img
                    src="/download.png"
                    className="w-24 h-24 object-contain drop-shadow-lg hover:brightness-110 transition-all"
                    alt="Descargar"
                  />
                  <span className="bg-white text-rose-500 font-lexend font-black py-2 px-6 rounded-2xl shadow-md border-2 border-rose-100 uppercase tracking-widest text-xs">
                    Guardar en Celular
                  </span>
                </a>
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

  useEffect(() => {
    const storedMiniMaxVoiceId = (import.meta as any).env?.VITE_MINIMAX_VOICE_ID;
    const storedFishReferenceId = (import.meta as any).env?.VITE_FISH_AUDIO_REFERENCE_ID;

    if ((storedMiniMaxVoiceId || storedFishReferenceId) && !profile) {
      setProfile({
        id: 'STORED_VOICE_MODE',
        sampleBase64: '', // Not needed for stored mode
        mimeType: 'audio/wav',
        createdAt: Date.now()
      });
    }
  }, []);

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
        // Actualizamos el estado para mostrar progreso
        setStory(prev => ({
          ...prev,
          progress: { current: i + 1, total: chunks.length }
        }));

        const partResult = await generateExternalTTS(
          chunks[i],
          currentId,
          profileRef.current?.sampleBase64,
          profileRef.current?.mimeType,
          (s) => {
            setStory(prev => ({
              ...prev,
              progress: {
                current: i + 1,
                total: chunks.length,
                queuePosition: s.position
              }
            }));
          }
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
          {profile?.id !== 'STORED_VOICE_MODE' && (
            <VoiceProfileSection
              profile={profile}
              onProfileCreated={setProfile}
              isRecording={isRecording}
              setIsRecording={setIsRecording}
              isCreatingProfile={isCreatingProfile}
              error={profileError}
              onSelectKey={handleSelectKey}
            />
          )}
          <StoryInput
            onSubmit={handleGenerateStory}
            isGenerating={story.isLoading}
            isVoiceRecorded={!!profile}
            isStoredMode={profile?.id === 'STORED_VOICE_MODE'}
          />
          <StoryViewer state={story} onSelectKey={handleSelectKey} />
        </main>
      </div>
      <footer className="text-center py-16 opacity-80">
        <p className="text-rose-400 font-black text-lg tracking-[0.2em] animate-pulse">
          HECHO CON AMOR DE LA ABU Y LA MAGIA DE LA IA
        </p>
      </footer>
    </div>
  );
}
