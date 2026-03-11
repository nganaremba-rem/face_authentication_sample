import * as faceapi from "face-api.js";

const video = document.getElementById("video");
const canvas = document.getElementById("overlay");
const result = document.getElementById("result");

// ─── Tab Switch ───────────────────────────────────────────
window.switchTab = (tab) => {
  document
    .querySelectorAll(".tab")
    .forEach((t) => t.classList.remove("active"));
  document
    .querySelectorAll(".panel")
    .forEach((p) => p.classList.remove("active"));
  document.getElementById(tab + "Panel").classList.add("active");
  document
    .querySelectorAll(".tab")
    [tab === "register" ? 0 : 1].classList.add("active");
};

// ─── Models ───────────────────────────────────────────────
async function loadModels() {
  const MODEL_URL = "/weights";
  await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
  await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
  await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
}

// ─── Camera ───────────────────────────────────────────────
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await new Promise((resolve) => (video.onloadeddata = resolve));
    video.style.width = video.videoWidth + "px";
    video.style.height = video.videoHeight + "px";
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.style.width = video.videoWidth + "px";
    canvas.style.height = video.videoHeight + "px";
    detectLoop();
  } catch (err) {
    result.innerText = "Camera error: " + err.message;
  }
}

// ─── Detection Loop ───────────────────────────────────────
async function detectLoop() {
  const displaySize = { width: video.videoWidth, height: video.videoHeight };
  faceapi.matchDimensions(canvas, displaySize);
  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();
    const resized = faceapi.resizeResults(detections, displaySize);
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    faceapi.draw.drawDetections(canvas, resized);
    faceapi.draw.drawFaceLandmarks(canvas, resized);
  }, 100);
}

// ─── Frame Capture ────────────────────────────────────────
function captureFrame() {
  const c = document.createElement("canvas");
  c.width = 320; // reduced resolution
  c.height = 240;
  c.getContext("2d").drawImage(video, 0, 0, 320, 240);
  return c.toDataURL("image/jpeg", 0.4); // lower quality
}

async function captureFrames(count = 20, intervalMs = 150) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push(captureFrame());
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return frames;
}

// ─── Frontend Blink Hint ──────────────────────────────────
function getEAR(eye) {
  const v1 = Math.abs(eye[1].y - eye[5].y);
  const v2 = Math.abs(eye[2].y - eye[4].y);
  const h = Math.abs(eye[0].x - eye[3].x);
  return (v1 + v2) / (2.0 * h);
}

function waitForBlink() {
  return new Promise((resolve) => {
    let eyesWereClosed = false;
    const interval = setInterval(async () => {
      const detection = await faceapi
        .detectSingleFace(video)
        .withFaceLandmarks();
      if (!detection) return;
      const lm = detection.landmarks;
      const avgEAR = (getEAR(lm.getLeftEye()) + getEAR(lm.getRightEye())) / 2;
      if (avgEAR < 0.25) {
        eyesWereClosed = true;
      } else if (eyesWereClosed) {
        clearInterval(interval);
        resolve();
      }
    }, 80);
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 10000);
  });
}

// ─── Liveness Flow ────────────────────────────────────────
async function performLiveness() {
  const challengeRes = await fetch("/api/challenge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const { token, direction } = await challengeRes.json();

  result.innerText = "Liveness: Please blink once...";
  await waitForBlink();

  result.innerText = `Liveness: Now turn your head ${direction === "left" ? "right" : "left"}...`;
  await new Promise((r) => setTimeout(r, 300));

  result.innerText = `Capturing frames... keep turning ${direction === "left" ? "right" : "left"}`;
  const frames = await captureFrames(20, 150);

  result.innerText = "Verifying on server...";
  const verifyRes = await fetch("/api/verify-liveness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, frames }),
  });
  const data = await verifyRes.json();

  if (!data.success) {
    setResult(data.message, false);
    return null;
  }

  setResult("Liveness confirmed! ✓", true);
  return token;
}

// ─── Embedding ────────────────────────────────────────────
async function getEmbedding() {
  const detection = await faceapi
    .detectSingleFace(video)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) {
    alert("No face detected");
    return null;
  }
  return Array.from(detection.descriptor);
}

// ─── Register ─────────────────────────────────────────────
window.register = async () => {
  const user = document.getElementById("regUser").value.trim();
  const password = document.getElementById("regPass").value.trim();
  if (!user || !password)
    return setResult("Enter username and password", false);

  setButtons(true);
  const token = await performLiveness();
  if (!token) {
    setButtons(false);
    return;
  }

  const embedding = await getEmbedding();
  if (!embedding) {
    setButtons(false);
    return;
  }

  const res = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, user, password, embedding }),
  });
  const data = await res.json();
  setResult(data.message, data.success);
  setButtons(false);
};

// ─── Login with Face ──────────────────────────────────────
window.loginWithFace = async () => {
  setButtons(true);
  const token = await performLiveness();
  if (!token) {
    setButtons(false);
    return;
  }

  const embedding = await getEmbedding();
  if (!embedding) {
    setButtons(false);
    return;
  }

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, embedding }),
  });
  const data = await res.json();
  setResult(data.message, data.success);
  setButtons(false);
};

// ─── Login with Password ──────────────────────────────────
window.loginWithPassword = async () => {
  const user = document.getElementById("loginUser").value.trim();
  const password = document.getElementById("loginPass").value.trim();
  if (!user || !password)
    return setResult("Enter username and password", false);

  setButtons(true);
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, password }),
  });
  const data = await res.json();
  setResult(data.message, data.success);
  setButtons(false);
};

// ─── Helpers ──────────────────────────────────────────────
function setResult(msg, success) {
  result.innerText = msg;
  result.style.color = success ? "#aaffaa" : "#ffaaaa";
}

function setButtons(disabled) {
  document.querySelectorAll("button").forEach((b) => (b.disabled = disabled));
}

// ─── Init ─────────────────────────────────────────────────
async function init() {
  result.innerText = "Loading models...";
  await loadModels();
  await startCamera();
  result.innerText = "Ready";
}

init();
