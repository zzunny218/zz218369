const HAND_SIDES = Object.freeze(["left", "right"]);

/** 한두 프레임 손이 누락되어도 마지막 랜드마크를 잠시 유지한다. */
export class HandLandmarkStabilizer {
  constructor({ graceMs = 420 } = {}) {
    this.graceMs = graceMs;
    this.landmarks = { left: null, right: null };
    this.lastSeenAt = { left: Number.NEGATIVE_INFINITY, right: Number.NEGATIVE_INFINITY };
  }

  update(detectedHands = {}, timestamp = 0) {
    const stableHands = { left: null, right: null };
    for (const side of HAND_SIDES) {
      if (detectedHands[side]) {
        this.landmarks[side] = detectedHands[side];
        this.lastSeenAt[side] = timestamp;
      }
      if (timestamp - this.lastSeenAt[side] <= this.graceMs) {
        stableHands[side] = this.landmarks[side];
      } else {
        this.landmarks[side] = null;
      }
    }
    return stableHands;
  }

  reset() {
    this.landmarks = { left: null, right: null };
    this.lastSeenAt = { left: Number.NEGATIVE_INFINITY, right: Number.NEGATIVE_INFINITY };
  }
}
