const LOCAL_MEDIAPIPE_MODULE_URL = new URL(
  "../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs",
  import.meta.url,
).href;
const LOCAL_MEDIAPIPE_WASM_URL = new URL(
  "../node_modules/@mediapipe/tasks-vision/wasm",
  import.meta.url,
).href;
const HAND_LANDMARKER_MODEL_URL = new URL(
  "../assets/models/hand_landmarker.task",
  import.meta.url,
).href;
const REMOTE_HAND_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MEDIAPIPE_VERSION = "0.10.35";
const CDN_MEDIAPIPE_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const CDN_MEDIAPIPE_MODULE_URL = `${CDN_MEDIAPIPE_ROOT}/vision_bundle.mjs`;
const CDN_MEDIAPIPE_WASM_URL = `${CDN_MEDIAPIPE_ROOT}/wasm`;
const PREFERRED_CAMERA_LABELS = Object.freeze(["nv98-hd110s v2", "nv98-hd110s"]);
const INFERENCE_INTERVAL_MS = 1000 / 20;
const CAMERA_PROCESSING_WIDTH = 640;
const CAMERA_PROCESSING_HEIGHT = 360;

function isLocalDevelopmentHost() {
  const hostname = globalThis.location?.hostname ?? "";
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function getMediaPipeRuntimeSources() {
  return isLocalDevelopmentHost()
    ? [
        { moduleUrl: LOCAL_MEDIAPIPE_MODULE_URL, wasmUrl: LOCAL_MEDIAPIPE_WASM_URL, label: "로컬" },
        { moduleUrl: CDN_MEDIAPIPE_MODULE_URL, wasmUrl: CDN_MEDIAPIPE_WASM_URL, label: "CDN" },
      ]
    : [
        { moduleUrl: CDN_MEDIAPIPE_MODULE_URL, wasmUrl: CDN_MEDIAPIPE_WASM_URL, label: "CDN" },
        { moduleUrl: LOCAL_MEDIAPIPE_MODULE_URL, wasmUrl: LOCAL_MEDIAPIPE_WASM_URL, label: "로컬" },
      ];
}

async function loadMediaPipeRuntime(onStatus) {
  let lastError = null;
  for (const source of getMediaPipeRuntimeSources()) {
    try {
      onStatus(`MediaPipe ${source.label} 실행 파일을 불러오는 중입니다.`, "loading");
      const module = await import(source.moduleUrl);
      const vision = await module.FilesetResolver.forVisionTasks(source.wasmUrl);
      return { ...module, vision, sourceLabel: source.label };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `MediaPipe 실행 파일을 불러오지 못했습니다. 배포 파일 또는 네트워크 연결을 확인해 주세요. (${lastError instanceof Error ? lastError.message : String(lastError)})`,
  );
}

/** 공식 MediaPipe Hand Landmarker와 브라우저 카메라를 연결한다. */
export class HandTracker {
  constructor({ video, onFrame = () => {}, onStatus = () => {} }) {
    this.video = video;
    this.onFrame = onFrame;
    this.onStatus = onStatus;
    this.handLandmarker = null;
    this.lastVideoTime = -1;
    this.animationFrameId = null;
    this.running = false;
    this.lastInferenceTime = -Infinity;
    this.cameraLabel = "";
  }

  /** 카메라와 손 랜드마크 인식을 시작한다. */
  async start() {
    if (this.running) return;
    if (globalThis.isSecureContext === false) {
      throw new Error("카메라는 HTTPS 주소 또는 localhost에서만 사용할 수 있습니다.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저는 카메라 접근을 지원하지 않습니다.");
    }

    this.onStatus("카메라 권한을 요청하는 중입니다.", "loading");
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    let preferredCamera = devices.find((device) => (
      device.kind === "videoinput"
      && PREFERRED_CAMERA_LABELS.some((label) => device.label.toLowerCase().includes(label))
    ));
    let stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        ...(preferredCamera
          ? { deviceId: { exact: preferredCamera.deviceId } }
          : { facingMode: "user" }),
        width: { ideal: CAMERA_PROCESSING_WIDTH, max: CAMERA_PROCESSING_WIDTH },
        height: { ideal: CAMERA_PROCESSING_HEIGHT, max: CAMERA_PROCESSING_HEIGHT },
        frameRate: { ideal: 30, max: 30 },
      },
    });
    if (!preferredCamera) {
      const authorizedDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      preferredCamera = authorizedDevices.find((device) => (
        device.kind === "videoinput"
        && PREFERRED_CAMERA_LABELS.some((label) => device.label.toLowerCase().includes(label))
      ));
      const currentDeviceId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
      if (preferredCamera && preferredCamera.deviceId !== currentDeviceId) {
        stream.getTracks().forEach((track) => track.stop());
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            deviceId: { exact: preferredCamera.deviceId },
            width: { ideal: CAMERA_PROCESSING_WIDTH, max: CAMERA_PROCESSING_WIDTH },
            height: { ideal: CAMERA_PROCESSING_HEIGHT, max: CAMERA_PROCESSING_HEIGHT },
            frameRate: { ideal: 30, max: 30 },
          },
        });
      }
    }

    try {
      this.video.srcObject = stream;
      await this.video.play();
      this.cameraLabel = stream.getVideoTracks()[0]?.label ?? "";
      this.onStatus("MediaPipe 손 인식 모델을 불러오는 중입니다.", "loading");
      const { HandLandmarker, vision, sourceLabel } = await loadMediaPipeRuntime(this.onStatus);
      const options = {
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.35,
        minHandPresenceConfidence: 0.35,
        minTrackingConfidence: 0.4,
      };
      let modelError = null;
      const modelUrls = [HAND_LANDMARKER_MODEL_URL, REMOTE_HAND_LANDMARKER_MODEL_URL];
      for (const modelAssetPath of modelUrls) {
        for (const delegate of ["GPU", null]) {
          try {
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
              ...options,
              baseOptions: {
                modelAssetPath,
                ...(delegate ? { delegate } : {}),
              },
            });
            break;
          } catch (error) {
            modelError = error;
          }
        }
        if (this.handLandmarker) break;
      }
      if (!this.handLandmarker) throw modelError ?? new Error("손 인식 모델 초기화에 실패했습니다.");

      this.running = true;
      this.onStatus(
        `${this.cameraLabel || "카메라"} 연결 완료 · MediaPipe ${sourceLabel} · 양손을 카메라에 보여 주세요.`,
        "ready",
      );
      this.#processFrame();
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      this.video.srcObject = null;
      throw error;
    }
  }

  /** 현재 비디오 프레임을 분석하고 다음 프레임을 예약한다. */
  #processFrame = () => {
    if (!this.handLandmarker || !this.running) return;

    const timestamp = performance.now();
    if (document.visibilityState !== "hidden"
      && timestamp - this.lastInferenceTime >= INFERENCE_INTERVAL_MS
      && this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      this.lastInferenceTime = timestamp;
      try {
        const result = this.handLandmarker.detectForVideo(this.video, timestamp);
        this.onFrame(result);
      } catch (error) {
        this.onStatus(`손 인식 오류: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    }

    this.animationFrameId = requestAnimationFrame(this.#processFrame);
  };

  /** 카메라와 MediaPipe 자원을 정리한다. */
  stop() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    const stream = this.video.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    this.handLandmarker?.close();
    this.handLandmarker = null;
    this.video.srcObject = null;
    this.running = false;
    this.lastVideoTime = -1;
    this.lastInferenceTime = -Infinity;
    this.cameraLabel = "";
  }
}
