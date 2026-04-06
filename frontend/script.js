const API_URL = "";

const form = document.getElementById("transcribe-form");
const urlInput = document.getElementById("url-input");
const submitBtn = document.getElementById("submit-btn");
const btnText = submitBtn.querySelector(".btn-text");
const btnLoading = submitBtn.querySelector(".btn-loading");
const errorMsg = document.getElementById("error-msg");
const resultDiv = document.getElementById("result");
const transcriptText = document.getElementById("transcript-text");
const segmentsList = document.getElementById("segments-list");
const copyBtn = document.getElementById("copy-btn");

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
    setLoading(true);

    const url = urlInput.value.trim();

    try {
        const res = await fetch(`${API_URL}/transcribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });

        const data = await res.json();

        if (!res.ok) {
            showError(data.detail || "エラーが発生しました");
            return;
        }

        // Show transcript
        transcriptText.textContent = data.text;

        // Show segments
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
    } catch (err) {
        showError("サーバーに接続できません。しばらく待ってからもう一度お試しください。");
    } finally {
        setLoading(false);
    }
});

copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(transcriptText.textContent).then(() => {
        copyBtn.textContent = "コピーしました!";
        setTimeout(() => {
            copyBtn.textContent = "コピー";
        }, 2000);
    });
});
