const WHISPER_API_URL = process.env.WHISPER_API_URL || "http://localhost:8000";
const CHATTERBOX_API_URL =
  process.env.CHATTERBOX_API_URL || "http://localhost:4123";

/**
 * Transcribe audio using self-hosted Whisper (OpenAI-compatible API).
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.includes("webm")
    ? "webm"
    : mimeType.includes("mp4") || mimeType.includes("m4a")
      ? "m4a"
      : mimeType.includes("wav")
        ? "wav"
        : "webm";

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: mimeType }),
    `audio.${ext}`,
  );
  formData.append("model", "whisper-1");

  const res = await fetch(`${WHISPER_API_URL}/v1/audio/transcriptions`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Whisper transcription failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.text;
}

/**
 * Synthesize speech using self-hosted Chatterbox TTS (OpenAI-compatible API).
 * Returns audio as a Buffer (WAV format).
 */
export async function synthesizeSpeech(
  text: string,
  voiceId?: string | null,
): Promise<Buffer> {
  const body: Record<string, unknown> = {
    input: text,
    model: "chatterbox",
  };

  if (voiceId) {
    body.voice = voiceId;
  }

  const res = await fetch(`${CHATTERBOX_API_URL}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chatterbox TTS failed: ${res.status} ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload a voice reference audio to the Chatterbox voice library.
 * Returns the voice ID/name for later use in synthesizeSpeech.
 */
export async function uploadVoiceReference(
  audioBuffer: Buffer,
  voiceName: string,
  mimeType: string,
): Promise<string> {
  const ext = mimeType.includes("wav")
    ? "wav"
    : mimeType.includes("mp3") || mimeType.includes("mpeg")
      ? "mp3"
      : mimeType.includes("webm")
        ? "webm"
        : "wav";

  const formData = new FormData();
  formData.append(
    "file",
    new Blob([audioBuffer], { type: mimeType }),
    `${voiceName}.${ext}`,
  );
  formData.append("name", voiceName);

  const res = await fetch(`${CHATTERBOX_API_URL}/voices`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voice upload failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.name || data.id || voiceName;
}

/**
 * Delete a voice from the Chatterbox voice library.
 */
export async function deleteVoiceReference(voiceId: string): Promise<void> {
  const res = await fetch(`${CHATTERBOX_API_URL}/voices/${voiceId}`, {
    method: "DELETE",
    signal: AbortSignal.timeout(10_000),
  });

  // Ignore 404 — voice may already be deleted
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Voice delete failed: ${res.status} ${text}`);
  }
}
