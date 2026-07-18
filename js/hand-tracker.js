const MEDIAPIPE_MODULE_URL = new URL(
  "../node_modules/@mediapipe/tasks-vision/vision_bundle.mjs",
  import.meta.url,
).href;
const MEDIAPIPE_WASM_URL = new URL(
  "../node_modules/@mediapipe/tasks-vision/wasm",
  import.meta.url,
).href;
const HAND_LANDMARKER_MODEL_URL = new URL(
  "../assets/models/hand_landmarker.task",
  import.meta.url,
).href;

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
  }

  /** 카메라와 손 랜드마크 인식을 시작한다. */
  async start() {
    if (this.running) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("이 브라우저는 카메라 접근을 지원하지 않습니다.");
    }

    this.onStatus("카메라 권한을 요청하는 중입니다.", "loading");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });

    try {
      this.video.srcObject = stream;
      await this.video.play();
      this.onStatus("MediaPipe 손 인식 모델을 불러오는 중입니다.", "loading");
      const { FilesetResolver, HandLandmarker } = await import(MEDIAPIPE_MODULE_URL);
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL);
      const options = {
        baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      };
      try {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, options);
      } catch {
        this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { modelAssetPath: HAND_LANDMARKER_MODEL_URL },
        });
      }

      this.running = true;
      this.onStatus("MediaPipe 연결 완료 · 양손을 카메라에 보여 주세요.", "ready");
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

    if (this.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
      && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      try {
        const result = this.handLandmarker.detectForVideo(this.video, performance.now());
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
  }
}
