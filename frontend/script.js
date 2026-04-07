// Use same-origin when served from localhost or the FastAPI backend itself,
// otherwise fall back to the deployed Render backend.
const API_URL = (location.hostname === "localhost" || location.hostname === "127.0.0.1")
    ? ""  // same-origin: requests go to the local FastAPI server
    : "https://instagram-reel-transcriber-ezcp.onrender.com";

const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const loginForm = document.getElementById("login-form");
const passwordInput = document.getElementById("password-input");
const loginError = document.getElementById("login-error");

const form = document.getElementById("transcribe-form");
const urlInput = document.getElementById("url-input");
const submitBtn = document.getElementById("submit-btn");
const btnText = submitBtn.querySelector(".btn-text");
const btnLoading = submitBtn.querySelector(".btn-loading");
const errorMsg = document.getElementById("error-msg");
const progressDiv = document.getElementById("progress");
const progressStage = document.getElementById("progress-stage");
const progressElapsed = document.getElementById("progress-elapsed");
const progressBarFill = document.getElementById("progress-bar-fill");
const stepEls = [
    document.getElementById("step-1"),
    document.getElementById("step-2"),
    document.getElementById("step-3"),
];
const resultDiv = document.getElementById("result");
const transcriptText = document.getElementById("transcript-text");
const segmentsList = document.getElementById("segments-list");
const copyBtn = document.getElementById("copy-btn");

function showApp() {
    loginScreen.hidden = true;
    appScreen.hidden = false;
}

function showLogin() {
    loginScreen.hidden = false;
    appScreen.hidden = true;
}

function getToken() {
    return localStorage.getItem("auth_token");
}

function clearTokenAndShowLogin() {
    localStorage.removeItem("auth_token");
    showLogin();
}

// Check cached token on load
async function checkToken() {
    const token = getToken();
    if (!token) return showLogin();

    try {
        const res = await fetch(`${API_URL}/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        });
        if (res.ok) {
            showApp();
        } else {
            clearTokenAndShowLogin();
        }
    } catch {
        showApp(); // Offline fallback: trust cached token
    }
}

checkToken();

// Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.hidden = true;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: passwordInput.value }),
        });

        const data = await res.json();

        if (!res.ok) {
            loginError.textContent = data.detail || "ログインに失敗しました";
            loginError.hidden = false;
            return;
        }

        localStorage.setItem("auth_token", data.token);
        showApp();
    } catch {
        loginError.textContent = "サーバーに接続できません";
        loginError.hidden = false;
    }
});

// Transcribe
function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

function setLoading(loading) {
    submitBtn.disabled = loading;
    btnText.hidden = loading;
    btnLoading.hidden = !loading;
    urlInput.disabled = loading;
}

// Progress UI control
let progressTimer = null;
let progressStartTime = 0;

const STAGES = [
    { at: 0,  stage: "サーバーに接続中...",     stepIdx: 0 },
    { at: 3,  stage: "音声をダウンロード中...", stepIdx: 0 },
    { at: 10, stage: "文字起こし中...",         stepIdx: 1 },
    { at: 30, stage: "もう少しで完了します...", stepIdx: 1 },
    { at: 60, stage: "処理に時間がかかっています。お待ちください...", stepIdx: 1 },
];
const ESTIMATED_SECONDS = 25;

function updateStepUI(currentStepIdx) {
    stepEls.forEach((el, i) => {
        el.classList.remove("active", "done");
        if (i < currentStepIdx) el.classList.add("done");
        else if (i === currentStepIdx) el.classList.add("active");
    });
}

function startProgress() {
    progressStartTime = Date.now();
    progressDiv.hidden = false;
    progressBarFill.style.width = "0%";
    progressStage.textContent = STAGES[0].stage;
    progressElapsed.textContent = "0秒";
    updateStepUI(0);

    progressTimer = setInterval(() => {
        const elapsed = (Date.now() - progressStartTime) / 1000;
        progressElapsed.textContent = `${Math.floor(elapsed)}秒`;

        // Determine current stage
        let current = STAGES[0];
        for (const s of STAGES) {
            if (elapsed >= s.at) current = s;
        }
        progressStage.textContent = current.stage;
        updateStepUI(current.stepIdx);

        // Progress bar: ease toward 90%, then crawl
        let pct;
        if (elapsed < ESTIMATED_SECONDS) {
            pct = (elapsed / ESTIMATED_SECONDS) * 90;
        } else {
            // Crawl from 90% to 98% slowly
            const overflow = elapsed - ESTIMATED_SECONDS;
            pct = 90 + Math.min(8, overflow * 0.2);
        }
        progressBarFill.style.width = `${pct}%`;
    }, 250);
}

function finishProgress(success) {
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
    if (success) {
        progressBarFill.style.width = "100%";
        progressStage.textContent = "完了しました";
        updateStepUI(3); // all done
        setTimeout(() => { progressDiv.hidden = true; }, 600);
    } else {
        progressDiv.hidden = true;
    }
}

function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = false;
    resultDiv.hidden = true;
}

function hideError() {
    errorMsg.hidden = true;
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();
    resultDiv.hidden = true;
    setLoading(true);
    startProgress();

    const url = urlInput.value.trim();
    let succeeded = false;

    try {
        const token = getToken();
        const res = await fetch(`${API_URL}/transcribe`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ url }),
        });

        let data = null;
        try {
            data = await res.json();
        } catch {
            // Non-JSON response
        }

        if (!res.ok) {
            const detail = (data && data.detail) || "";
            if (res.status === 401) {
                showError("認証の有効期限が切れました。再度ログインしてください。");
                setTimeout(clearTokenAndShowLogin, 1500);
                return;
            }
            if (res.status === 504 || res.status === 502) {
                showError("サーバーの応答がタイムアウトしました。動画が長すぎるか、サーバーが混雑している可能性があります。少し待ってから再度お試しください。");
            } else if (res.status === 400) {
                showError(detail || "URLが正しくないか、非公開のリールの可能性があります。公開リールのURLをご確認ください。");
            } else {
                showError(detail || `エラーが発生しました (${res.status})`);
            }
            return;
        }

        transcriptText.textContent = data.text;

        segmentsList.innerHTML = "";
        if (data.segments && data.segments.length > 0) {
            data.segments.forEach((seg) => {
                const div = document.createElement("div");
                div.className = "segment";
                div.innerHTML = `
                    <span class="segment-time">${formatTime(seg.start)}</span>
                    <span>${seg.text}</span>
                `;
                segmentsList.appendChild(div);
            });
        }

        resultDiv.hidden = false;
        succeeded = true;
    } catch (err) {
        showError("サーバーに接続できません。ネットワーク接続を確認するか、しばらく待ってからもう一度お試しください。");
    } finally {
        finishProgress(succeeded);
        setLoading(false);
    }
});

// Logout
const logoutBtn = document.getElementById("logout-btn");
logoutBtn.addEventListener("click", () => {
    if (!confirm("ログアウトしますか？")) return;
    clearTokenAndShowLogin();
    // Reset UI state
    urlInput.value = "";
    resultDiv.hidden = true;
    hideError();
});

copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(transcriptText.textContent).then(() => {
        copyBtn.textContent = "コピーしました!";
        setTimeout(() => {
            copyBtn.textContent = "コピー";
        }, 2000);
    });
});
