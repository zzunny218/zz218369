/** 새 룬 궤적 상태를 만든다. 한 번의 좌클릭 드래그가 한 획이다. */
export function createRuneTrace() {
  return { strokes: [], sparks: [], activeStrokeIndex: null };
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function addWeldingSparks(trace, point, count = 4) {
  const createdAt = nowMs();
  for (let index = 0; index < count; index += 1) {
    trace.sparks.push({
      x: point.x,
      y: point.y,
      velocityX: (Math.random() - 0.5) * 0.00055,
      velocityY: -0.00015 - Math.random() * 0.0005,
      createdAt,
      lifetimeMs: 180 + Math.random() * 260,
      size: 1.5 + Math.random() * 3,
    });
  }
}

/** 화면 좌표를 해상도와 무관한 0~1 룬 좌표로 변환한다. */
export function normalizeRunePoint(clientX, clientY, rectangle) {
  return {
    x: Math.min(Math.max((clientX - rectangle.left) / rectangle.width, 0), 1),
    y: Math.min(Math.max((clientY - rectangle.top) / rectangle.height, 0), 1),
  };
}

export function beginRuneStroke(trace, point) {
  trace.strokes.push([point]);
  trace.activeStrokeIndex = trace.strokes.length - 1;
  addWeldingSparks(trace, point, 7);
}

export function appendRunePoint(trace, point) {
  if (trace.activeStrokeIndex === null) {
    return false;
  }
  trace.strokes[trace.activeStrokeIndex].push(point);
  addWeldingSparks(trace, point);
  return true;
}

export function endRuneStroke(trace) {
  trace.activeStrokeIndex = null;
}

export function clearRuneTrace(trace) {
  trace.strokes.length = 0;
  trace.sparks.length = 0;
  trace.activeStrokeIndex = null;
}

export function countRunePoints(trace) {
  return trace.strokes.reduce((total, stroke) => total + stroke.length, 0);
}

/** 발광 주황색 룬 선과 펜 끝에서 튀는 용접 불꽃을 함께 그린다. */
export function drawRuneTrace(canvas, trace) {
  const rectangle = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(rectangle.width * pixelRatio));
  const height = Math.max(1, Math.floor(rectangle.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(5, width * 0.0045);
  context.strokeStyle = "#ff9a2f";
  context.shadowColor = "#ff5a00";
  context.shadowBlur = Math.max(12, width * 0.012);

  for (const stroke of trace.strokes) {
    if (stroke.length === 0) continue;
    context.beginPath();
    context.moveTo(stroke[0].x * width, stroke[0].y * height);
    for (const point of stroke.slice(1)) {
      context.lineTo(point.x * width, point.y * height);
    }
    context.stroke();
  }

  const currentTime = nowMs();
  trace.sparks = trace.sparks.filter((spark) => currentTime - spark.createdAt < spark.lifetimeMs);
  context.globalCompositeOperation = "lighter";
  for (const spark of trace.sparks) {
    const age = currentTime - spark.createdAt;
    const progress = age / spark.lifetimeMs;
    const x = (spark.x + spark.velocityX * age) * width;
    const y = (spark.y + spark.velocityY * age + 0.00000022 * age ** 2) * height;
    context.globalAlpha = 1 - progress;
    context.fillStyle = progress < 0.45 ? "#fff6b0" : "#ff7a1a";
    context.shadowColor = "#ff5a00";
    context.shadowBlur = spark.size * 3;
    context.fillRect(x, y, spark.size, spark.size);
  }
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
}
