function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * 느린 손 추적에서는 더 많이 따라가고, 정지 상태에서는 흔들림을 줄이는
 * 적응형 지수 필터다. 짧은 속도 예측으로 카메라 지연도 일부 상쇄한다.
 */
export class AdaptivePointSmoother {
  constructor({
    minimumAlpha = 0.28,
    maximumAlpha = 0.82,
    speedForMaximumAlpha = 1.35,
    predictionMs = 24,
  } = {}) {
    this.minimumAlpha = minimumAlpha;
    this.maximumAlpha = maximumAlpha;
    this.speedForMaximumAlpha = speedForMaximumAlpha;
    this.predictionMs = predictionMs;
    this.reset();
  }

  reset() {
    this.filteredPoint = null;
    this.lastRawPoint = null;
    this.velocity = { x: 0, y: 0 };
    this.lastTimestamp = null;
  }

  update(point, timestamp) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
      return this.filteredPoint ? { ...this.filteredPoint } : null;
    }

    if (!this.filteredPoint || !Number.isFinite(this.lastTimestamp)) {
      this.filteredPoint = { x: point.x, y: point.y };
      this.lastRawPoint = { x: point.x, y: point.y };
      this.lastTimestamp = timestamp;
      return { ...this.filteredPoint };
    }

    const deltaSeconds = clamp((timestamp - this.lastTimestamp) / 1000, 1 / 240, 0.12);
    const rawVelocity = {
      x: (point.x - this.lastRawPoint.x) / deltaSeconds,
      y: (point.y - this.lastRawPoint.y) / deltaSeconds,
    };
    const speed = Math.hypot(rawVelocity.x, rawVelocity.y);
    const speedRatio = clamp(speed / this.speedForMaximumAlpha, 0, 1);
    const alpha = this.minimumAlpha
      + (this.maximumAlpha - this.minimumAlpha) * speedRatio;

    this.velocity = {
      x: this.velocity.x * 0.58 + rawVelocity.x * 0.42,
      y: this.velocity.y * 0.58 + rawVelocity.y * 0.42,
    };
    this.filteredPoint = {
      x: this.filteredPoint.x + (point.x - this.filteredPoint.x) * alpha,
      y: this.filteredPoint.y + (point.y - this.filteredPoint.y) * alpha,
    };
    this.lastRawPoint = { x: point.x, y: point.y };
    this.lastTimestamp = timestamp;

    const predictionSeconds = this.predictionMs / 1000;
    return {
      x: clamp(this.filteredPoint.x + this.velocity.x * predictionSeconds, 0, 1),
      y: clamp(this.filteredPoint.y + this.velocity.y * predictionSeconds, 0, 1),
    };
  }
}

/** 추적 프레임 사이를 일정 간격의 점으로 채워 룬 선이 끊겨 보이지 않게 한다. */
export function interpolateTraceSegment(
  start,
  end,
  { maximumSpacing = 0.009, maximumPoints = 24 } = {},
) {
  if (!start || !end) return [];
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  if (distance === 0) return [{ ...end }];
  const steps = clamp(Math.ceil(distance / maximumSpacing), 1, maximumPoints);
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    return {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
    };
  });
}
