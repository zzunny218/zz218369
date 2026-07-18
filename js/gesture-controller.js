import { classifyHands } from "./hand-gesture-classifier.js";
import { GestureMode, createGestureState, transitionGestureState } from "./gesture-engine.js";

/** 연속 프레임의 손 모양을 시간 기준 입력으로 바꾼다. */
export class GestureController {
  constructor({ drawingHand = "right", modeHand = "left" } = {}) {
    this.state = createGestureState();
    this.holdStarts = new Map();
    this.handRoles = { drawingHand, modeHand };
  }

  /** 설정 화면에서 양손 역할을 서로 바꿀 때 사용한다. */
  setHandRoles({ drawingHand, modeHand }) {
    if (drawingHand === modeHand) {
      throw new Error("그리기 손과 모드 손은 서로 달라야 합니다.");
    }

    this.handRoles = { drawingHand, modeHand };
  }

  /** MediaPipe 손 인식 결과를 현재 게임 입력 상태로 변환한다. */
  updateFromHandResult(result, timestamp, interactions = {}) {
    const hands = classifyHands(result);
    const drawingHand = hands[this.handRoles.drawingHand];
    const modeHand = hands[this.handRoles.modeHand];
    return this.updateFromObservations({
      leftHandClosed: modeHand?.isFist ?? false,
      leftPalmInMoveZone: interactions.modeHandInMoveZone ?? false,
      moveVector: interactions.moveVector ?? { x: 0, y: 0 },
      cameraTurn: interactions.cameraTurn ?? 0,
      rightFist: drawingHand?.isFist ?? false,
      rightPalmOpen: drawingHand?.isPalmOpen ?? false,
      rightThumbMiddlePinched: drawingHand?.isThumbMiddlePinched ?? false,
      uiHover: interactions.uiHover ?? false,
      uiItemId: interactions.uiItemId ?? null,
    }, timestamp);
  }

  /** 테스트 및 이후 UI 영역 판정에 사용할 제스처 관측값을 반영한다. */
  updateFromObservations(observations, timestamp) {
    const input = {
      leftHandClosed: observations.leftHandClosed,
      leftPalmInMoveZoneHeldMs: this.#heldFor("left-palm-move", observations.leftPalmInMoveZone, timestamp),
      moveVector: observations.moveVector,
      cameraTurn: observations.cameraTurn,
      rightFistHeldMs: this.#heldFor("right-fist", observations.rightFist, timestamp),
      rightPalmOpenHeldMs: this.#heldFor("right-palm-open", observations.rightPalmOpen, timestamp),
      rightThumbMiddlePinched: observations.rightThumbMiddlePinched,
      uiHoverHeldMs: this.#heldFor("ui-hover", observations.uiHover, timestamp),
      uiItemId: observations.uiItemId,
    };

    this.state = transitionGestureState(this.state, input);
    return this.state;
  }

  #heldFor(name, isActive, timestamp) {
    if (!isActive) {
      this.holdStarts.delete(name);
      return 0;
    }

    if (!this.holdStarts.has(name)) {
      this.holdStarts.set(name, timestamp);
    }

    return timestamp - this.holdStarts.get(name);
  }
}

/** 현재 상태를 HUD에 보여 줄 한국어 문구로 바꾼다. */
export function describeGestureState(state) {
  const modeLabel = {
    [GestureMode.EXPLORING]: "탐험",
    [GestureMode.RUNE_READY]: "룬 준비",
    [GestureMode.DRAWING]: "그리기",
  }[state.mode];
  const castLabel = state.castType === "attack" ? "공격" : state.castType === "defense" ? "방어" : "없음";

  const selectedLabel = state.selectedUiItemId ? ` · 선택: ${state.selectedUiItemId}` : "";
  return `입력 상태: ${modeLabel} · 시전: ${castLabel}${selectedLabel}`;
}
