
export interface StoryState {
  title: string;
  content: string;
  audioBase64: string | null;
  audioMimeType: string | null;
  isLoading: boolean;
  status: 'idle' | 'generating-text' | 'generating-audio' | 'ready' | 'error';
  error: string | null;
  progress?: { current: number; total: number; queuePosition?: number };
}

export interface VoiceProfile {
  id: string;
  sampleBase64: string;
  mimeType: string;
  createdAt: number;
}

export enum VoiceOption {
  Custom = 'Custom'
}
