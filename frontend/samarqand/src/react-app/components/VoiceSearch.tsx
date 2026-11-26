import { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface VoiceSearchProps {
  onResult: (text: string) => void;
}

type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionErrorEventLike = { error: string };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export default function VoiceSearch({ onResult }: VoiceSearchProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    setIsSupported(Boolean(getSpeechRecognitionConstructor()));
  }, []);

  const startListening = () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-SA'; // Arabic
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
      setTranscript('');
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      onResult(text);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const stopListening = () => {
    setIsListening(false);
  };

  if (!isSupported) return null;

  return (
    <div className="relative">
      <button
        onClick={isListening ? stopListening : startListening}
        className={`p-3 rounded-full transition-all ${
          isListening
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-gradient-to-r from-[#007A3D] via-[#0B0F19] to-[#CE1126] hover:shadow-lg'
        }`}
        title={isListening ? 'إيقاف التسجيل' : 'البحث الصوتي'}
      >
        {isListening ? (
          <MicOff className="text-white" size={20} />
        ) : (
          <Mic className="text-white" size={20} />
        )}
      </button>

      {isListening && (
        <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-3 py-1 rounded-full text-xs whitespace-nowrap animate-bounce">
          <div className="flex items-center gap-1">
            <Volume2 size={14} />
            <span>جارٍ الاستماع...</span>
          </div>
        </div>
      )}

      {transcript && !isListening && (
        <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-white border-2 border-[#007A3D] px-4 py-2 rounded-lg text-sm text-gray-700 whitespace-nowrap shadow-lg">
          "{transcript}"
        </div>
      )}
    </div>
  );
}
