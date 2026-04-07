import os
import hashlib
import hmac
import tempfile
import subprocess
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

APP_PASSWORD = os.environ.get("APP_PASSWORD", "changeme")
# SECRET_KEY is used to sign auth tokens. If unset, derive a stable value
# from APP_PASSWORD so tokens still survive restarts (but rotate when password changes).
SECRET_KEY = os.environ.get(
    "SECRET_KEY",
    hashlib.sha256(f"reel-transcriber::{APP_PASSWORD}".encode()).hexdigest(),
)
TOKEN_PAYLOAD = b"auth_v1"


def create_token() -> str:
    return hmac.new(SECRET_KEY.encode(), TOKEN_PAYLOAD, hashlib.sha256).hexdigest()


def verify_token_value(token: str) -> bool:
    if not token:
        return False
    expected = create_token()
    return hmac.compare_digest(token, expected)


def require_auth(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="認証が必要です")
    token = authorization[7:].strip()
    if not verify_token_value(token):
        raise HTTPException(status_code=401, detail="認証が無効です")
    return token


class LoginRequest(BaseModel):
    password: str


class TranscribeRequest(BaseModel):
    url: str


@app.post("/login")
async def login(req: LoginRequest):
    if req.password != APP_PASSWORD:
        raise HTTPException(status_code=401, detail="パスワードが違います")
    return {"token": create_token()}


@app.post("/verify")
async def verify(_: str = Depends(require_auth)):
    return {"valid": True}


@app.post("/transcribe")
async def transcribe(req: TranscribeRequest, _: str = Depends(require_auth)):
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
            {"start": s["start"], "end": s["end"], "text": s["text"]}
            for s in (transcription.segments or [])
        ],
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve frontend static files
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
