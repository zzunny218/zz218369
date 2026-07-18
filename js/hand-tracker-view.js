const HAND_CONNECTIONS = Object.freeze([
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [17, 0],
]);

/** MediaPipe가 반환한 손 랜드마크를 카메라 미리보기 위에 그린다. */
export function drawHandLandmarks(canvas, video, result) {
  const width = Math.max(1, video.videoWidth || 1280);
  const height = Math.max(1, video.videoHeight || 720);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return 0;
  context.clearRect(0, 0, width, height);
  const hands = Array.isArray(result?.landmarks) ? result.landmarks : [];

  hands.forEach((landmarks, handIndex) => {
    const color = handIndex === 0 ? "#7ff5cb" : "#ffd36d";
    context.lineWidth = Math.max(2, width * 0.0032);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = color;
    context.shadowColor = color;
    context.shadowBlur = Math.max(4, width * 0.006);
    HAND_CONNECTIONS.forEach(([startIndex, endIndex]) => {
      const start = landmarks[startIndex];
      const end = landmarks[endIndex];
      if (!start || !end) return;
      context.beginPath();
      context.moveTo(start.x * width, start.y * height);
      context.lineTo(end.x * width, end.y * height);
      context.stroke();
    });
    context.fillStyle = "#ffffff";
    landmarks.forEach((landmark) => {
      context.beginPath();
      context.arc(landmark.x * width, landmark.y * height, Math.max(3, width * 0.004), 0, Math.PI * 2);
      context.fill();
    });
  });
  context.shadowBlur = 0;
  return hands.length;
}

export function clearHandLandmarks(canvas) {
  const context = canvas.getContext("2d");
  context?.clearRect(0, 0, canvas.width, canvas.height);
}
