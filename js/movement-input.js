export const MOVEMENT_DEAD_ZONE_RATIO = 0.44;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * 손바닥 중심과 도넛 중심의 거리로 이동 방향과 속도를 계산한다.
 * 가운데 빈 공간에서는 정지하고, 도넛 바깥에서는 최대속도를 유지한다.
 */
export function calculateRadialMovement(
  point,
  center,
  outerRadius,
  deadZoneRatio = MOVEMENT_DEAD_ZONE_RATIO,
) {
  if (!point || !center || !Number.isFinite(outerRadius) || outerRadius <= 0) {
    return { active: false, intensity: 0, vector: { x: 0, y: 0 } };
  }

  const deltaX = point.x - center.x;
  const deltaY = point.y - center.y;
  const distance = Math.hypot(deltaX, deltaY);
  const normalizedDistance = distance / outerRadius;

  if (distance === 0 || normalizedDistance <= deadZoneRatio) {
    return { active: false, intensity: 0, vector: { x: 0, y: 0 } };
  }

  const intensity = clamp(
    (normalizedDistance - deadZoneRatio) / (1 - deadZoneRatio),
    0,
    1,
  );

  return {
    active: true,
    intensity,
    vector: {
      x: (deltaX / distance) * intensity,
      y: (deltaY / distance) * intensity,
    },
  };
}
