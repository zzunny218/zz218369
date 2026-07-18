const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15],
  [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

/** 정규화된 랜드마크 좌표를 캔버스 좌표로 변환한다. */
export function toCanvasPoint(landmark, width, height) {
  return { x: landmark.x * width, y: landmark.y * height };
}

/** 웹캠 프레임 위에 손 뼈대와 검지 끝을 그린다. */
export function drawHandLandmarks(canvas, video, landmarkGroups) {
  const width = video.videoWidth;
  const height = video.videoHeight;

  if (!width || !height) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, width, height);
  context.lineWidth = Math.max(2, width * 0.004);
  context.strokeStyle = "#75e6da";
  context.fillStyle = "#fff2a6";

  landmarkGroups.forEach((landmarks) => {
    HAND_CONNECTIONS.forEach(([startIndex, endIndex]) => {
      const start = toCanvasPoint(landmarks[startIndex], width, height);
      const end = toCanvasPoint(landmarks[endIndex], width, height);
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();
    });

    const indexFingerTip = toCanvasPoint(landmarks[8], width, height);
    context.beginPath();
    context.arc(indexFingerTip.x, indexFingerTip.y, width * 0.018, 0, Math.PI * 2);
    context.fill();
  });
}

/** 현재 인식된 손을 사용자 화면에 읽기 쉬운 문구로 변환한다. */
export function describeDetectedHands(result) {
  const handedness = result.handedness ?? [];

  if (handedness.length === 0) {
    return ["인식된 손이 없습니다."];
  }

  return handedness.map((categories, index) => {
    const category = categories[0];
    const label = category?.displayName || category?.categoryName || "알 수 없는 손";
    const confidence = category?.score ? Math.round(category.score * 100) : 0;
    return `${index + 1}번째 손: ${label} (${confidence}%)`;
  });
}
