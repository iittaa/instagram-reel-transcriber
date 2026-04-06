import os
import tempfile
import subprocess

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


class TranscribeRequest(BaseModel):
    url: str


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    url = req.url.strip()

    # Instagram URL validation
    if "instagram.com" not in url:
        raise HTTPException(status_code=400, detail="InstagramのURLを入力してください")

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.mp3")

        # Download audio with yt-dlp
        result = subprocess.run(
            [
                "yt-dlp",
                "--no-check-certificates",
                "-x",
                "--audio-format", "mp3",
                "-o", audio_path,
                url,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            raise HTTPException(
                status_code=400,
                detail="動画の取得に失敗しました。URLが正しいか、公開リールかを確認してください。",
            )

        # Find the actual output file (yt-dlp may append extension)
        actual_path = audio_path
        if not os.path.exists(actual_path):
            # yt-dlp sometimes creates audio.mp3.mp3
            for f in os.listdir(tmpdir):
                if f.endswith(".mp3"):
                    actual_path = os.path.join(tmpdir, f)
                    break
            else:
                raise HTTPException(status_code=500, detail="音声ファイルの変換に失敗しました")

        # Transcribe with Groq Whisper
        with open(actual_path, "rb") as audio_file:
            transcription = client.audio.transcriptions.create(
                file=("audio.mp3", audio_file),
                model="whisper-large-v3",
                language="ja",
                response_format="verbose_json",
            )

    return {
        "text": transcription.text,
        "segments": [
            {"start": s.start, "end": s.end, "text": s.text}
            for s in (transcription.segments or [])
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
