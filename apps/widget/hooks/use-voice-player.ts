"use client";

import { useCallback, useRef, useState } from "react";

interface UseVoicePlayerReturn {
  isPlaying: boolean;
  play: (audioData: ArrayBuffer | string) => Promise<void>;
  stop: () => void;
}

export function useVoicePlayer(): UseVoicePlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(
    async (audioData: ArrayBuffer | string) => {
      // Stop any currently playing audio
      stop();

      let url: string;
      if (typeof audioData === "string") {
        url = audioData;
      } else {
        const blob = new Blob([audioData], { type: "audio/wav" });
        url = URL.createObjectURL(blob);
        urlRef.current = url;
      }

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
      };
      audio.onerror = () => {
        setIsPlaying(false);
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
      };

      await audio.play();
    },
    [stop],
  );

  return { isPlaying, play, stop };
}
