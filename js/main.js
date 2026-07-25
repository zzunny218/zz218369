import { createSeededRandom, generateBossDungeon, generateDungeon } from "./dungeon-generator.js";
import {
  calculateSpatialVolume,
  getAudioVolumes,
  playAudioCue,
  playFadingAudioCue,
  playMagicAudio,
  playRandomFootstep,
  playSpatialCue,
  primeAudioSystem,
  setAudioVolume,
  startBackgroundMusic,
  stopAudioCue,
  stopBackgroundMusic,
} from "./audio-system.js";
import {
  calculateRuneDamage,
  clearCombatState,
  createCombatState,
  drainCombatSoundEvents,
  getEnemyTimeScaleForInputMode,
  isBossPhaseTwo,
  spawnPlayerMagic,
  spawnPlayerUltimate,
  updateCombatState,
} from "./combat-system.js";
import {
  calculateTargetYaw,
  findClosestLivingEnemy,
  getRuneTargetAimPoint,
  interpolateTargetYaw,
} from "./combat-targeting.js";
import {
  clearStageEndRoom,
  setDeveloperAttackPower,
} from "./developer-actions.js";
import { renderExplorationMap } from "./exploration-map-renderer.js";
import {
  ExplorationNodeType,
  createExplorationState,
  generateExplorationGraph,
  selectExplorationNode,
} from "./exploration-nodes.js";
import { GAME_ASSETS } from "./game-assets.js";
import { applyEventChoice, createEventChoices, createMissingSkillChoice } from "./event-choice-system.js";
import { GestureMode } from "./gesture-engine.js";
import {
  classifyHandGesture,
  getHandLandmarksBySide,
} from "./hand-gesture-classifier.js";
import { HandInputController } from "./hand-input.js";
import { HandLandmarkStabilizer } from "./hand-landmark-stabilizer.js";
import { HandTracker } from "./hand-tracker.js";
import { calculatePointerCameraTurn, createManualInputState } from "./manual-input.js";
import {
  createSpiritKingBoss,
  generateRoomMonsters,
  scaleMonsterForStage,
} from "./monster-catalog.js";
import {
  calculatePlayerAttackDamage,
  copyPlayerToProgress,
  copyProgressToPlayer,
  createPlayerProgress,
  hasEnoughManaToCast,
  hasManaRemaining,
  resetPlayerAfterDeath,
  shouldCancelRuneDrawing,
  startPlayerCastCooldown,
  updatePlayerCastCooldown,
  updatePlayerMana,
} from "./player-resources.js";
import { drawRoomScene } from "./room-renderer.js";
import {
  RUNE_CARDS,
  getRuneSvgPolylines,
  scoreRuneTrace,
} from "./rune-card-catalog.js";
import {
  addSecondSkillCardsToWarehouse,
  addThirdSkillCardsToWarehouse,
  createRuneCardPool,
  createRuneDeck,
  refreshRuneHand,
  rotateUsedRuneCard,
} from "./rune-deck.js";
import { createRestockedShopInventory, purchaseShopItem } from "./shop-system.js";
import { ULTIMATE_SKILL_NAME, getSkillName } from "./skill-catalog.js";
import {
  appendRunePoint,
  beginRuneStroke,
  clearRuneTrace,
  countRunePoints,
  createRuneTrace,
  drawRuneTrace,
  endRuneStroke,
  isScreenPointInsideRectangle,
  normalizeRunePoint,
} from "./rune-trace.js";
import {
  ROOM_HALF_SIZE,
  createGuideDialogues,
  createWorldSession,
  findEnteredStagePortal,
  respawnPlayer,
  rotateWorldCamera,
  saveCampfireSpawnPoint,
  updateWorldSession,
} from "./world-session.js";
import {
  LIGHT_ULTIMATE_RUNE_IDS,
  LIGHT_ULTIMATE_RUNE_STROKES,
  UltimatePhase,
  castUltimate,
  completeUltimateRune,
  createLightUltimateSequence,
} from "./ultimate-sequence.js";
import { applyVideoSettings, normalizeVideoSettings } from "./video-settings.js";
import { AdaptivePointSmoother, interpolateTraceSegment } from "./tracking-smoothing.js";

const APP_VERSION = "0.36.0";
const HAND_CONTROL_SCHEMA_VERSION = "left-fist-rune-v1";
const RUNE_CARD_DWELL_MS = 200;
const MINI_MAP_UPDATE_INTERVAL_MS = 160;
const HUD_UPDATE_INTERVAL_MS = 50;
const WORLD_RENDER_INTERVAL_MS = 1000 / 30;
const OPEN_GESTURE_GRACE_MS = 340;
const DRAWING_FIST_GRACE_MS = 240;
const CAST_FIST_HOLD_MS = 100;
const HELP_GUIDE_PAGES = Object.freeze([
  {
    image: new URL("../assets/images/help/help-01.png", import.meta.url).href,
    text: "게임을 시작하면 카메라에 양손이 모두 보이도록 자세를 잡아주세요. 기본 설정에서는 오른손으로 카드를 선택하고 마법을 발동하며, 왼손으로 룬 그리기를 제어합니다. 설정에서 ‘왼손·오른손 반전’을 선택하면 두 손의 역할이 서로 바뀝니다.",
  },
  {
    image: new URL("../assets/images/help/help-02.png", import.meta.url).href,
    text: "WASD 또는 방향키로 캐릭터를 이동할 수 있습니다. 좌클릭한 상태로 화면을 드래그하거나 Q·E를 사용하면 카메라를 회전할 수 있습니다. 메뉴와 일반 UI는 마우스로 클릭해 조작합니다.",
  },
  {
    image: new URL("../assets/images/help/help-03.png", import.meta.url).href,
    text: "양손을 0.2초 동안 활짝 펴면 룬 모드에 들어갑니다. 룬 모드가 시작되면 1인칭 시점으로 전환되고 모든 적이 멈춥니다. 카메라는 가장 가까운 적을 자동으로 바라보며, 조준된 적에게는 붉은 표적이 표시됩니다.",
  },
  {
    image: new URL("../assets/images/help/help-04.png", import.meta.url).href,
    text: "화면 아래의 카드를 마우스로 클릭하거나 오른손 검지로 0.2초 동안 가리키면 사용할 마법을 선택할 수 있습니다. 선택한 카드는 다른 카드로 자유롭게 변경할 수 있습니다. 새로고침은 마법을 세 번 사용한 뒤 다시 사용할 수 있습니다.",
  },
  {
    image: new URL("../assets/images/help/help-05.png", import.meta.url).href,
    text: "왼손을 주먹 쥔 동안 오른손 검지가 움직인 자리에 룬이 그려집니다. 카드에 표시된 문양을 따라 그린 뒤 오른손을 주먹 쥐면 마법이 발동합니다. 룬을 그리지 않은 상태에서 종료하면 마법 실패로 처리되지 않습니다.",
  },
  {
    image: new URL("../assets/images/help/help-06.png", import.meta.url).href,
    text: "가이드와 비슷하게 그릴수록 마법이 강해지고, 빠르게 완성할수록 마나를 적게 사용합니다. 마나가 30 이하일 때는 새로운 마법을 준비할 수 없습니다. 이미 시작한 룬은 마나가 0이 될 때 취소되며, 마법 사용 후에는 1.5초의 사용 대기시간이 적용됩니다.",
  },
  {
    image: new URL("../assets/images/help/help-07.png", import.meta.url).href,
    text: "전투방에 들어간 뒤에는 몬스터를 모두 처치해야 문이 다시 열립니다. 몬스터는 골드와 회복 하트를 떨어뜨릴 수 있습니다. 사망하면 골드와 궁극기 게이지를 잃고 마지막 모닥불에서 부활하며, 해당 맵의 몬스터와 돌이 복구됩니다.",
  },
  {
    image: new URL("../assets/images/help/help-08.png", import.meta.url).href,
    text: "탐험은 총 6단계로 진행됩니다. 중간 단계에서는 전투, 선택지, 상점 노드 중 하나를 선택하며 지나온 단계로 돌아갈 수 없습니다. 전투 노드의 황금방을 클리어하면 상점과 다음 단계로 향하는 통로가 열립니다.",
  },
  {
    image: new URL("../assets/images/help/help-09.png", import.meta.url).href,
    text: "상점에서는 30G로 체력을 50 회복하거나 강화된 마법 카드를 구매할 수 있습니다. 2스킬은 50G이며, 해당 속성의 2스킬을 보유하면 3스킬이 75G로 등장할 수 있습니다. 선택지 노드에서는 두 가지 보상 중 하나를 선택합니다.",
  },
  {
    image: new URL("../assets/images/help/help-10.png", import.meta.url).href,
    text: "속성에 유리한 공격은 1.25배, 불리한 공격은 0.8배의 피해를 줍니다. 노말 속성은 상성의 영향을 받지 않습니다. 각 속성에는 1·2·3스킬이 있으며 상점이나 보상을 통해 상위 스킬을 획득할 수 있습니다.",
  },
  {
    image: new URL("../assets/images/help/help-11.png", import.meta.url).href,
    text: "적에게 피해를 주면 궁극기 게이지가 상승합니다. 게이지가 100이 되면 전용 카드가 나타나며, 세 개의 룬을 차례대로 완성해야 합니다. 발동 후 10초 동안 공격력이 1.5배가 되고 받는 피해가 80% 감소하며, 주변에 강력한 빛의 마법진이 생성됩니다.",
  },
  {
    image: new URL("../assets/images/help/help-12.png", import.meta.url).href,
    text: "마지막 단계에는 타락한 정령왕이 기다리고 있습니다. 보스는 속박, 기절, 밀쳐내기 효과에 면역이며 다양한 광역 마법과 소환 공격을 사용합니다. 체력이 낮아지면 숲을 어둠으로 뒤덮고 마나 소모량을 증가시키므로, 공격 범위를 확인하며 끝까지 집중해야 합니다.",
  },
]);
const BOSS_DIALOGUES = Object.freeze({
  appearance: "누가… 나의 잠을 깨우는가.",
  combatStart: "돌아가라. 이 숲은 이제 누구도 품지 않는다.",
  strongAttack: "뿌리도, 바람도, 모두 내 분노에 답하라!",
  heavyHit: "그 빛… 아직 꺼지지 않았단 말인가.",
  summon: "타락한 아이들아, 왕의 부름에 응답하라.",
  rampage: "아아… 숲이 울부짖는구나. 그렇다면 모두, 나와 함께 무너져라!",
});
const inputController = new HandInputController();
const manualInputState = createManualInputState();
const runeTrace = createRuneTrace();
let dungeon = null;
let worldSession = null;
let monstersByRoom = {};
let explorationGraph = null;
let explorationState = null;
let playerProgress = createPlayerProgress();
let activeShopInventory = [];
let shopReturnTarget = "exploration";
let currentStagePortalId = null;
let gameStarted = false;
let menuOpen = false;
let activeRuneCard = null;
let activeSkillTier = 1;
let runeDeck = createRuneDeck(createRuneCardPool(RUNE_CARDS));
let runeRefreshUsesRemaining = 0;
let renderRuneCards = () => {};
let combatState = createCombatState();
let runePointerId = null;
let npcConversationStarted = false;
let npcDialogueTimers = [];
let castNoticeTimer = null;
let lastSceneFrameTime = performance.now();
let miniMapUpdateAccumulatorMs = MINI_MAP_UPDATE_INTERVAL_MS;
let hudUpdateAccumulatorMs = HUD_UPDATE_INTERVAL_MS;
let worldRenderAccumulatorMs = WORLD_RENDER_INTERVAL_MS;
let lastRuneViewProgressCss = "";
let lastRuneTargetOpacityCss = "";
let playerFootstepTimerMs = 0;
let deathDecisionOpen = false;
let currentCombatStage = 1;
let currentCombatIsBoss = false;
let currentCombatNodeKey = "initial";
let combatNodeCount = 0;
let initialMonstersByRoom = {};
let initialRocksByRoom = {};
let shopInventoryByKey = new Map();
let offeredShopElements = new Set();
let offeredShopItemKeys = new Set();
let manaNoticeTimer = null;
let spawnPointNoticeTimer = null;
let runElapsedMs = 0;
let clearScreenOpen = false;
let developerConsoleWasGameStarted = false;
const developerChordKeys = new Set();
let ultimateSequence = null;
let completedUltimateRuneStrokes = [];
let ultimateCombining = false;
let ultimateCombineTimer = null;
let lastUltimateCardAvailable = false;
let ultimateDrawingAudio = null;
let ultimateBuffAudio = null;
let completedCombatRewardKeys = new Set();
let helpGuidePageIndex = 0;
let handTracker = null;
let lastDetectedHandCount = -1;
let playerHudElements = null;
let bossHudElements = null;
let handPointerElement = null;
const handCursorSmoother = new AdaptivePointSmoother({
  minimumAlpha: 0.3,
  maximumAlpha: 0.86,
  predictionMs: 26,
});
const handLandmarkStabilizer = new HandLandmarkStabilizer({ graceMs: 420 });
const handControlRuntime = {
  lastHandsSeenAt: performance.now(),
  drawingSide: "right",
  movementSide: "left",
  palmOpenSince: null,
  lastPalmOpenAt: { left: Number.NEGATIVE_INFINITY, right: Number.NEGATIVE_INFINITY },
  lastFistAt: { left: Number.NEGATIVE_INFINITY, right: Number.NEGATIVE_INFINITY },
  runeEntryLatched: false,
  fistLatched: false,
  castFistSince: null,
  lastRunePoint: null,
  cardDwellKey: null,
  cardDwellStartedAt: 0,
  cardDwellLatched: false,
};

function cloneGameData(value) {
  return JSON.parse(JSON.stringify(value));
}

function updateStatus(message) {
  const statusElement = document.querySelector("#app-status");
  if (statusElement) {
    statusElement.textContent = message;
  }
}

function setDocumentState(key, value) {
  const nextValue = String(value);
  if (document.documentElement.dataset[key] !== nextValue) {
    document.documentElement.dataset[key] = nextValue;
  }
}

function setHandTrackerStatus(message, state = "loading") {
  const status = document.querySelector("#hand-tracker-status");
  if (!(status instanceof HTMLElement)) return;
  status.textContent = message;
  status.dataset.state = state;
}

function setHandPointer(point = null, dwellProgress = 0, active = false) {
  const pointer = handPointerElement?.isConnected
    ? handPointerElement
    : document.querySelector("#hand-pointer");
  if (!(pointer instanceof HTMLElement)) return;
  handPointerElement = pointer;
  pointer.hidden = !point;
  if (!point) return;
  pointer.style.left = `${point.x}px`;
  pointer.style.top = `${point.y}px`;
  pointer.style.setProperty("--dwell-progress", `${Math.max(0, Math.min(1, dwellProgress)) * 360}deg`);
  pointer.classList.toggle("is-active", active);
}

function resetRuneCardDwell() {
  handControlRuntime.cardDwellKey = null;
  handControlRuntime.cardDwellStartedAt = 0;
  handControlRuntime.cardDwellLatched = false;
}

function getRuneCardAtPoint(point) {
  if (!point || typeof document.elementFromPoint !== "function") return null;
  const hit = document.elementFromPoint(point.x, point.y);
  const card = hit instanceof Element ? hit.closest(".rune-card") : null;
  return card instanceof HTMLButtonElement && !card.disabled ? card : null;
}

function updateRuneCardDwell(point, timestamp, canSelect) {
  const card = canSelect ? getRuneCardAtPoint(point) : null;
  if (!card) {
    resetRuneCardDwell();
    setHandPointer(point, 0, false);
    return false;
  }

  const dwellKey = card.dataset.runeDeckId ?? card.dataset.runeCardId ?? card.getAttribute("aria-label") ?? "";
  if (handControlRuntime.cardDwellKey !== dwellKey) {
    handControlRuntime.cardDwellKey = dwellKey;
    handControlRuntime.cardDwellStartedAt = timestamp;
    handControlRuntime.cardDwellLatched = false;
  }
  const dwellProgress = Math.min(1, Math.max(0, (timestamp - handControlRuntime.cardDwellStartedAt) / RUNE_CARD_DWELL_MS));
  setHandPointer(point, dwellProgress, true);
  if (dwellProgress >= 1 && !handControlRuntime.cardDwellLatched) {
    handControlRuntime.cardDwellLatched = true;
    card.click();
  }
  return true;
}

function resetHandControlRuntime({ preserveLastSeen = false } = {}) {
  handCursorSmoother.reset();
  handLandmarkStabilizer.reset();
  handControlRuntime.palmOpenSince = null;
  handControlRuntime.lastPalmOpenAt = {
    left: Number.NEGATIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
  };
  handControlRuntime.lastFistAt = {
    left: Number.NEGATIVE_INFINITY,
    right: Number.NEGATIVE_INFINITY,
  };
  handControlRuntime.runeEntryLatched = false;
  handControlRuntime.fistLatched = false;
  handControlRuntime.castFistSince = null;
  handControlRuntime.lastRunePoint = null;
  resetRuneCardDwell();
  if (!preserveLastSeen) handControlRuntime.lastHandsSeenAt = performance.now();
  inputController.setSceneMovement({ x: 0, y: 0 });
  setHandPointer();
}

function mirroredScreenPoint(landmark, smoother, timestamp) {
  if (!landmark) return null;
  const normalized = smoother.update({ x: 1 - landmark.x, y: landmark.y }, timestamp);
  if (!normalized) return null;
  return {
    x: normalized.x * window.innerWidth,
    y: normalized.y * window.innerHeight,
  };
}

function appendHandRunePoint(runeCanvas, screenPoint) {
  const runePoint = normalizeRunePoint(
    screenPoint.x,
    screenPoint.y,
    runeCanvas.getBoundingClientRect(),
  );
  if (runeTrace.activeStrokeIndex === null) {
    if (inputController.state.mode === GestureMode.RUNE_READY) {
      inputController.startDrawing();
      renderInputState();
    }
    beginRuneStroke(runeTrace, runePoint);
    handControlRuntime.lastRunePoint = runePoint;
    hideRuneResult();
    drawRuneTrace(runeCanvas, runeTrace);
    return;
  }
  const points = interpolateTraceSegment(handControlRuntime.lastRunePoint, runePoint);
  points.forEach((point, index) => appendRunePoint(
    runeTrace,
    point,
    { sparkCount: index === points.length - 1 ? 3 : 0 },
  ));
  handControlRuntime.lastRunePoint = runePoint;
  drawRuneTrace(runeCanvas, runeTrace);
}

function updateHandGameplay(result, timestamp, runeCanvas) {
  const hands = handLandmarkStabilizer.update(
    getHandLandmarksBySide(result),
    timestamp,
  );
  const stableHandCount = Number(Boolean(hands.left)) + Number(Boolean(hands.right));
  const reversed = inputController.state.handRolesReversed;
  const drawingSide = reversed ? "left" : "right";
  const movementSide = reversed ? "right" : "left";
  if (drawingSide !== handControlRuntime.drawingSide) {
    handControlRuntime.drawingSide = drawingSide;
    handControlRuntime.movementSide = movementSide;
    resetHandControlRuntime({ preserveLastSeen: true });
  }
  const drawingLandmarks = hands[drawingSide];
  const movementLandmarks = hands[movementSide];
  const drawingGesture = classifyHandGesture(drawingLandmarks);
  const movementGesture = classifyHandGesture(movementLandmarks);
  const cursor = mirroredScreenPoint(drawingLandmarks?.[8], handCursorSmoother, timestamp);

  if (!gameStarted || menuOpen || deathDecisionOpen || clearScreenOpen || worldSession?.bossCinematic?.active) {
    resetRuneCardDwell();
    setHandPointer(cursor, 0, false);
    return stableHandCount;
  }

  if (inputController.state.mode === GestureMode.EXPLORING) {
    resetRuneCardDwell();
    setHandPointer(cursor, 0, false);
    if (drawingGesture.isPalmOpen) handControlRuntime.lastPalmOpenAt[drawingSide] = timestamp;
    if (movementGesture.isPalmOpen) handControlRuntime.lastPalmOpenAt[movementSide] = timestamp;
    const bothHandsOpen = Boolean(
      drawingLandmarks
      && movementLandmarks
      && timestamp - handControlRuntime.lastPalmOpenAt[drawingSide] <= OPEN_GESTURE_GRACE_MS
      && timestamp - handControlRuntime.lastPalmOpenAt[movementSide] <= OPEN_GESTURE_GRACE_MS
    );
    if (bothHandsOpen) {
      handControlRuntime.palmOpenSince ??= timestamp;
      if (
        timestamp - handControlRuntime.palmOpenSince >= 180
        && !handControlRuntime.runeEntryLatched
      ) {
        handControlRuntime.runeEntryLatched = true;
        beginHandRuneMode("attack", runeCanvas);
      }
    } else {
      handControlRuntime.palmOpenSince = null;
      handControlRuntime.runeEntryLatched = false;
    }
    handControlRuntime.fistLatched = drawingGesture.isFist;
    handControlRuntime.castFistSince = null;
    return stableHandCount;
  }

  updateRuneCardDwell(cursor, timestamp, Boolean(drawingGesture.isIndexExtended));

  if (drawingGesture.isFist) {
    handControlRuntime.castFistSince ??= timestamp;
    if (
      timestamp - handControlRuntime.castFistSince >= CAST_FIST_HOLD_MS
      && !handControlRuntime.fistLatched
    ) {
      handControlRuntime.fistLatched = true;
      finishHandRuneCast(runeCanvas);
    }
    return stableHandCount;
  }
  handControlRuntime.castFistSince = null;
  handControlRuntime.fistLatched = false;

  if (movementGesture.isFist) handControlRuntime.lastFistAt[movementSide] = timestamp;
  const drawingTriggerActive = (
    timestamp - handControlRuntime.lastFistAt[movementSide] <= DRAWING_FIST_GRACE_MS
  );
  const shouldDraw = Boolean(
    cursor
    && activeRuneCard
    && drawingTriggerActive
    && isInsideRuneGuide(cursor),
  );
  if (shouldDraw) {
    appendHandRunePoint(runeCanvas, cursor);
  } else if (runeTrace.activeStrokeIndex !== null) {
    endRuneStroke(runeTrace);
    handControlRuntime.lastRunePoint = null;
    inputController.stopDrawing();
    drawRuneTrace(runeCanvas, runeTrace);
    renderInputState();
  }
  return stableHandCount;
}

function stopHandTracking() {
  handTracker?.stop();
  handTracker = null;
  lastDetectedHandCount = -1;
  resetHandControlRuntime();
  const placeholder = document.querySelector("#camera-placeholder");
  if (placeholder instanceof HTMLElement) {
    placeholder.hidden = false;
    placeholder.textContent = "게임 시작 후 카메라 권한을 허용하면 손 인식이 시작됩니다.";
  }
  setHandTrackerStatus("MediaPipe 준비 중", "loading");
}

async function startHandTracking() {
  const video = document.querySelector("#hand-camera");
  const runeCanvas = document.querySelector("#rune-canvas");
  const placeholder = document.querySelector("#camera-placeholder");
  if (
    !(video instanceof HTMLVideoElement)
    || !(runeCanvas instanceof HTMLCanvasElement)
  ) return;
  handTracker?.stop();
  lastDetectedHandCount = -1;
  resetHandControlRuntime();
  handTracker = new HandTracker({
    video,
    onStatus: (message, state) => {
      setHandTrackerStatus(message, state);
      if (placeholder instanceof HTMLElement && state === "ready") placeholder.hidden = true;
    },
    onFrame: (result) => {
      const rawHandCount = result.landmarks?.length ?? 0;
      if (placeholder instanceof HTMLElement) placeholder.hidden = true;
      const timestamp = performance.now();
      if (rawHandCount > 0) handControlRuntime.lastHandsSeenAt = timestamp;
      const handCount = updateHandGameplay(result, timestamp, runeCanvas);
      if (handCount === lastDetectedHandCount) return;
      lastDetectedHandCount = handCount;
      const cameraName = handTracker?.cameraLabel ? `${handTracker.cameraLabel} · ` : "";
      setHandTrackerStatus(
        handCount > 0
          ? `${cameraName}MediaPipe 연결됨 · 손 ${handCount}개 인식 중`
          : `${cameraName}MediaPipe 연결됨 · 손을 카메라에 보여 주세요.`,
        "ready",
      );
    },
  });
  try {
    await handTracker.start();
  } catch (error) {
    const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "PermissionDeniedError");
    const unavailable = error instanceof DOMException && (error.name === "NotReadableError" || error.name === "TrackStartError");
    const missing = error instanceof DOMException && error.name === "NotFoundError";
    setHandTrackerStatus(
      denied
        ? "카메라 권한이 거부되었습니다. Chrome 주소창의 카메라 권한을 허용해 주세요."
        : unavailable
          ? "카메라를 시작할 수 없습니다. 카메라를 사용 중인 다른 프로그램을 닫고 다시 시작해 주세요."
          : missing
            ? "사용 가능한 카메라를 찾지 못했습니다. 카메라 연결 상태를 확인해 주세요."
            : `손 인식 연결 실패: ${error instanceof Error ? error.message : String(error)}`,
      "error",
    );
    if (placeholder instanceof HTMLElement) {
      placeholder.hidden = false;
      placeholder.textContent = denied ? "카메라 권한이 필요합니다." : "MediaPipe를 연결하지 못했습니다.";
    }
  }
}

function renderHelpGuidePage() {
  const guide = document.querySelector("#help-guide");
  const image = document.querySelector("#help-guide-image");
  const text = document.querySelector("#help-guide-text");
  const pageOutput = document.querySelector("#help-guide-page");
  const previousButton = document.querySelector("#help-guide-previous");
  const nextButton = document.querySelector("#help-guide-next");
  const page = HELP_GUIDE_PAGES[helpGuidePageIndex];
  if (!page) return;
  if (guide instanceof HTMLElement) guide.dataset.text = String(Boolean(page.text));
  if (image instanceof HTMLImageElement) {
    image.hidden = false;
    image.alt = `게임 도움말 ${helpGuidePageIndex + 1}페이지`;
    image.onload = () => {
      image.hidden = false;
      if (guide instanceof HTMLElement) guide.dataset.image = "true";
    };
    image.onerror = () => {
      image.hidden = true;
      image.removeAttribute("src");
      image.alt = "";
      if (guide instanceof HTMLElement) guide.dataset.image = "false";
    };
    image.src = page.image;
  }
  if (text instanceof HTMLElement) {
    text.textContent = page.text;
    text.hidden = !page.text;
  }
  if (pageOutput) pageOutput.textContent = `${helpGuidePageIndex + 1}/${HELP_GUIDE_PAGES.length}`;
  if (previousButton instanceof HTMLButtonElement) previousButton.disabled = helpGuidePageIndex === 0;
  if (nextButton instanceof HTMLButtonElement) nextButton.disabled = helpGuidePageIndex === HELP_GUIDE_PAGES.length - 1;
}

function setHelpGuideOpen(shouldOpen) {
  const guide = document.querySelector("#help-guide");
  if (!(guide instanceof HTMLElement)) return;
  guide.hidden = !shouldOpen;
  if (shouldOpen) {
    helpGuidePageIndex = 0;
    renderHelpGuidePage();
    requestAnimationFrame(() => document.querySelector("#help-guide-close")?.focus());
  }
}

function showManaEmptyNotice() {
  const notice = document.querySelector("#mana-empty-notice");
  if (!(notice instanceof HTMLElement)) return;
  if (manaNoticeTimer) window.clearTimeout(manaNoticeTimer);
  notice.hidden = false;
  notice.classList.remove("is-visible");
  requestAnimationFrame(() => notice.classList.add("is-visible"));
  manaNoticeTimer = window.setTimeout(() => {
    notice.classList.remove("is-visible");
    notice.hidden = true;
  }, 1300);
}

function showSpawnPointNotice() {
  const notice = document.querySelector("#spawn-point-notice");
  if (!(notice instanceof HTMLElement)) return;
  if (spawnPointNoticeTimer) window.clearTimeout(spawnPointNoticeTimer);
  notice.hidden = false;
  notice.classList.remove("is-visible");
  requestAnimationFrame(() => notice.classList.add("is-visible"));
  spawnPointNoticeTimer = window.setTimeout(() => {
    notice.classList.remove("is-visible");
    window.setTimeout(() => { notice.hidden = true; }, 320);
  }, 1800);
}

function distanceFromPlayer(event) {
  if (!worldSession) return 0;
  return Math.hypot(
    (event.x ?? worldSession.player.x) - worldSession.player.x,
    (event.z ?? worldSession.player.z) - worldSession.player.z,
  );
}

function playPendingCombatSounds() {
  for (const event of drainCombatSoundEvents(combatState)) {
    const distance = distanceFromPlayer(event);
    if (event.type === "magic-cast") {
      playMagicAudio(event.element, {
        enemy: true,
        distance,
        playElement: event.element !== "rock",
      });
    } else if (event.type === "rock-impact") {
      const impactCue = event.element === "dark" ? "dark" : "rock";
      if (event.owner === "enemy") playSpatialCue(impactCue, { distance, baseVolume: 0.7 });
      else playAudioCue(impactCue);
    } else if (event.type === "slime-jump") {
      playSpatialCue("slimeJump", { distance, playbackRate: event.playbackRate });
    } else if (event.type === "slime-land") {
      playSpatialCue("slimeLand", { distance, playbackRate: event.playbackRate });
    } else if (event.type === "melee") {
      playSpatialCue("melee", { distance, baseVolume: 0.82 });
    } else if (event.type === "boss-melee") {
      playSpatialCue("bossMelee", { distance, baseVolume: 0.96 });
    } else if (event.type === "boss-dark-release") {
      playSpatialCue("bossDarkRelease", { distance, baseVolume: 1 });
    } else if (event.type === "boss-phase-two") {
      playSpatialCue("bossPhaseTwo", { distance, baseVolume: 0.92 });
      enqueueBossDialogue("rampage");
    } else if (event.type === "boss-dark-area") {
      playSpatialCue("bossDarkArea", { distance, baseVolume: 0.95 });
      enqueueBossDialogue("strongAttack", { cooldownMs: 7000 });
    } else if (event.type === "boss-summon") {
      playSpatialCue("bossSummon", { distance, baseVolume: 0.92 });
      enqueueBossDialogue("summon", { cooldownMs: 5000 });
    } else if (event.type === "fire-meteor-impact") {
      playAudioCue("meteorImpact", { volume: 0.95 });
    } else if (event.type === "footstep") {
      playRandomFootstep({ volume: calculateSpatialVolume(distance, { baseVolume: 0.46 }) });
    }
  }
}

function updatePlayerFootsteps(movedDistance, elapsedMs) {
  if (movedDistance <= 0.001) {
    playerFootstepTimerMs = 0;
    return;
  }
  playerFootstepTimerMs += elapsedMs;
  while (playerFootstepTimerMs >= 400) {
    playerFootstepTimerMs -= 400;
    playRandomFootstep();
  }
}

function showWorldCastNotice(card, accuracy, { failed = false, damage = 0, defense = false } = {}) {
  const notice = document.querySelector("#world-cast-notice");
  const details = document.querySelector("#world-cast-details");
  const title = notice?.querySelector("strong");
  if (!(notice instanceof HTMLElement)) return;
  if (castNoticeTimer) window.clearTimeout(castNoticeTimer);
  if (title) title.textContent = failed ? "마법 실패" : "마법 발동";
  if (details) {
    details.textContent = failed
      ? `${card.label} 속성 · 정확도 ${accuracy}% · 30% 이하는 실패합니다.`
      : defense
        ? `${card.label} 속성 · 정확도 ${accuracy}% · 방어막 3.0초`
        : `${card.label} 속성 · 정확도 ${accuracy}% · 피해 ${damage}`;
  }
  notice.style.setProperty("--cast-color", failed ? "#ff5f74" : card.color);
  notice.hidden = false;
  notice.classList.remove("is-showing");
  requestAnimationFrame(() => notice.classList.add("is-showing"));
  castNoticeTimer = window.setTimeout(() => {
    notice.classList.remove("is-showing");
    const hideTimer = window.setTimeout(() => { notice.hidden = true; }, 420);
    castNoticeTimer = hideTimer;
  }, 1500);
}

function clearNpcDialogueTimers() {
  npcDialogueTimers.forEach((timer) => window.clearTimeout(timer));
  npcDialogueTimers = [];
}

function enqueueNpcDialogue(message, {
  faceSource = GAME_ASSETS.faces.npc,
  speakerName = worldSession?.npc?.name ?? "스승 그리모어",
  speakerType = "npc",
} = {}) {
  const stack = document.querySelector("#npc-message");
  if (!(stack instanceof HTMLElement) || !message.trim()) return;

  const previousPositions = new Map(
    [...stack.children].map((item) => [item, item.getBoundingClientRect().top]),
  );
  const item = document.createElement("article");
  item.className = "npc-dialogue-item";
  item.dataset.speaker = speakerType;
  const face = document.createElement("span");
  face.className = "npc-dialogue-face";
  face.style.backgroundImage = `url(${faceSource})`;
  face.setAttribute("aria-label", speakerName);
  const bubble = document.createElement("p");
  bubble.className = "npc-dialogue-bubble";
  bubble.textContent = message;
  item.append(face, bubble);
  stack.prepend(item);
  stack.hidden = false;

  // 새 대사가 위에 들어오면 기존 대사는 현재 위치에서 아래 자리로 부드럽게 이동한다.
  previousPositions.forEach((previousTop, previousItem) => {
    const offset = previousTop - previousItem.getBoundingClientRect().top;
    previousItem.animate?.(
      [{ transform: `translateY(${offset}px)` }, { transform: "translateY(0)" }],
      { duration: 420, easing: "cubic-bezier(0.2, 0.8, 0.25, 1)" },
    );
  });

  const fadeTimer = window.setTimeout(() => {
    item.classList.add("is-leaving");
    const removeTimer = window.setTimeout(() => {
      item.remove();
      stack.hidden = stack.childElementCount === 0;
    }, 1000);
    npcDialogueTimers.push(removeTimer);
  }, Math.min(12500, 5600 + [...message].length * 105));
  npcDialogueTimers.push(fadeTimer);
}

function enqueueBossDialogue(dialogueId, { cooldownMs = 0 } = {}) {
  const message = BOSS_DIALOGUES[dialogueId];
  if (!message || !worldSession) return false;
  worldSession.bossDialogueCooldowns ??= {};
  const now = performance.now();
  if ((worldSession.bossDialogueCooldowns[dialogueId] ?? 0) > now) return false;
  worldSession.bossDialogueCooldowns[dialogueId] = now + Math.max(0, cooldownMs);
  enqueueNpcDialogue(message, {
    faceSource: GAME_ASSETS.entities["monster.spirit-king"],
    speakerName: "타락한 정령왕",
    speakerType: "boss",
  });
  return true;
}

/** 빈 문자열은 전체 대화를 정리하고, 문자열은 지속 시간형 말풍선으로 추가한다. */
export function setNpcMessage(message = "") {
  const stack = document.querySelector("#npc-message");
  if (!(stack instanceof HTMLElement)) return;
  if (message.trim()) {
    enqueueNpcDialogue(message);
    return;
  }
  clearNpcDialogueTimers();
  stack.replaceChildren();
  stack.hidden = true;
}

function beginNpcDialogueSequence() {
  if (npcConversationStarted || !worldSession?.npc?.active) return;
  npcConversationStarted = true;
  let delayMs = 0;
  worldSession.npc.dialogues.forEach((dialogue) => {
    const timer = window.setTimeout(() => enqueueNpcDialogue(dialogue), delayMs);
    npcDialogueTimers.push(timer);
    delayMs += Math.min(5200, 2450 + [...dialogue].length * 70);
  });
}

function describeInputState() {
  const modeLabel = {
    [GestureMode.EXPLORING]: "탐험",
    [GestureMode.RUNE_READY]: "룬 준비",
    [GestureMode.DRAWING]: "룬 그리기",
  }[inputController.state.mode];
  const castLabel = inputController.state.castType === "attack"
    ? "공격"
    : "없음";
  return `입력 상태: ${modeLabel} · 시전: ${castLabel}`;
}

function renderInputState() {
  const readout = document.querySelector("#gesture-readout");
  const runePanel = document.querySelector("#rune-mode-panel");
  const runeModeLabel = document.querySelector("#rune-mode-label");
  const castType = inputController.state.castType;
  const isRuneMode = inputController.state.mode !== GestureMode.EXPLORING;

  document.documentElement.dataset.inputMode = inputController.state.mode;
  document.documentElement.dataset.castType = castType ?? "none";
  if (readout) {
    readout.textContent = describeInputState();
  }
  if (runePanel instanceof HTMLElement) {
    runePanel.hidden = !isRuneMode || !gameStarted;
  }
  if (runeModeLabel) {
    runeModeLabel.textContent = "공격 룬";
  }
}

function triggerRuneCardFlip(previousCastType, nextCastType) {
  if (!previousCastType || previousCastType === nextCastType) return;
  const panel = document.querySelector("#rune-mode-panel");
  if (!(panel instanceof HTMLElement)) return;
  panel.classList.remove("is-flipping");
  panel.dataset.flipTo = nextCastType;
  requestAnimationFrame(() => panel.classList.add("is-flipping"));
  window.setTimeout(() => panel.classList.remove("is-flipping"), 620);
}

function createRunePolylines(card, skillTier = 1) {
  return getRuneSvgPolylines(card, skillTier).map((points) => {
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", points);
    return polyline;
  });
}

function createUltimateRuneCard(stageIndex = 0) {
  return {
    id: "light",
    deckId: `light-ultimate-${stageIndex}`,
    label: `${ULTIMATE_SKILL_NAME} ${stageIndex + 1}/3`,
    color: "#fff0a8",
    skillTier: 1,
    isUltimate: true,
    ultimateStageIndex: stageIndex,
    ultimateStrokes: LIGHT_ULTIMATE_RUNE_STROKES[stageIndex],
  };
}

function isUltimateCardAvailable() {
  if (!worldSession) return false;
  const maximum = worldSession.player.maximumUltimate ?? 100;
  return (worldSession.player.ultimate ?? 0) >= maximum
    && (worldSession.player.ultimateBuffMs ?? 0) <= 0;
}

function appendUltimateStrokes(svg, strokes, className) {
  for (const stroke of strokes ?? []) {
    const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    polyline.setAttribute("points", stroke.map((point) => `${point.x * 100},${point.y * 100}`).join(" "));
    polyline.setAttribute("class", className);
    svg.append(polyline);
  }
}

function updateUltimatePresentationState() {
  const state = (worldSession?.player?.ultimateBuffMs ?? 0) > 0
    ? "active"
    : ultimateSequence ? "drawing" : "inactive";
  setDocumentState("ultimateState", state);
}

function startUltimateDrawingAudio() {
  if (ultimateDrawingAudio) return;
  ultimateDrawingAudio = playAudioCue("ultimateAura", { volume: 0.16 });
  if (ultimateDrawingAudio) ultimateDrawingAudio.loop = true;
}

function stopUltimateDrawingAudio() {
  stopAudioCue(ultimateDrawingAudio);
  ultimateDrawingAudio = null;
}

function startUltimateBuffAudio() {
  stopAudioCue(ultimateBuffAudio);
  ultimateBuffAudio = playFadingAudioCue("ultimateAura", {
    volume: 0.92,
    durationMs: 10000,
    fadeOutMs: 1200,
    loop: true,
  });
}

function stopUltimateBuffAudio() {
  stopAudioCue(ultimateBuffAudio);
  ultimateBuffAudio = null;
}

function clearUltimateSequence() {
  if (ultimateCombineTimer) window.clearTimeout(ultimateCombineTimer);
  ultimateCombineTimer = null;
  ultimateSequence = null;
  completedUltimateRuneStrokes = [];
  ultimateCombining = false;
  stopUltimateDrawingAudio();
  updateUltimatePresentationState();
  document.querySelector("#rune-mode-panel")?.classList.remove("is-ultimate-combining", "is-ultimate-sequence");
}

function reenterUltimateRuneMode() {
  if (inputController.state.mode === GestureMode.EXPLORING) {
    inputController.enterRuneMode("attack");
  }
}

function hideRuneResult() {
  const result = document.querySelector("#rune-cast-result");
  if (result instanceof HTMLElement) result.hidden = true;
}

function renderRuneSelection() {
  const guide = document.querySelector("#rune-guide-symbol");
  const prompt = document.querySelector("#rune-guide-prompt");
  const panel = document.querySelector("#rune-mode-panel");
  if (!(guide instanceof SVGElement)) return;
  guide.replaceChildren();
  panel?.classList.toggle("has-rune-selection", Boolean(activeRuneCard));
  panel?.classList.toggle("is-ultimate-sequence", Boolean(ultimateSequence));
  panel?.classList.toggle("is-ultimate-combining", ultimateCombining);
  document.querySelectorAll(".rune-card").forEach((button) => {
    button.classList.toggle(
      "is-selected",
      button instanceof HTMLElement && button.dataset.runeDeckId === activeRuneCard?.deckId,
    );
  });
  if (!activeRuneCard) {
    if (prompt) prompt.textContent = "아래에서 속성 카드를 선택하세요.";
    guide.style.removeProperty("--rune-color");
    return;
  }
  guide.style.setProperty("--rune-color", activeRuneCard.color);
  if (activeRuneCard.isUltimate) {
    completedUltimateRuneStrokes.forEach((strokes) => appendUltimateStrokes(guide, strokes, "ultimate-rune-ghost"));
    if (ultimateCombining) {
      LIGHT_ULTIMATE_RUNE_STROKES.forEach((strokes) => appendUltimateStrokes(guide, strokes, "ultimate-rune-combined"));
      if (prompt) prompt.textContent = "세 빛의 문양이 하나의 궁극 마법진으로 합쳐집니다.";
      return;
    }
  }
  guide.append(...createRunePolylines(activeRuneCard, activeSkillTier));
  if (prompt) prompt.textContent = activeRuneCard.isUltimate
    ? `${ULTIMATE_SKILL_NAME} ${activeRuneCard.ultimateStageIndex + 1}/3 문양을 따라 그리세요.`
    : `${getSkillName(activeRuneCard.id, activeSkillTier)} 문양을 따라 그리세요.`;
}

function resetRuneSelection(runeCanvas) {
  clearUltimateSequence();
  activeRuneCard = null;
  activeSkillTier = 1;
  clearRuneTrace(runeTrace);
  drawRuneTrace(runeCanvas, runeTrace);
  hideRuneResult();
  renderRuneSelection();
}

function setupRuneCards(runeCanvas) {
  const tray = document.querySelector("#rune-card-tray");
  const runeModePanel = document.querySelector("#rune-mode-panel");
  if (!(tray instanceof HTMLElement) || !(runeModePanel instanceof HTMLElement)) return;
  renderRuneCards = () => {
    const showUltimateCard = isUltimateCardAvailable() || Boolean(ultimateSequence);
    let ultimateSlot = null;
    if (showUltimateCard) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rune-card rune-card-ultimate";
      button.dataset.runeCardId = "light";
      button.dataset.runeDeckId = `light-ultimate-${ultimateSequence?.completedRuneCount ?? 0}`;
      button.style.setProperty("--card-color", "#fff0a8");
      button.disabled = ultimateCombining;
      button.setAttribute("aria-label", ultimateSequence ? `${ULTIMATE_SKILL_NAME} 룬 이어 그리기` : `${ULTIMATE_SKILL_NAME} 선택`);
      const symbol = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      symbol.setAttribute("viewBox", "0 0 100 100");
      LIGHT_ULTIMATE_RUNE_STROKES.forEach((strokes) => appendUltimateStrokes(symbol, strokes, "ultimate-card-symbol"));
      const label = document.createElement("span");
      label.className = "rune-card-label";
      label.textContent = ultimateSequence ? `${ULTIMATE_SKILL_NAME} ${ultimateSequence.completedRuneCount + 1}/3` : ULTIMATE_SKILL_NAME;
      button.append(symbol, label);
      button.addEventListener("click", () => {
        if (!gameStarted || inputController.state.mode === GestureMode.EXPLORING || inputController.state.castType !== "attack" || ultimateCombining) return;
        if (!ultimateSequence) {
          ultimateSequence = createLightUltimateSequence();
          completedUltimateRuneStrokes = [];
        }
        startUltimateDrawingAudio();
        activeRuneCard = createUltimateRuneCard(ultimateSequence.completedRuneCount);
        activeSkillTier = 1;
        clearRuneTrace(runeTrace);
        drawRuneTrace(runeCanvas, runeTrace);
        hideRuneResult();
        renderRuneSelection();
        renderRuneCards();
        updateUltimatePresentationState();
        updateStatus(`${ULTIMATE_SKILL_NAME} ${ultimateSequence.completedRuneCount + 1}/3 문양을 그리세요.`);
      });
      ultimateSlot = document.createElement("div");
      ultimateSlot.className = "rune-card-slot rune-card-slot-ultimate";
      ultimateSlot.style.setProperty("--card-color", "#fff0a8");
      ultimateSlot.append(button);
    }
    const cardSlots = runeDeck.hand.map((card) => {
      const cardSkillTier = card.skillTier ?? 1;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "rune-card";
      button.dataset.runeCardId = card.id;
      button.dataset.runeDeckId = card.deckId ?? card.id;
      button.disabled = ultimateCombining;
      button.style.setProperty("--card-color", card.color);
      const skillName = getSkillName(card.id, cardSkillTier);
      button.setAttribute("aria-label", `${skillName} 카드`);
      const symbol = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      symbol.setAttribute("viewBox", "0 0 100 100");
      symbol.append(...createRunePolylines(card, cardSkillTier));
      const label = document.createElement("span");
      label.className = "rune-card-label";
      label.textContent = skillName;
      button.append(symbol, label);
      const selectCard = () => {
        if (!gameStarted || inputController.state.mode === GestureMode.EXPLORING) return;
        if (ultimateSequence) clearUltimateSequence();
        activeRuneCard = card;
        activeSkillTier = inputController.state.castType === "defense"
          ? 1
          : cardSkillTier;
        clearRuneTrace(runeTrace);
        drawRuneTrace(runeCanvas, runeTrace);
        hideRuneResult();
        renderRuneSelection();
        updateStatus(`${getSkillName(card.id, activeSkillTier)} 카드를 선택했습니다.`);
      };
      button.addEventListener("click", selectCard);
      const slot = document.createElement("div");
      slot.className = "rune-card-slot";
      slot.style.setProperty("--card-color", card.color);
      slot.append(button);
      return slot;
    });
    const refreshButton = document.createElement("button");
    refreshButton.id = "rune-hand-refresh-button";
    refreshButton.type = "button";
    refreshButton.className = "rune-hand-refresh";
    refreshButton.disabled = runeRefreshUsesRemaining > 0;
    refreshButton.setAttribute("aria-label", runeRefreshUsesRemaining > 0
      ? `새로고침 재충전까지 마법 ${runeRefreshUsesRemaining}회`
      : "모든 룬 카드를 버리고 새 손패 뽑기");
    refreshButton.innerHTML = runeRefreshUsesRemaining > 0
      ? `<span aria-hidden="true">${runeRefreshUsesRemaining}</span><small>충전 중</small>`
      : '<span aria-hidden="true">↻</span><small>새로고침</small>';
    refreshButton.addEventListener("click", () => {
      if (!gameStarted || runeRefreshUsesRemaining > 0) return;
      refreshRuneHand(runeDeck);
      runeRefreshUsesRemaining = 3;
      resetRuneSelection(runeCanvas);
      renderRuneCards();
      updateStatus("손패를 전부 버리고 창고에서 새 룬 카드를 뽑았습니다.");
    });
    refreshButton.disabled = runeRefreshUsesRemaining > 0 || ultimateCombining;
    tray.replaceChildren(...(ultimateSlot ? [ultimateSlot] : []), ...cardSlots);
    runeModePanel.querySelector("#rune-hand-refresh-button")?.remove();
    runeModePanel.append(refreshButton);
  };
  renderRuneCards();
}

function handleUltimateRuneFinish(runeCanvas, result, runeStrokes) {
  if (!activeRuneCard?.isUltimate || !ultimateSequence || !worldSession) return false;
  const stageIndex = ultimateSequence.completedRuneCount;
  if (!result?.succeeded) {
    reenterUltimateRuneMode();
    clearRuneTrace(runeTrace);
    drawRuneTrace(runeCanvas, runeTrace);
    renderRuneSelection();
    showWorldCastNotice(activeRuneCard, result?.accuracy ?? 0, { failed: true });
    updateStatus(`${ULTIMATE_SKILL_NAME} ${stageIndex + 1}/3 문양 정확도가 부족합니다. 다시 그리세요.`);
    return true;
  }

  playAudioCue(["ultimateRune1", "ultimateRune2", "ultimateRune3"][stageIndex], { volume: 0.96 });
  completedUltimateRuneStrokes.push(runeStrokes);
  ultimateSequence = completeUltimateRune(ultimateSequence, LIGHT_ULTIMATE_RUNE_IDS[stageIndex]);
  clearRuneTrace(runeTrace);
  drawRuneTrace(runeCanvas, runeTrace);
  reenterUltimateRuneMode();

  if (ultimateSequence.phase !== UltimatePhase.COMBINED_SYMBOL) {
    activeRuneCard = createUltimateRuneCard(ultimateSequence.completedRuneCount);
    renderRuneSelection();
    renderRuneCards();
    updateStatus(`${ULTIMATE_SKILL_NAME} 문양 ${stageIndex + 1}/3 완성 · 다음 문양을 그리세요.`);
    return true;
  }

  ultimateCombining = true;
  activeRuneCard = createUltimateRuneCard(2);
  renderRuneSelection();
  renderRuneCards();
  updateStatus("세 빛의 문양이 하나의 궁극 마법진으로 합쳐집니다.");
  ultimateCombineTimer = window.setTimeout(() => {
    ultimateCombineTimer = null;
    ultimateSequence = castUltimate(ultimateSequence);
    const completedStrokes = completedUltimateRuneStrokes.map((strokes) => strokes.map((stroke) => stroke.map((point) => ({ ...point }))));
    spawnPlayerUltimate(combatState, worldSession, completedStrokes);
    playMagicAudio("light");
    stopUltimateDrawingAudio();
    startUltimateBuffAudio();
    inputController.exitRuneMode();
    clearRuneAutoTarget();
    activeRuneCard = null;
    activeSkillTier = 1;
    clearRuneTrace(runeTrace);
    drawRuneTrace(runeCanvas, runeTrace);
    clearUltimateSequence();
    lastUltimateCardAvailable = false;
    renderRuneCards();
    renderRuneSelection();
    renderInputState();
    updatePlayerHud();
    updateUltimatePresentationState();
    updateStatus(`${ULTIMATE_SKILL_NAME} 발동 · 10초간 피해 1.5배 · 받는 피해 80% 감소 · 빛 장 피해 7.5`);
  }, 1250);
  return true;
}

function getRuneTargetBounds(runeCanvas) {
  const guide = document.querySelector("#rune-guide-symbol");
  if (!(guide instanceof SVGElement)) return null;
  const canvasBounds = runeCanvas.getBoundingClientRect();
  const guideBounds = guide.getBoundingClientRect();
  return {
    left: (guideBounds.left - canvasBounds.left) / canvasBounds.width,
    top: (guideBounds.top - canvasBounds.top) / canvasBounds.height,
    width: guideBounds.width / canvasBounds.width,
    height: guideBounds.height / canvasBounds.height,
  };
}

function isInsideRuneGuide(point) {
  const guide = document.querySelector("#rune-guide-symbol");
  if (!(guide instanceof SVGElement)) return false;
  return isScreenPointInsideRectangle(point, guide.getBoundingClientRect());
}

function evaluateRuneAttempt(runeCanvas) {
  if (!activeRuneCard) return null;
  const bounds = getRuneTargetBounds(runeCanvas);
  if (!bounds) return null;
  const accuracy = scoreRuneTrace(runeTrace, activeRuneCard, bounds, activeSkillTier);
  const maximumDamage = activeSkillTier === 3
    ? activeRuneCard.id === "electric" ? 150 : 170
    : activeSkillTier === 2 ? 150 : 100;
  const baseDamage = calculateRuneDamage(accuracy, maximumDamage);
  const damage = calculatePlayerAttackDamage(baseDamage, worldSession?.player);
  return { accuracy, damage, succeeded: damage > 0 };
}

function getLocalRuneStrokes(runeCanvas) {
  const bounds = getRuneTargetBounds(runeCanvas);
  if (!bounds) return [];
  return runeTrace.strokes.map((stroke) => stroke.map((point) => ({
    x: (point.x - bounds.left) / bounds.width,
    y: (point.y - bounds.top) / bounds.height,
  })));
}

function renderMiniMap() {
  const map = document.querySelector("#map-rooms");
  if (!(map instanceof HTMLElement) || !dungeon || !worldSession) {
    return;
  }

  const minimumX = Math.min(...dungeon.rooms.map((room) => room.x));
  const maximumX = Math.max(...dungeon.rooms.map((room) => room.x));
  const minimumY = Math.min(...dungeon.rooms.map((room) => room.y));
  const maximumY = Math.max(...dungeon.rooms.map((room) => room.y));
  const currentRoom = dungeon.roomById[worldSession.currentRoomId];
  const knownRoomIds = new Set();
  for (const visitedRoomId of worldSession.visitedRoomIds) {
    const visitedRoom = dungeon.roomById[visitedRoomId];
    Object.values(visitedRoom?.doors ?? {}).forEach((roomId) => knownRoomIds.add(roomId));
  }
  map.style.gridTemplateColumns = `repeat(${maximumX - minimumX + 1}, 1fr)`;
  map.style.gridTemplateRows = `repeat(${maximumY - minimumY + 1}, 1fr)`;
  map.replaceChildren(...dungeon.rooms.map((room) => {
    const roomMark = document.createElement("span");
    roomMark.style.gridColumn = String(room.x - minimumX + 1);
    roomMark.style.gridRow = String(room.y - minimumY + 1);
    roomMark.dataset.roomId = room.id;
    roomMark.dataset.roomType = room.type;
    roomMark.title = room.type === "start"
      ? "시작방"
      : room.isBossRoom
        ? "보스방"
        : room.isStageEnd
          ? "다음 스테이지 통로가 있는 방"
          : room.type === "shop" ? "상점방" : "전투방";
    roomMark.classList.toggle("current-room", room.id === worldSession.currentRoomId);
    const visited = worldSession.visitedRoomIds.has(room.id);
    const known = knownRoomIds.has(room.id);
    roomMark.hidden = !visited && !known;
    roomMark.classList.toggle("visited-room", visited);
    roomMark.classList.toggle("known-room", known && !visited);
    roomMark.classList.toggle("next-stage-room", Boolean(room.isStageEnd));
    roomMark.classList.toggle("boss-room", Boolean(room.isBossRoom));
    roomMark.style.setProperty("--room-shift-x", room.x < currentRoom.x ? "-53%" : room.x > currentRoom.x ? "53%" : "0%");
    roomMark.style.setProperty("--room-shift-y", room.y < currentRoom.y ? "-53%" : room.y > currentRoom.y ? "53%" : "0%");
    if (visited) {
      for (const direction of Object.keys(room.doors)) {
        const doorMark = document.createElement("b");
        doorMark.className = `map-door map-door-${direction}`;
        doorMark.ariaHidden = "true";
        roomMark.append(doorMark);
      }
    }
    return roomMark;
  }));
  updateMiniMapEntities();
}

function appendMapEntity(roomMark, className, position) {
  const marker = document.createElement("i");
  marker.className = `map-entity ${className}`;
  marker.style.setProperty("--entity-left", `${((position.x + ROOM_HALF_SIZE) / (ROOM_HALF_SIZE * 2)) * 100}%`);
  marker.style.setProperty("--entity-top", `${((position.z + ROOM_HALF_SIZE) / (ROOM_HALF_SIZE * 2)) * 100}%`);
  roomMark.append(marker);
}

function updateMiniMapEntities() {
  if (!worldSession) return;
  const roomMark = document.querySelector(`[data-room-id="${worldSession.currentRoomId}"]`);
  if (!(roomMark instanceof HTMLElement)) return;

  document.querySelectorAll(".map-entity, .map-view-cone").forEach((marker) => marker.remove());
  const cone = document.createElement("i");
  cone.className = "map-view-cone";
  cone.style.setProperty("--entity-left", `${((worldSession.player.x + ROOM_HALF_SIZE) / (ROOM_HALF_SIZE * 2)) * 100}%`);
  cone.style.setProperty("--entity-top", `${((worldSession.player.z + ROOM_HALF_SIZE) / (ROOM_HALF_SIZE * 2)) * 100}%`);
  cone.style.setProperty("--view-angle", `${worldSession.player.cameraYaw * 180 / Math.PI}deg`);
  roomMark.append(cone);
  appendMapEntity(roomMark, "map-entity-player", worldSession.player);

  if (worldSession.npc?.active && worldSession.npc.roomId === worldSession.currentRoomId) {
    appendMapEntity(roomMark, "map-entity-npc", worldSession.npc);
  }
  for (const monster of monstersByRoom[worldSession.currentRoomId] ?? []) {
    if ((monster.currentHealth ?? monster.stats.health) <= 0) continue;
    appendMapEntity(roomMark, "map-entity-enemy", monster.position);
  }
}

function getPlayerHudElements() {
  if (playerHudElements) return playerHudElements;
  playerHudElements = {
    resources: [
      { key: "health", path: document.querySelector(".health-value"), readout: document.querySelector("#health-readout"), lastPercentage: null },
      { key: "ultimate", path: document.querySelector(".ultimate-value"), readout: document.querySelector("#ultimate-readout"), lastPercentage: null },
      { key: "mana", path: document.querySelector(".mana-value"), readout: document.querySelector("#mana-readout"), lastPercentage: null },
    ],
    goldReadout: document.querySelector("#gold-readout"),
    portrait: document.querySelector(".portrait-hud .portrait"),
    defenseTimer: document.querySelector("#defense-timer"),
  };
  return playerHudElements;
}

function updatePlayerHud() {
  if (!worldSession) return;
  setDocumentState("manaDraining",
    inputController.state.mode === GestureMode.DRAWING,
  );
  setDocumentState("lowMana",
    (worldSession.player.mana ?? 0) <= 30,
  );
  const { resources, goldReadout, portrait, defenseTimer } = getPlayerHudElements();
  for (const resource of resources) {
    const value = worldSession.player[resource.key] ?? 0;
    const maximum = worldSession.player[`maximum${resource.key[0].toUpperCase()}${resource.key.slice(1)}`] ?? 100;
    const percentage = Math.max(0, Math.min(100, maximum > 0 ? value / maximum * 100 : 0));
    if (resource.path instanceof SVGElement && resource.lastPercentage !== percentage) {
      resource.path.style.strokeDasharray = `${percentage} ${100 - percentage}`;
      resource.lastPercentage = percentage;
    }
    const nextReadout = resource.key === "health" && worldSession.player.infiniteHealth
      ? "∞"
      : String(Math.round(value * 10) / 10);
    if (resource.readout && resource.readout.textContent !== nextReadout) {
      resource.readout.textContent = nextReadout;
    }
  }
  const nextGoldReadout = `G: ${worldSession.player.infiniteGold ? "∞" : worldSession.player.gold ?? 0}`;
  if (goldReadout && goldReadout.textContent !== nextGoldReadout) goldReadout.textContent = nextGoldReadout;
  if (portrait instanceof HTMLElement) {
    if (portrait.textContent) portrait.textContent = "";
    const faceSource = worldSession.player.health <= 30
      ? GAME_ASSETS.faces.playerInjured
      : GAME_ASSETS.faces.player;
    if (portrait.dataset.faceSource !== faceSource) {
      portrait.dataset.faceSource = faceSource;
      portrait.style.backgroundImage = `url(${faceSource})`;
    }
    portrait.classList.toggle("is-hit", (worldSession.player.hitFlashMs ?? 0) > 0);
  }
  setDocumentState("lowHealth", worldSession.player.health < 30);
  if (defenseTimer instanceof HTMLElement) {
    const barrier = worldSession.player.defenseBarrier;
    defenseTimer.hidden = !barrier;
    if (barrier) {
      const card = RUNE_CARDS.find((candidate) => candidate.id === barrier.element);
      defenseTimer.style.setProperty("--barrier-color", card?.color ?? "#a7d8ff");
      defenseTimer.textContent = `방어 ${Math.max(0, barrier.remainingMs / 1000).toFixed(1)}`;
    }
  }
  const ultimateCardAvailable = isUltimateCardAvailable();
  if (ultimateCardAvailable !== lastUltimateCardAvailable) {
    lastUltimateCardAvailable = ultimateCardAvailable;
    renderRuneCards();
  }
}

function showOnlyScreen(screenId) {
  for (const id of ["title-screen", "exploration-screen", "shop-screen", "node-room-screen", "world-ui"]) {
    const screen = document.querySelector(`#${id}`);
    if (screen instanceof HTMLElement) screen.hidden = id !== screenId;
  }
}

function syncProgressFromWorld() {
  if (worldSession) copyPlayerToProgress(worldSession.player, playerProgress);
}

function createCombatStage({ nodeStage = 1, bossNode = false, nodeKey = null } = {}) {
  syncProgressFromWorld();
  clearUltimateSequence();
  stopUltimateBuffAudio();
  activeRuneCard = null;
  activeSkillTier = 1;
  inputController.exitRuneMode();
  clearRuneAutoTarget();
  lastUltimateCardAvailable = false;
  setNpcMessage("");
  const random = createSeededRandom(Date.now());
  currentCombatStage = nodeStage;
  currentCombatIsBoss = bossNode;
  currentCombatNodeKey = nodeKey ?? explorationState?.currentNodeId ?? `combat-${combatNodeCount}`;
  dungeon = bossNode ? generateBossDungeon({ random }) : generateDungeon({ random });
  const showNpc = combatNodeCount === 0 && !bossNode;
  worldSession = createWorldSession(dungeon, {
    playerProgress,
    handRolesReversed: inputController.state.handRolesReversed,
    showNpc,
  });
  combatState = createCombatState();
  if (combatNodeCount === 0) {
    runeDeck = createRuneDeck(createRuneCardPool(RUNE_CARDS), { random });
    runeRefreshUsesRemaining = 0;
  }
  renderRuneCards();
  monstersByRoom = Object.fromEntries(dungeon.rooms.map((room) => {
    if (room.isBossRoom) return [room.id, [createSpiritKingBoss({ position: { x: 0, z: 0 } })]];
    if (room.type !== "combat") return [room.id, []];
    const monsters = generateRoomMonsters({
      chapter: 1,
      random,
      blockedPositions: room.rocks,
      doorDirections: Object.keys(room.doors),
    }).monsters
      .map((monster) => scaleMonsterForStage(monster, nodeStage));
    return [room.id, monsters];
  }));
  initialMonstersByRoom = cloneGameData(monstersByRoom);
  initialRocksByRoom = Object.fromEntries(dungeon.rooms.map((room) => [room.id, cloneGameData(room.rocks ?? [])]));
  combatNodeCount += 1;
  currentStagePortalId = null;
  gameStarted = true;
  startBackgroundMusic("normal");
  document.querySelector("#boss-hud")?.setAttribute("hidden", "");
  document.querySelector("#boss-intro-title")?.setAttribute("hidden", "");
  document.documentElement.dataset.screen = "game";
  showOnlyScreen("world-ui");
  renderMiniMap();
  updatePlayerHud();
  renderRuneSelection();
  renderInputState();
  showSpawnPointNotice();
  updateStatus(`${bossNode ? "보스" : "전투"} 노드 ${nodeStage}단계 시작 · 적 능력치 배율 ${1.2 ** Math.max(0, nodeStage - 1)}배 · ${dungeon.rooms.length}개 방`);
}

function createStage(nickname) {
  npcConversationStarted = false;
  combatNodeCount = 0;
  shopInventoryByKey = new Map();
  offeredShopElements = new Set();
  offeredShopItemKeys = new Set();
  runElapsedMs = 0;
  clearScreenOpen = false;
  completedCombatRewardKeys = new Set();
  playerProgress = createPlayerProgress({ nickname });
  worldSession = null;
  const random = createSeededRandom(Date.now());
  explorationGraph = generateExplorationGraph({ random });
  const initialState = createExplorationState(explorationGraph);
  explorationState = selectExplorationNode(explorationGraph, initialState, explorationGraph.initialNodeId);
  createCombatStage({ nodeStage: 1, nodeKey: explorationGraph.initialNodeId });
  renderCurrentExplorationMap();
}

function shopItemPresentation(item) {
  if (item.type === "healing") {
    return { label: "회복 아이템", detail: `체력 ${item.healingAmount} 회복`, color: "#78df9b" };
  }
  const card = RUNE_CARDS.find((candidate) => candidate.id === item.element);
  if (item.type === "third-skill") {
    const details = {
      normal: "대형 투사체 · 피해 증가 · 8방향 발사",
      fire: "반지름 5 메테오 · 화상 지속 피해",
      water: "입체 파도 · 적을 자연스럽게 휩쓸어 밀어냄",
      grass: "적 3명 5초 포박 · 0.3초마다 15 피해",
      rock: "방 전체에 2스킬 효과",
      electric: "무작위 적 3명 · 낙뢰 · 2스킬 피해의 1.5배 · 3초 기절",
      ice: "방 전체 피해 · 3초 빙결",
      light: "3초 무적 · 이동·회전 가능한 거대 지속 광선",
      dark: "5초 블랙홀 · 0.5초마다 15 지속 피해",
    };
    return {
      label: `${getSkillName(item.element, 3)} 카드`,
      detail: details[item.element] ?? "강화된 속성 마법",
      color: card?.color ?? "#d9d4ee",
    };
  }
  const detail = item.element === "rock"
    ? "지름 10 범위 · 2초 속박 · 돌 제거"
    : item.element === "ice"
      ? "발사체 3개 · 3초 속박 · 최대 피해 150"
    : item.element === "light" || item.element === "electric"
      ? "4방향 공격 · 최대 피해 150"
      : "발사체 3개 · 크기 증가 · 최대 피해 150";
  return {
    label: `${getSkillName(item.element, 2)} 카드`,
    detail,
    color: card?.color ?? "#d9d4ee",
  };
}

function renderShop() {
  const inventory = document.querySelector("#shop-inventory");
  const wallet = document.querySelector("#shop-gold");
  const status = document.querySelector("#shop-status");
  if (wallet) wallet.textContent = playerProgress.infiniteGold ? "∞G" : `${playerProgress.gold}G`;
  if (!(inventory instanceof HTMLElement)) return;

  inventory.replaceChildren(...activeShopInventory.map((item) => {
    const presentation = shopItemPresentation(item);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-item";
    button.style.setProperty("--shop-item-color", presentation.color);
    const alreadyOwned = (item.type === "second-skill"
      && playerProgress.unlockedSecondSkills.includes(item.element))
      || (item.type === "third-skill"
        && playerProgress.unlockedThirdSkills.includes(item.element));
    button.disabled = alreadyOwned;
    button.innerHTML = `<strong>${presentation.label}</strong><small>${presentation.detail}</small><span>${alreadyOwned ? "구매 완료" : `${item.price}G`}</span>`;
    button.addEventListener("click", () => {
      const result = purchaseShopItem(playerProgress, item);
      if (result.succeeded && item.type === "second-skill") {
        const purchasedCard = RUNE_CARDS.find((candidate) => candidate.id === item.element);
        addSecondSkillCardsToWarehouse(runeDeck, purchasedCard, { copies: 2 });
      } else if (result.succeeded && item.type === "third-skill") {
        const purchasedCard = RUNE_CARDS.find((candidate) => candidate.id === item.element);
        addThirdSkillCardsToWarehouse(runeDeck, purchasedCard, { copies: 1 });
      }
      const reasonMessage = {
        "already-owned": "이미 해금한 2스킬입니다.",
        "full-health": "체력이 이미 가득 찼습니다.",
        "not-enough-gold": "G가 부족합니다.",
        "second-skill-required": "먼저 같은 속성의 2스킬을 구매해야 합니다.",
      }[result.reason];
      if (status) status.textContent = result.succeeded
        ? `${presentation.label} 구매 완료 · 남은 골드 ${playerProgress.infiniteGold ? "∞" : playerProgress.gold}G`
        : reasonMessage ?? "구매할 수 없습니다.";
      if (worldSession) copyProgressToPlayer(playerProgress, worldSession.player);
      renderShop();
      renderRuneCards();
      renderRuneSelection();
      updatePlayerHud();
    });
    return button;
  }));
}

function openShop({ returnTarget = "exploration", shopKey = "default" } = {}) {
  syncProgressFromWorld();
  shopReturnTarget = returnTarget;
  if (!shopInventoryByKey.has(shopKey)) {
    const ownedElements = playerProgress.unlockedSecondSkills;
    const { inventory, cycleReset } = createRestockedShopInventory({
      random: createSeededRandom(Date.now()),
      offeredElements: [...offeredShopElements],
      ownedElements,
      eligibleThirdSkillElements: playerProgress.unlockedSecondSkills,
      ownedThirdSkillElements: playerProgress.unlockedThirdSkills,
      offeredItemKeys: [...offeredShopItemKeys],
      includeHealing: true,
    });
    if (cycleReset) {
      offeredShopElements = new Set(ownedElements);
      offeredShopItemKeys = new Set();
    }
    inventory.filter((item) => item.type === "second-skill")
      .forEach((item) => offeredShopElements.add(item.element));
    inventory.filter((item) => item.type === "second-skill" || item.type === "third-skill")
      .forEach((item) => offeredShopItemKeys.add(item.id));
    shopInventoryByKey.set(shopKey, inventory);
  }
  activeShopInventory = shopInventoryByKey.get(shopKey);
  gameStarted = false;
  setMenuOpen(false);
  inputController.exitRuneMode();
  clearRuneAutoTarget();
  document.documentElement.dataset.screen = "shop";
  showOnlyScreen("shop-screen");
  const leaveButton = document.querySelector("#shop-leave-button");
  if (leaveButton) leaveButton.textContent = returnTarget === "final-room"
    ? "완료방으로 돌아가기"
    : returnTarget === "boss-map"
      ? "상점방으로 돌아가기"
      : "상점을 나와 다음 단계 선택";
  renderInputState();
  renderShop();
}

function applyRewardChoice(choice) {
  if (choice?.type !== "skill") return applyEventChoice(playerProgress, choice);
  const card = RUNE_CARDS.find((candidate) => candidate.id === choice.element);
  if (!card) return false;
  if (choice.skillTier === 2) {
    if (!playerProgress.unlockedSecondSkills.includes(choice.element)) {
      playerProgress.unlockedSecondSkills.push(choice.element);
    }
    addSecondSkillCardsToWarehouse(runeDeck, card, { copies: 2 });
  } else if (choice.skillTier === 3) {
    if (!playerProgress.unlockedThirdSkills.includes(choice.element)) {
      playerProgress.unlockedThirdSkills.push(choice.element);
    }
    addThirdSkillCardsToWarehouse(runeDeck, card, { copies: 1 });
  } else {
    return false;
  }
  return true;
}

function openRewardChoiceScreen({
  screen = "event",
  kickerText,
  headingText,
  descriptionText,
  choices,
  onContinue,
}) {
  const heading = document.querySelector("#node-room-heading");
  const kicker = document.querySelector("#node-room-kicker");
  const description = document.querySelector("#node-room-description");
  const continueButton = document.querySelector("#node-room-continue-button");
  const choicesContainer = document.querySelector("#node-room-choices");
  gameStarted = false;
  document.documentElement.dataset.screen = screen;
  showOnlyScreen("node-room-screen");
  if (kicker) kicker.textContent = kickerText;
  if (heading) heading.textContent = headingText;
  if (description) description.textContent = descriptionText;
  if (continueButton instanceof HTMLElement) {
    continueButton.textContent = "다음 단계 선택";
    continueButton.hidden = true;
    continueButton.onclick = onContinue;
  }
  if (!(choicesContainer instanceof HTMLElement)) return;
  let choiceMade = false;
  choicesContainer.replaceChildren(...choices.map((choice) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "event-choice-button";
    button.innerHTML = `<strong>${choice.label}</strong><span>${choice.description}</span>`;
    button.addEventListener("click", () => {
      if (choiceMade || !applyRewardChoice(choice)) return;
      choiceMade = true;
      if (worldSession) copyProgressToPlayer(playerProgress, worldSession.player);
      choicesContainer.querySelectorAll("button").forEach((candidate) => {
        candidate.disabled = true;
        candidate.classList.toggle("is-selected", candidate === button);
      });
      if (description) description.textContent = `${choice.label}: ${choice.description} 보상을 받았습니다.`;
      if (continueButton instanceof HTMLElement) continueButton.hidden = false;
      renderRuneCards();
      renderRuneSelection();
      updatePlayerHud();
    });
    return button;
  }));
}

function openNodeRoom(node) {
  const heading = document.querySelector("#node-room-heading");
  const kicker = document.querySelector("#node-room-kicker");
  const description = document.querySelector("#node-room-description");
  const continueButton = document.querySelector("#node-room-continue-button");
  const choicesContainer = document.querySelector("#node-room-choices");
  if (node.type === ExplorationNodeType.BOSS) {
    gameStarted = false;
    document.documentElement.dataset.screen = node.type;
    showOnlyScreen("node-room-screen");
    choicesContainer?.replaceChildren();
    if (kicker) kicker.textContent = `STAGE ${node.stage} · BOSS ROOM`;
    if (heading) heading.textContent = "보스방";
    if (description) description.textContent = `${node.stage}단계 최종 보스방입니다.`;
    if (continueButton instanceof HTMLElement) {
      continueButton.textContent = "타이틀로 돌아가기";
      continueButton.hidden = false;
      continueButton.onclick = returnToTitle;
    }
  } else {
    openRewardChoiceScreen({
      screen: node.type,
      kickerText: `STAGE ${node.stage} · EVENT NODE`,
      headingText: "선택지 노드",
      descriptionText: "두 보상 중 하나만 선택할 수 있습니다.",
      choices: createEventChoices({ random: createSeededRandom(Date.now()) }),
      onContinue: showExplorationScreen,
    });
  }
}

function enterExplorationNode(node) {
  if (node.type === ExplorationNodeType.COMBAT) {
    createCombatStage({ nodeStage: node.stage, nodeKey: node.id });
  } else if (node.type === ExplorationNodeType.SHOP) {
    openShop({ returnTarget: "exploration", shopKey: `exploration-${node.id}` });
  } else if (node.type === ExplorationNodeType.BOSS) {
    createCombatStage({ nodeStage: node.stage, bossNode: true, nodeKey: node.id });
  } else {
    openNodeRoom(node);
  }
}

function renderCurrentExplorationMap() {
  const graphContainer = document.querySelector("#exploration-graph");
  const status = document.querySelector("#exploration-status");
  if (!(graphContainer instanceof HTMLElement) || !explorationGraph || !explorationState) {
    return;
  }

  renderExplorationMap(graphContainer, explorationGraph, explorationState, (nodeId) => {
    const nextState = selectExplorationNode(explorationGraph, explorationState, nodeId);
    if (nextState === explorationState) {
      return;
    }
    explorationState = nextState;
    const node = explorationGraph.nodeById[nodeId];
    if (status) {
      const nodeLabel = { combat: "전투", shop: "상점", event: "선택지", boss: "보스 전투" }[node.type];
      status.textContent = `${nodeLabel} 노드를 선택했습니다. 뒤로 돌아갈 수 없습니다.`;
    }
    renderCurrentExplorationMap();
    enterExplorationNode(node);
  });
}

function prepareForRouteScreen() {
  syncProgressFromWorld();
  gameStarted = false;
  clearCombatState(combatState);
  setMenuOpen(false);
  inputController.exitRuneMode();
  clearRuneAutoTarget();
  setNpcMessage("");
}

function showExplorationScreen() {
  const explorationScreen = document.querySelector("#exploration-screen");
  if (!explorationGraph || !explorationState || !(explorationScreen instanceof HTMLElement)) {
    return;
  }
  prepareForRouteScreen();
  document.documentElement.dataset.screen = "exploration";
  showOnlyScreen("exploration-screen");
  const status = document.querySelector("#exploration-status");
  if (status) status.textContent = explorationState.availableNodeIds.length > 0
    ? "다음 단계의 연결된 노드를 선택하세요. 이전 단계로는 돌아갈 수 없습니다."
    : "마지막 단계에 도달했습니다.";
  renderInputState();
  renderCurrentExplorationMap();
}

/** 전투 완료 때 보상 하나를 고른 뒤 탐험 지도에 진입한다. */
export function completeCurrentStage() {
  if (!explorationGraph || !explorationState) return;
  prepareForRouteScreen();
  const rewardKey = String(currentCombatNodeKey ?? `combat-${currentCombatStage}`);
  if (!currentCombatIsBoss && !completedCombatRewardKeys.has(rewardKey)) {
    completedCombatRewardKeys.add(rewardKey);
    const random = createSeededRandom(Date.now());
    const regularChoices = createEventChoices({ random });
    const missingSkillChoice = createMissingSkillChoice({
      progress: playerProgress,
      cards: RUNE_CARDS,
      getName: getSkillName,
      random,
    });
    openRewardChoiceScreen({
      screen: "combat-reward",
      kickerText: `STAGE ${currentCombatStage} · COMBAT CLEAR`,
      headingText: "전투 노드 완료 보상",
      descriptionText: "다음 노드로 가기 전에 보상 하나를 선택하세요.",
      choices: missingSkillChoice ? [missingSkillChoice, regularChoices[0]] : regularChoices,
      onContinue: showExplorationScreen,
    });
    return;
  }
  showExplorationScreen();
}

function updateHandRoleGuide() {
  const reversed = inputController.state.handRolesReversed;
  const guide = document.querySelector("#menu-input-guide");
  const swapButton = document.querySelector("#menu-swap-hands-button");
  const drawingRole = document.querySelector("#drawing-hand-role");
  const movementRole = document.querySelector("#movement-hand-role");
  const runeInstruction = document.querySelector("#rune-mode-instruction");
  const menuMark = document.querySelector('[data-gesture-ui="menu"]');
  const miniMap = document.querySelector('[data-gesture-ui="mini-map"]');
  if (guide) {
    guide.textContent = reversed
      ? "WASD/방향키: 이동 · 좌클릭 드래그/Q·E: 카메라 · 양손 펼침: 룬 준비 · 오른손 주먹: 그리기"
      : "WASD/방향키: 이동 · 좌클릭 드래그/Q·E: 카메라 · 양손 펼침: 룬 준비 · 왼손 주먹: 그리기";
  }
  if (swapButton) {
    swapButton.setAttribute("aria-pressed", String(reversed));
  }
  if (drawingRole) drawingRole.textContent = reversed ? "왼손" : "오른손";
  if (movementRole) movementRole.textContent = reversed ? "오른손" : "왼손";
  if (runeInstruction) {
    runeInstruction.textContent = reversed
      ? "검지로 카드 선택 → 오른손 주먹으로 그리기 → 왼손 주먹으로 발동"
      : "검지로 카드 선택 → 왼손 주먹으로 그리기 → 오른손 주먹으로 발동";
  }
  menuMark?.setAttribute("aria-label", "게임 메뉴 열기");
  miniMap?.setAttribute("aria-label", "미니맵 클릭하여 확대");
}

function setMenuOpen(shouldOpen) {
  const menuPanel = document.querySelector("#menu-panel");
  menuOpen = Boolean(shouldOpen && gameStarted);
  document.documentElement.dataset.menuOpen = String(menuOpen);
  if (menuPanel instanceof HTMLElement) {
    menuPanel.hidden = !menuOpen;
  }
  if (!menuOpen) setHelpGuideOpen(false);
  if (menuOpen) {
    inputController.setSceneMovement({ x: 0, y: 0 });
  }
}

function getCurrentBoss() {
  if (!worldSession || !dungeon?.roomById[worldSession.currentRoomId]?.isBossRoom) return null;
  return (monstersByRoom[worldSession.currentRoomId] ?? []).find((monster) => monster.isBoss) ?? null;
}

function clearRuneAutoTarget() {
  if (worldSession) {
    worldSession.runeTargetId = null;
    worldSession.runeTargetFocus = null;
  }
  setDocumentState("runeTarget", false);
  if (lastRuneTargetOpacityCss !== "0") {
    lastRuneTargetOpacityCss = "0";
    document.documentElement.style.setProperty("--rune-target-opacity", "0");
  }
}

function updateRuneAutoTarget(elapsedMs = 0) {
  if (!worldSession || inputController.state.mode === GestureMode.EXPLORING) {
    clearRuneAutoTarget();
    return null;
  }
  const roomMonsters = monstersByRoom[worldSession.currentRoomId] ?? [];
  let target = roomMonsters.find((monster) => (
    monster.id === worldSession.runeTargetId
    && (monster.currentHealth ?? monster.stats.health) > 0
  ));
  if (!target) target = findClosestLivingEnemy(worldSession.player, roomMonsters);
  if (!target) {
    clearRuneAutoTarget();
    return null;
  }

  const targetPosition = target.position ?? target;
  const targetAimPoint = getRuneTargetAimPoint(target);
  worldSession.runeTargetId = target.id;
  worldSession.runeTargetFocus = {
    id: target.id,
    ...targetAimPoint,
  };
  const targetYaw = calculateTargetYaw(worldSession.player, targetPosition);
  worldSession.player.cameraYaw = interpolateTargetYaw(
    worldSession.player.cameraYaw,
    targetYaw,
    elapsedMs,
  );
  const yawDifference = Math.abs(Math.atan2(
    Math.sin(targetYaw - worldSession.player.cameraYaw),
    Math.cos(targetYaw - worldSession.player.cameraYaw),
  ));
  const lockProgress = Math.max(0, Math.min(1, 1 - yawDifference / (10 * Math.PI / 180)));
  const targetOpacityCss = (
    lockProgress * Math.max(0, Math.min(1, worldSession.player.runeZoomProgress ?? 0))
  ).toFixed(3);
  setDocumentState("runeTarget", true);
  if (targetOpacityCss !== lastRuneTargetOpacityCss) {
    lastRuneTargetOpacityCss = targetOpacityCss;
    document.documentElement.style.setProperty("--rune-target-opacity", targetOpacityCss);
  }
  return target;
}

function beginBossIntro(room) {
  const boss = getCurrentBoss();
  if (!boss || room.bossIntroPlayed) return;
  room.bossIntroPlayed = true;
  worldSession.bossDialogueCooldowns = {};
  worldSession.bossCinematic = {
    active: true,
    elapsedMs: 0,
    durationMs: 5200,
    focus: boss.position,
    combatDialogueShown: false,
  };
  inputController.setSceneMovement({ x: 0, y: 0 });
  const title = document.querySelector("#boss-intro-title");
  if (title instanceof HTMLElement) title.hidden = false;
  playAudioCue("bossIntro", { volume: 1 });
  startBackgroundMusic("boss");
  enqueueBossDialogue("appearance");
  updateStatus("타락한 정령왕이 모습을 드러냈습니다.");
}

function getBossHudElements() {
  if (bossHudElements) return bossHudElements;
  bossHudElements = {
    hud: document.querySelector("#boss-hud"),
    title: document.querySelector("#boss-intro-title"),
    fill: document.querySelector("#boss-health-fill"),
    lastFillSize: "",
  };
  return bossHudElements;
}

function updateBossPresentation(elapsedMs, boss = getCurrentBoss()) {
  const { hud, title, fill } = getBossHudElements();
  if (!(hud instanceof HTMLElement) || !(fill instanceof HTMLElement)) return false;
  if (hud.hidden === Boolean(boss)) hud.hidden = !boss;
  if (!boss) {
    if (title instanceof HTMLElement && !title.hidden) title.hidden = true;
    return false;
  }
  const cinematic = worldSession.bossCinematic;
  const wasActive = Boolean(cinematic?.active);
  if (cinematic?.active) {
    cinematic.elapsedMs = Math.min(cinematic.durationMs, cinematic.elapsedMs + elapsedMs);
    const progress = cinematic.elapsedMs / cinematic.durationMs;
    const introFill = Math.max(0, Math.min(1, (progress - 0.12) / 0.42));
    const fillSize = `${introFill * 100}%`;
    if (bossHudElements.lastFillSize !== fillSize) {
      fill.style.inlineSize = fillSize;
      bossHudElements.lastFillSize = fillSize;
    }
    if (title instanceof HTMLElement && title.hidden !== (progress > 0.68)) {
      title.hidden = progress > 0.68;
    }
    if (cinematic.elapsedMs >= cinematic.durationMs) {
      cinematic.active = false;
      if (!cinematic.combatDialogueShown) {
        cinematic.combatDialogueShown = true;
        enqueueBossDialogue("combatStart");
      }
      if (title instanceof HTMLElement && !title.hidden) title.hidden = true;
    }
  } else {
    const fillSize = `${Math.max(0, boss.currentHealth / boss.maximumHealth) * 100}%`;
    if (bossHudElements.lastFillSize !== fillSize) {
      fill.style.inlineSize = fillSize;
      bossHudElements.lastFillSize = fillSize;
    }
    if (title instanceof HTMLElement && !title.hidden) title.hidden = true;
  }
  return wasActive;
}

function setDeathDecisionOpen(shouldOpen) {
  const overlay = document.querySelector("#death-screen");
  deathDecisionOpen = Boolean(shouldOpen);
  if (overlay instanceof HTMLElement) overlay.hidden = !deathDecisionOpen;
  document.documentElement.dataset.playerDead = String(deathDecisionOpen);
  if (deathDecisionOpen) {
    stopUltimateBuffAudio();
    gameStarted = false;
    setMenuOpen(false);
    inputController.exitRuneMode();
    clearRuneAutoTarget();
    inputController.setSceneMovement({ x: 0, y: 0 });
  }
}

function showBossClearScreen() {
  if (clearScreenOpen || !worldSession) return;
  clearScreenOpen = true;
  playAudioCue("bossDefeat", { volume: 1 });
  document.documentElement.dataset.bossPhaseTwo = "false";
  gameStarted = false;
  setMenuOpen(false);
  inputController.exitRuneMode();
  clearRuneAutoTarget();
  inputController.setSceneMovement({ x: 0, y: 0 });
  const nickname = worldSession.player.nickname ?? playerProgress.nickname ?? "마법사";
  const clearScreen = document.querySelector("#clear-screen");
  const story = document.querySelector("#ending-story");
  const thanks = document.querySelector("#ending-thanks");
  if (story) {
    story.textContent = [
      "마지막 마법이 어둠을 갈랐다.",
      "타락한 정령왕은 긴 폭주에서 깨어났고, 정령과 요정들은 잃었던 빛을 되찾았다.",
      "돌아온 제자를 바라보며 스승 그리모어는 조용히 웃었다.",
      "“잘 돌아왔구나. 나의 자랑스러운 제자여.”",
      "그날부터 숲은 다시, 평화롭게 숨 쉬기 시작했다.",
    ].join("\n\n");
  }
  if (thanks) thanks.textContent = `감사합니다, ${nickname}!`;
  if (clearScreen instanceof HTMLElement) clearScreen.hidden = false;
  document.documentElement.dataset.gameCleared = "true";
}

function hideClearOverlays() {
  const clearScreen = document.querySelector("#clear-screen");
  if (clearScreen instanceof HTMLElement) clearScreen.hidden = true;
  clearScreenOpen = false;
  document.documentElement.dataset.gameCleared = "false";
}

function restartAtSpawnPoint() {
  if (!worldSession) return;
  resetPlayerAfterDeath(worldSession.player);
  copyPlayerToProgress(worldSession.player, playerProgress);
  monstersByRoom = cloneGameData(initialMonstersByRoom);
  for (const room of dungeon.rooms) {
    room.rocks = cloneGameData(initialRocksByRoom[room.id] ?? []);
    room.completionAnnounced = false;
    if (room.isBossRoom) room.bossIntroPlayed = false;
  }
  clearCombatState(combatState);
  respawnPlayer(worldSession);
  worldSession.bossCinematic = null;
  setDeathDecisionOpen(false);
  gameStarted = true;
  manualInputState.reset();
  applyManualExplorationInput();
  startBackgroundMusic("normal");
  document.documentElement.dataset.screen = "game";
  showOnlyScreen("world-ui");
  renderMiniMap();
  updatePlayerHud();
  updateStatus("기존 맵의 스폰포인트에서 다시 시작했습니다. 몬스터와 돌만 원상복구됐습니다.");
}

function returnToTitle() {
  gameStarted = false;
  manualInputState.reset();
  applyManualExplorationInput();
  stopHandTracking();
  stopBackgroundMusic();
  clearUltimateSequence();
  stopUltimateBuffAudio();
  hideClearOverlays();
  setDeathDecisionOpen(false);
  clearCombatState(combatState);
  setMenuOpen(false);
  inputController.exitRuneMode();
  clearRuneAutoTarget();
  setNpcMessage("");
  if (spawnPointNoticeTimer) window.clearTimeout(spawnPointNoticeTimer);
  document.querySelector("#spawn-point-notice")?.setAttribute("hidden", "");
  document.documentElement.dataset.screen = "title";
  document.documentElement.dataset.lowHealth = "false";
  document.documentElement.dataset.manaDraining = "false";
  document.documentElement.dataset.bossPhaseTwo = "false";
  document.documentElement.dataset.ultimateState = "inactive";
  showOnlyScreen("title-screen");
  renderInputState();
}

function startGame(nickname) {
  manualInputState.reset();
  applyManualExplorationInput();
  createStage(nickname);
  setMenuOpen(false);
  document.documentElement.dataset.screen = "game";
  updateStatus(`손짓 입력 준비 완료 · ${dungeon.rooms.length}개 방이 생성됐습니다.`);
  updateHandRoleGuide();
  renderInputState();
  const preview = new URLSearchParams(window.location.search).get("preview");
  if (preview === "boss") {
    createCombatStage({ nodeStage: 6, bossNode: true, nodeKey: "preview-boss" });
    worldSession.currentRoomId = dungeon.bossRoomId;
    worldSession.visitedRoomIds.add(dungeon.shopRoomId);
    worldSession.visitedRoomIds.add(dungeon.bossRoomId);
    worldSession.player.x = 0;
    worldSession.player.z = 5;
    worldSession.player.cameraYaw = 0;
    renderMiniMap();
    beginBossIntro(dungeon.roomById[dungeon.bossRoomId]);
  } else if (preview === "exploration") {
    completeCurrentStage();
  } else if (preview === "death" && worldSession) {
    worldSession.player.health = 0;
  } else if (preview === "event") {
    openNodeRoom({ type: ExplorationNodeType.EVENT, stage: 2 });
  } else if (preview === "shop") {
    playerProgress.gold = 200;
    if (worldSession) copyProgressToPlayer(playerProgress, worldSession.player);
    openShop({ returnTarget: "exploration", shopKey: "preview-shop" });
  } else if (preview === "shop3") {
    playerProgress.gold = 200;
    playerProgress.unlockedSecondSkills = ["fire", "water", "dark"];
    if (worldSession) copyProgressToPlayer(playerProgress, worldSession.player);
    openShop({ returnTarget: "exploration", shopKey: "preview-third-shop" });
  } else if (preview === "clear") {
    runElapsedMs = 125430;
    showBossClearScreen();
  } else if (preview === "effects" && worldSession) {
    worldSession.player.health = 29;
    worldSession.player.hitFlashMs = 5000;
    updatePlayerHud();
    showManaEmptyNotice();
  }
}

function setupAudioSettings() {
  const storageKey = "finger-mage-audio-volumes";
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (saved && typeof saved === "object") {
      Object.entries(saved).forEach(([category, volume]) => setAudioVolume(category, volume));
    }
  } catch {
    // 저장소를 사용할 수 없는 환경에서도 현재 세션의 음량 조절은 동작한다.
  }
  const syncControls = () => {
    const volumes = getAudioVolumes();
    document.querySelectorAll("[data-volume-category]").forEach((control) => {
      if (!(control instanceof HTMLInputElement)) return;
      const value = volumes[control.dataset.volumeCategory];
      if (!Number.isFinite(value)) return;
      control.value = String(Math.round(value * 100));
      const output = control.closest("label")?.querySelector("output");
      if (output) output.textContent = `${Math.round(value * 100)}%`;
    });
  };
  document.querySelectorAll("[data-volume-category]").forEach((control) => {
    control.addEventListener("input", () => {
      if (!(control instanceof HTMLInputElement)) return;
      setAudioVolume(control.dataset.volumeCategory, Number(control.value) / 100);
      syncControls();
      try { localStorage.setItem(storageKey, JSON.stringify(getAudioVolumes())); } catch {}
    });
  });
  syncControls();
}

function setupVideoSettings() {
  const storageKey = "finger-mage-video-settings";
  let settings = normalizeVideoSettings();
  try {
    settings = normalizeVideoSettings(JSON.parse(localStorage.getItem(storageKey) ?? "null") ?? {});
  } catch {
    // 저장소를 사용할 수 없어도 현재 세션에서는 비디오 설정이 동작한다.
  }
  const syncControls = () => {
    settings = applyVideoSettings(document.documentElement, settings);
    document.querySelectorAll("[data-video-setting]").forEach((control) => {
      if (!(control instanceof HTMLInputElement)) return;
      control.checked = Boolean(settings[control.dataset.videoSetting]);
    });
  };
  document.querySelectorAll("[data-video-setting]").forEach((control) => {
    control.addEventListener("change", () => {
      if (!(control instanceof HTMLInputElement)) return;
      settings = normalizeVideoSettings({
        ...settings,
        [control.dataset.videoSetting]: control.checked,
      });
      syncControls();
      try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch {}
    });
  });
  syncControls();
}

function setupTitleScreen() {
  const titleScreen = document.querySelector("#title-screen");
  const startButton = document.querySelector("#game-start-button");
  const settingsButton = document.querySelector("#settings-button");
  const exitButton = document.querySelector("#game-exit-button");
  const settings = document.querySelector("#title-settings");
  const titleStatus = document.querySelector("#title-status");
  const nicknameInput = document.querySelector("#nickname-input");

  if (titleScreen instanceof HTMLElement && GAME_ASSETS.titleBackground) {
    titleScreen.style.setProperty("--title-background-image", `url(${GAME_ASSETS.titleBackground})`);
  }
  startButton?.addEventListener("click", () => {
    const nickname = nicknameInput instanceof HTMLInputElement ? nicknameInput.value.trim() : "";
    if (nickname.length < 2 || nickname.length > 10) {
      if (titleStatus) titleStatus.textContent = "닉네임은 2글자 이상 10글자 이하로 입력하세요.";
      nicknameInput?.focus();
      return;
    }
    primeAudioSystem();
    startBackgroundMusic();
    startGame(nickname);
    void startHandTracking();
  });
  settingsButton?.addEventListener("click", () => {
    if (settings instanceof HTMLElement) {
      settings.hidden = !settings.hidden;
    }
  });
  exitButton?.addEventListener("click", () => {
    if (titleStatus) {
      titleStatus.textContent = "브라우저 탭을 닫으면 게임이 종료됩니다.";
    }
  });
  nicknameInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") startButton?.click();
  });
}

function setDeveloperConsoleStatus(message) {
  const status = document.querySelector("#developer-console-status");
  if (status) status.textContent = message;
}

function openDeveloperConsole() {
  const panel = document.querySelector("#developer-console");
  const input = document.querySelector("#developer-console-input");
  if (!(panel instanceof HTMLElement) || !panel.hidden) return;
  developerConsoleWasGameStarted = gameStarted;
  gameStarted = false;
  setMenuOpen(false);
  inputController.setSceneMovement({ x: 0, y: 0 });
  panel.hidden = false;
  setDeveloperConsoleStatus("명령어를 입력하세요.");
  if (input instanceof HTMLInputElement) {
    input.value = "";
    requestAnimationFrame(() => input.focus());
  }
}

function closeDeveloperConsole({ restoreGame = true } = {}) {
  const panel = document.querySelector("#developer-console");
  if (panel instanceof HTMLElement) panel.hidden = true;
  developerChordKeys.clear();
  if (restoreGame && developerConsoleWasGameStarted && worldSession) gameStarted = true;
}

function grantAllMagicCards() {
  const elements = RUNE_CARDS.map((card) => card.id);
  for (const card of RUNE_CARDS) {
    addSecondSkillCardsToWarehouse(runeDeck, card, { copies: 2 });
    addThirdSkillCardsToWarehouse(runeDeck, card, { copies: 1 });
  }
  playerProgress.unlockedSecondSkills = [...elements];
  playerProgress.unlockedThirdSkills = [...elements];
  if (worldSession) copyProgressToPlayer(playerProgress, worldSession.player);
  renderRuneCards();
  renderRuneSelection();
}

function jumpToDeveloperBoss() {
  createCombatStage({ nodeStage: 6, bossNode: true, nodeKey: `developer-boss-${Date.now()}` });
  const shopRoom = dungeon.roomById[dungeon.shopRoomId];
  const bossRoom = dungeon.roomById[dungeon.bossRoomId];
  if (shopRoom?.campfire) saveCampfireSpawnPoint(worldSession, shopRoom);
  worldSession.currentRoomId = bossRoom.id;
  worldSession.visitedRoomIds.add(shopRoom.id);
  worldSession.visitedRoomIds.add(bossRoom.id);
  worldSession.player.x = 0;
  worldSession.player.z = 5;
  worldSession.player.cameraYaw = 0;
  renderMiniMap();
  beginBossIntro(bossRoom);
  updateBossPresentation(0);
}

function jumpToClearedStageEnd() {
  const result = clearStageEndRoom({ dungeon, session: worldSession, monstersByRoom });
  if (!result) {
    setDeveloperConsoleStatus("현재 맵에는 황금방이 없습니다.");
    return false;
  }
  closeDeveloperConsole({ restoreGame: false });
  inputController.exitRuneMode();
  clearRuneAutoTarget();
  clearCombatState(combatState);
  currentStagePortalId = null;
  gameStarted = true;
  document.documentElement.dataset.screen = "game";
  showOnlyScreen("world-ui");
  startBackgroundMusic("normal");
  renderMiniMap();
  updatePlayerHud();
  renderRuneSelection();
  renderInputState();
  updateStatus(`개발자 명령으로 황금방 이동 · 적 ${result.defeatedCount}마리 처치 · 통로 개방`);
  return true;
}

function executeDeveloperCommand(command) {
  if (!worldSession) {
    setDeveloperConsoleStatus("먼저 게임을 시작해 주세요.");
    return;
  }
  if (command === "/상점") {
    closeDeveloperConsole({ restoreGame: false });
    openShop({ returnTarget: "developer", shopKey: `developer-shop-${Date.now()}` });
    return;
  }
  if (command === "/보스") {
    closeDeveloperConsole({ restoreGame: false });
    jumpToDeveloperBoss();
    return;
  }
  if (command === "/단계클리어") {
    jumpToClearedStageEnd();
    return;
  }
  const stageMatch = command.match(/^\/(\d+)단계$/);
  if (stageMatch) {
    const stage = Number(stageMatch[1]);
    if (!Number.isInteger(stage) || stage < 1 || stage > 6) {
      setDeveloperConsoleStatus("전투 단계는 1단계부터 6단계까지 입력해 주세요.");
      return;
    }
    closeDeveloperConsole({ restoreGame: false });
    createCombatStage({ nodeStage: stage, nodeKey: `developer-stage-${stage}-${Date.now()}` });
    updateStatus(`개발자 명령으로 ${stage}단계 전투방으로 이동했습니다.`);
    return;
  }
  if (command === "/모든마법") {
    syncProgressFromWorld();
    grantAllMagicCards();
    setDeveloperConsoleStatus("모든 속성의 1·2·3스킬 카드를 획득했습니다.");
    return;
  }
  if (command === "/궁극기") {
    worldSession.player.ultimate = worldSession.player.maximumUltimate ?? 100;
    copyPlayerToProgress(worldSession.player, playerProgress);
    updatePlayerHud();
    renderRuneCards();
    setDeveloperConsoleStatus("궁극기 게이지를 즉시 충전했습니다.");
    return;
  }
  if (command === "/체력무한") {
    syncProgressFromWorld();
    playerProgress.infiniteHealth = true;
    playerProgress.health = playerProgress.maximumHealth;
    copyProgressToPlayer(playerProgress, worldSession.player);
    updatePlayerHud();
    setDeveloperConsoleStatus("체력 무한을 활성화했습니다.");
    return;
  }
  if (command === "/공격력무한") {
    syncProgressFromWorld();
    setDeveloperAttackPower(playerProgress, worldSession.player);
    setDeveloperConsoleStatus("플레이어 공격력을 10000으로 설정했습니다.");
    return;
  }
  if (command === "/돈무한") {
    syncProgressFromWorld();
    playerProgress.infiniteGold = true;
    copyProgressToPlayer(playerProgress, worldSession.player);
    updatePlayerHud();
    setDeveloperConsoleStatus("돈 무한을 활성화했습니다. 구매해도 G가 줄지 않습니다.");
    return;
  }
  setDeveloperConsoleStatus("알 수 없는 명령어입니다.");
}

function setupDeveloperConsole() {
  const chordCodes = new Set(["KeyZ", "KeyU", "KeyN", "KeyY"]);
  const panel = document.querySelector("#developer-console");
  const form = document.querySelector("#developer-console-form");
  const input = document.querySelector("#developer-console-input");
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && panel instanceof HTMLElement && !panel.hidden) {
      event.preventDefault();
      closeDeveloperConsole();
      return;
    }
    if (!chordCodes.has(event.code)) return;
    developerChordKeys.add(event.code);
    if ([...chordCodes].every((code) => developerChordKeys.has(code))) {
      event.preventDefault();
      openDeveloperConsole();
    }
  });
  window.addEventListener("keyup", (event) => developerChordKeys.delete(event.code));
  window.addEventListener("blur", () => developerChordKeys.clear());
  document.querySelector("#developer-console-close")?.addEventListener("click", () => closeDeveloperConsole());
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!(input instanceof HTMLInputElement)) return;
    executeDeveloperCommand(input.value.trim());
    input.select();
  });
}

function beginHandRuneMode(castType, runeCanvas) {
  if (!(runeCanvas instanceof HTMLCanvasElement)) return false;
  if (!hasEnoughManaToCast(worldSession?.player)) {
    showManaEmptyNotice();
    updateStatus("마나가 30 이하라 마법을 시전할 수 없습니다.");
    return false;
  }
  if ((worldSession?.player.castCooldownMs ?? 0) > 0) {
    updateStatus(`마법 재사용 대기시간 ${Math.ceil(worldSession.player.castCooldownMs / 100) / 10}초`);
    return false;
  }
  const previousCastType = inputController.state.castType;
  if (!inputController.enterRuneMode(castType)) return false;
  updateRuneAutoTarget();
  triggerRuneCardFlip(previousCastType, castType);
  resetRuneSelection(runeCanvas);
  updateStatus("공격 룬 준비 · 사용할 카드를 클릭하세요.");
  renderInputState();
  return true;
}

function cancelHandRuneCast(runeCanvas, { insufficientMana = false } = {}) {
  if (!(runeCanvas instanceof HTMLCanvasElement)) return;
  endRuneStroke(runeTrace);
  handControlRuntime.lastRunePoint = null;
  inputController.exitRuneMode();
  clearRuneAutoTarget();
  resetRuneSelection(runeCanvas);
  renderInputState();
  if (castNoticeTimer) window.clearTimeout(castNoticeTimer);
  castNoticeTimer = null;
  const castNotice = document.querySelector("#world-cast-notice");
  if (castNotice instanceof HTMLElement) {
    castNotice.classList.remove("is-showing");
    castNotice.hidden = true;
  }
  if (insufficientMana) {
    showManaEmptyNotice();
    updateStatus("마나가 0이 되어 진행 중인 마법 시전이 취소됐습니다.");
  } else {
    updateStatus("마법 시전을 취소했습니다.");
  }
}

function finishHandRuneCast(runeCanvas) {
  if (!(runeCanvas instanceof HTMLCanvasElement)) return;
  const selectedCard = activeRuneCard;
  const selectedSkillTier = activeSkillTier;
  endRuneStroke(runeTrace);
  handControlRuntime.lastRunePoint = null;
  if (countRunePoints(runeTrace) < 2) {
    cancelHandRuneCast(runeCanvas);
    return;
  }
  if (!hasManaRemaining(worldSession?.player)) {
    cancelHandRuneCast(runeCanvas, { insufficientMana: true });
    return;
  }
  const runeStrokes = getLocalRuneStrokes(runeCanvas);
  const result = evaluateRuneAttempt(runeCanvas);
  inputController.exitRuneMode();
  clearRuneAutoTarget();

  if (selectedCard?.isUltimate) {
    handleUltimateRuneFinish(runeCanvas, result, runeStrokes);
    renderInputState();
    return;
  }
  if (result?.succeeded && selectedCard && worldSession) {
    spawnPlayerMagic(combatState, worldSession, selectedCard.id, {
      damage: result.damage,
      runeStrokes,
      room: dungeon?.roomById[worldSession.currentRoomId] ?? null,
      skillTier: selectedSkillTier,
      monsters: monstersByRoom[worldSession.currentRoomId] ?? [],
    });
    if (selectedSkillTier === 3 && selectedCard.id === "light") {
      playMagicAudio(selectedCard.id, { playElement: false });
      playFadingAudioCue("lightBeam", { durationMs: 3000, fadeOutMs: 850, volume: 0.92 });
    } else if (selectedSkillTier === 3 && selectedCard.id === "water") {
      playMagicAudio(selectedCard.id, { playElement: false });
      playAudioCue("waterWave", { volume: 0.96 });
    } else if (selectedSkillTier === 3 && selectedCard.id === "electric") {
      playMagicAudio(selectedCard.id, { playElement: false });
      playAudioCue("electricThird", { volume: 0.96 });
    } else {
      playMagicAudio(selectedCard.id, { playElement: selectedCard.id !== "rock" });
    }
    startPlayerCastCooldown(worldSession.player);
    runeRefreshUsesRemaining = Math.max(0, runeRefreshUsesRemaining - 1);
    showWorldCastNotice(selectedCard, result.accuracy, {
      damage: result.damage,
    });
    updateStatus(`${selectedCard.label} 마법 발동 · 피해 ${result.damage} · 정확도 ${result.accuracy}%`);
  } else if (result && selectedCard) {
    showWorldCastNotice(selectedCard, result.accuracy, { failed: true });
    updateStatus(`마법 실패 · 그림 정확도 ${result.accuracy}% · 30%를 넘어야 합니다.`);
  } else {
    updateStatus("카드와 룬 궤적이 없어 시전을 취소했습니다.");
  }
  if (selectedCard && result) {
    rotateUsedRuneCard(runeDeck, selectedCard.deckId ?? selectedCard.id);
    renderRuneCards();
  }
  activeRuneCard = null;
  activeSkillTier = 1;
  clearRuneTrace(runeTrace);
  drawRuneTrace(runeCanvas, runeTrace);
  renderRuneSelection();
  renderInputState();
}

function applyManualExplorationInput() {
  inputController.setSceneInput(manualInputState.getSceneInput());
}

function setupManualExplorationControls() {
  const isTextEntry = (target) => (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target?.isContentEditable
  );

  window.addEventListener("keydown", (event) => {
    if (isTextEntry(event.target)) return;
    if (event.key === "Escape" && gameStarted) {
      const helpGuide = document.querySelector("#help-guide");
      if (helpGuide instanceof HTMLElement && !helpGuide.hidden) {
        setHelpGuideOpen(false);
      } else {
        setMenuOpen(!menuOpen);
      }
      event.preventDefault();
      return;
    }
    if (!manualInputState.setKey(event.code, true)) return;
    event.preventDefault();
    applyManualExplorationInput();
  });

  window.addEventListener("keyup", (event) => {
    if (!manualInputState.setKey(event.code, false)) return;
    event.preventDefault();
    applyManualExplorationInput();
  });

  window.addEventListener("blur", () => {
    manualInputState.reset();
    applyManualExplorationInput();
  });
}

function setupPointerCameraControls(worldCanvas) {
  let activePointerId = null;
  let lastPointerX = 0;

  const endDrag = (event = null) => {
    if (event && activePointerId !== null && event.pointerId !== activePointerId) return;
    if (activePointerId !== null && worldCanvas.hasPointerCapture?.(activePointerId)) {
      worldCanvas.releasePointerCapture(activePointerId);
    }
    activePointerId = null;
    document.documentElement.dataset.cameraDragging = "false";
  };

  worldCanvas.addEventListener("pointerdown", (event) => {
    if (
      event.button !== 0
      || !gameStarted
      || menuOpen
      || inputController.state.mode !== GestureMode.EXPLORING
      || worldSession?.bossCinematic?.active
    ) return;
    activePointerId = event.pointerId;
    lastPointerX = event.clientX;
    worldCanvas.setPointerCapture?.(event.pointerId);
    document.documentElement.dataset.cameraDragging = "true";
    event.preventDefault();
  });

  worldCanvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== activePointerId) return;
    if (
      !worldSession
      || menuOpen
      || inputController.state.mode !== GestureMode.EXPLORING
    ) {
      endDrag(event);
      return;
    }
    const deltaX = event.clientX - lastPointerX;
    lastPointerX = event.clientX;
    rotateWorldCamera(worldSession, calculatePointerCameraTurn(deltaX));
    event.preventDefault();
  });

  worldCanvas.addEventListener("pointerup", endDrag);
  worldCanvas.addEventListener("pointercancel", endDrag);
  window.addEventListener("blur", () => endDrag());

  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  window.addEventListener("pointerdown", (event) => {
    if (event.button !== 2) return;
    endDrag();
    event.preventDefault();
  }, { capture: true });
}

function setupGestureControls(runeCanvas) {
  document.querySelector('[data-gesture-ui="menu"]')?.addEventListener("click", () => {
    setMenuOpen(true);
    updateStatus("게임 메뉴를 열었습니다.");
  });
  const miniMap = document.querySelector('[data-gesture-ui="mini-map"]');
  const toggleMiniMap = () => {
    if (!(miniMap instanceof HTMLElement)) return;
    miniMap.classList.toggle("is-expanded");
    updateStatus(miniMap.classList.contains("is-expanded") ? "미니맵을 확대했습니다." : "미니맵을 축소했습니다.");
  };
  miniMap?.addEventListener("click", toggleMiniMap);
  miniMap?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    toggleMiniMap();
  });

  document.querySelector("#menu-resume-button")?.addEventListener("click", () => {
    setMenuOpen(false);
    applyManualExplorationInput();
    updateStatus("게임으로 돌아왔습니다.");
  });
  document.querySelector("#menu-settings-button")?.addEventListener("click", () => {
    const settings = document.querySelector("#menu-audio-settings");
    if (settings instanceof HTMLElement) settings.hidden = !settings.hidden;
  });
  document.querySelector("#menu-video-settings-button")?.addEventListener("click", () => {
    const settings = document.querySelector("#menu-video-settings");
    if (settings instanceof HTMLElement) settings.hidden = !settings.hidden;
  });
  document.querySelector("#menu-help-button")?.addEventListener("click", () => {
    setHelpGuideOpen(true);
  });
  document.querySelector("#help-guide-close")?.addEventListener("click", () => setHelpGuideOpen(false));
  document.querySelector("#help-guide-previous")?.addEventListener("click", () => {
    helpGuidePageIndex = Math.max(0, helpGuidePageIndex - 1);
    renderHelpGuidePage();
  });
  document.querySelector("#help-guide-next")?.addEventListener("click", () => {
    helpGuidePageIndex = Math.min(HELP_GUIDE_PAGES.length - 1, helpGuidePageIndex + 1);
    renderHelpGuidePage();
  });
  document.querySelector("#menu-swap-hands-button")?.addEventListener("click", () => {
    const reversed = inputController.toggleHandRoles();
    try {
      localStorage.setItem("finger-mage-hand-roles-reversed", String(reversed));
    } catch {
      // 저장소가 막혀 있어도 현재 플레이에서는 반전 상태가 유지된다.
    }
    resetHandControlRuntime({ preserveLastSeen: true });
    if (worldSession && !npcConversationStarted) {
      worldSession.npc.dialogues = createGuideDialogues({
        nickname: worldSession.player.nickname,
        handRolesReversed: reversed,
      });
    }
    updateHandRoleGuide();
    updateStatus(reversed
      ? "손 역할을 반전했습니다. 왼손은 룬·UI·발동, 오른손 주먹은 룬 그리기입니다."
      : "기본 손 역할로 돌아왔습니다. 오른손은 룬·UI·발동, 왼손 주먹은 룬 그리기입니다.");
  });
  document.querySelector("#menu-exit-button")?.addEventListener("click", () => {
    returnToTitle();
  });
  document.querySelector("#death-respawn-button")?.addEventListener("click", restartAtSpawnPoint);
  document.querySelector("#death-exit-button")?.addEventListener("click", returnToTitle);
  document.querySelector("#clear-title-button")?.addEventListener("click", returnToTitle);
  document.querySelector("#clear-exit-button")?.addEventListener("click", () => {
    window.close();
    returnToTitle();
    const titleStatus = document.querySelector("#title-status");
    if (titleStatus) titleStatus.textContent = "브라우저가 자동으로 닫히지 않으면 탭을 닫아 게임을 종료하세요.";
  });
  document.querySelector("#shop-leave-button")?.addEventListener("click", () => {
    if ((shopReturnTarget === "final-room" || shopReturnTarget === "boss-map" || shopReturnTarget === "developer") && worldSession) {
      copyProgressToPlayer(playerProgress, worldSession.player);
      // 같은 통로에 즉시 재진입하지 않도록 완료방 중앙으로 돌아온다.
      if (shopReturnTarget === "boss-map") {
        worldSession.player.x = worldSession.spawnPoint.x;
        worldSession.player.z = worldSession.spawnPoint.z;
        worldSession.player.facing = worldSession.spawnPoint.facing;
        worldSession.player.facingYaw = worldSession.spawnPoint.facingYaw;
        worldSession.player.cameraYaw = worldSession.spawnPoint.cameraYaw;
      } else if (shopReturnTarget !== "developer") {
        worldSession.player.x = 0;
        worldSession.player.z = 0;
      }
      currentStagePortalId = null;
      gameStarted = true;
      applyManualExplorationInput();
      document.documentElement.dataset.screen = "game";
      showOnlyScreen("world-ui");
      updateStatus(shopReturnTarget === "boss-map"
        ? "모닥불이 있는 상점방의 스폰포인트로 돌아왔습니다."
        : shopReturnTarget === "developer"
          ? "개발자 상점을 닫고 게임으로 돌아왔습니다."
          : "상점에서 완료방으로 돌아왔습니다.");
      if (shopReturnTarget === "boss-map") showSpawnPointNotice();
      updatePlayerHud();
      renderInputState();
    } else {
      showExplorationScreen();
    }
  });

  new ResizeObserver(() => drawRuneTrace(runeCanvas, runeTrace)).observe(runeCanvas);
}

function bootApp() {
  document.documentElement.dataset.appVersion = APP_VERSION;
  document.documentElement.dataset.inputSource = "hybrid-camera-keyboard";
  document.documentElement.dataset.screen = "title";
  document.documentElement.dataset.menuOpen = "false";
  document.documentElement.dataset.cameraDragging = "false";
  try {
    const storedSchema = localStorage.getItem("finger-mage-hand-control-schema");
    const shouldResetRoles = storedSchema !== HAND_CONTROL_SCHEMA_VERSION;
    inputController.setHandRolesReversed(
      shouldResetRoles
        ? false
        : localStorage.getItem("finger-mage-hand-roles-reversed") === "true",
    );
    if (shouldResetRoles) {
      localStorage.setItem("finger-mage-hand-control-schema", HAND_CONTROL_SCHEMA_VERSION);
      localStorage.setItem("finger-mage-hand-roles-reversed", "false");
    }
  } catch {
    inputController.setHandRolesReversed(false);
  }
  const worldCanvas = document.querySelector("#world-canvas");
  const runeCanvas = document.querySelector("#rune-canvas");
  if (!(worldCanvas instanceof HTMLCanvasElement) || !(runeCanvas instanceof HTMLCanvasElement)) {
    throw new Error("게임 화면을 찾을 수 없습니다.");
  }

  setupTitleScreen();
  setupAudioSettings();
  setupVideoSettings();
  setupRuneCards(runeCanvas);
  setupManualExplorationControls();
  setupPointerCameraControls(worldCanvas);
  setupGestureControls(runeCanvas);
  setupDeveloperConsole();
  window.addEventListener("beforeunload", stopHandTracking, { once: true });
  updateHandRoleGuide();
  renderInputState();
  const gameLoop = (timestamp) => {
    const elapsedMs = Math.min(timestamp - lastSceneFrameTime, 100);
    lastSceneFrameTime = timestamp;
    if (gameStarted && dungeon && worldSession) {
      miniMapUpdateAccumulatorMs += elapsedMs;
      hudUpdateAccumulatorMs += elapsedMs;
      worldRenderAccumulatorMs = Math.min(
        WORLD_RENDER_INTERVAL_MS * 2,
        worldRenderAccumulatorMs + elapsedMs,
      );
      const currentBoss = getCurrentBoss();
      const bossPhaseTwo = isBossPhaseTwo(currentBoss);
      setDocumentState("bossPhaseTwo", bossPhaseTwo);
      updateUltimatePresentationState();
      const previousRoomId = worldSession.currentRoomId;
      const cinematicActive = updateBossPresentation(elapsedMs, currentBoss);
      updateRuneAutoTarget(elapsedMs);
      const zoomTarget = inputController.state.mode === GestureMode.EXPLORING ? 0 : 1;
      const zoomProgress = worldSession.player.runeZoomProgress ?? 0;
      const zoomStep = Math.min(1, elapsedMs / (zoomTarget > zoomProgress ? 260 : 360));
      const interpolatedZoom = zoomProgress + (zoomTarget - zoomProgress) * zoomStep;
      worldSession.player.runeZoomProgress = Math.abs(zoomTarget - interpolatedZoom) < 0.001
        ? zoomTarget
        : interpolatedZoom;
      const runeViewProgressCss = worldSession.player.runeZoomProgress.toFixed(4);
      if (runeViewProgressCss !== lastRuneViewProgressCss) {
        lastRuneViewProgressCss = runeViewProgressCss;
        document.documentElement.style.setProperty("--rune-view-progress", runeViewProgressCss);
      }
      if (!menuOpen && !cinematicActive) runElapsedMs += elapsedMs;
      if (!menuOpen && !cinematicActive) {
        const beforeMove = { x: worldSession.player.x, z: worldSession.player.z };
        const rawSceneInput = inputController.getSceneInput();
        const sceneInput = (worldSession.player.immobilizedMs ?? 0) > 0
          ? { ...rawSceneInput, isMoving: false, moveVector: { x: 0, y: 0 } }
          : rawSceneInput;
        updatePlayerCastCooldown(worldSession.player, elapsedMs);
        const wasDrawingRune = inputController.state.mode === GestureMode.DRAWING;
        updatePlayerMana(worldSession.player, elapsedMs, {
          isDrawing: wasDrawingRune,
          drawDrainMultiplier: bossPhaseTwo ? 2 : 1,
        });
        if (shouldCancelRuneDrawing(worldSession.player, wasDrawingRune)) {
          runePointerId = null;
          cancelHandRuneCast(runeCanvas, { insufficientMana: true });
        }
        updateWorldSession(
          worldSession,
          dungeon,
          {
            ...sceneInput,
            cameraTurn: (sceneInput.cameraTurn ?? 0) * (elapsedMs / 1000) * 1.65,
          },
          elapsedMs,
          {
            canLeaveCurrentRoom: (room) => (room.type !== "combat" && room.type !== "boss")
              || (monstersByRoom[room.id] ?? []).every((monster) => (
                (monster.currentHealth ?? monster.stats.health) <= 0
              )),
          },
        );
        updatePlayerFootsteps(
          Math.hypot(worldSession.player.x - beforeMove.x, worldSession.player.z - beforeMove.z),
          elapsedMs,
        );
      } else {
        playerFootstepTimerMs = 0;
      }
      if (worldSession.lastWorldEvent?.type === "door-locked") {
        updateStatus("이 방의 몬스터를 모두 처치해야 문이 열립니다.");
        worldSession.lastWorldEvent = null;
      }
      if (previousRoomId !== worldSession.currentRoomId) {
        clearCombatState(combatState);
        currentStagePortalId = null;
        renderMiniMap();
        const enteredRoom = dungeon.roomById[worldSession.currentRoomId];
        if (enteredRoom.isBossRoom) {
          beginBossIntro(enteredRoom);
          updateBossPresentation(0);
        } else if (enteredRoom.type === "shop") {
          if (enteredRoom.campfire) saveCampfireSpawnPoint(worldSession, enteredRoom);
          startBackgroundMusic("normal");
          openShop({ returnTarget: "boss-map", shopKey: `boss-shop-${currentCombatNodeKey}` });
          requestAnimationFrame(gameLoop);
          return;
        } else {
          updateStatus(`${worldSession.currentRoomId}에 들어왔습니다.`);
        }
      }
      if (!menuOpen && !cinematicActive && !worldSession.bossCinematic?.active) {
        const combatRoom = dungeon.roomById[worldSession.currentRoomId];
        updateCombatState(combatState, {
          monsters: monstersByRoom[worldSession.currentRoomId] ?? [],
          session: worldSession,
          room: combatRoom,
          elapsedMs,
          enemyTimeScale: getEnemyTimeScaleForInputMode(inputController.state.mode, {
            isBoss: currentCombatIsBoss,
            isUltimate: Boolean(ultimateSequence),
          }),
        });
        playPendingCombatSounds();
      }
      if (combatState.lastEvent?.type === "player-hit") {
        const hitMonster = (monstersByRoom[worldSession.currentRoomId] ?? [])
          .find((monster) => monster.id === combatState.lastEvent.monsterId);
        if (
          hitMonster?.isBoss
          && combatState.lastEvent.damage >= 100
          && !combatState.lastEvent.defeated
        ) {
          enqueueBossDialogue("heavyHit", { cooldownMs: 7000 });
        }
        if (hitMonster) {
          playSpatialCue("hit", {
            distance: Math.hypot(hitMonster.position.x - worldSession.player.x, hitMonster.position.z - worldSession.player.z),
            baseVolume: 0.8,
          });
        }
        const dropText = combatState.lastEvent.defeated
          ? ` · 처치 · ${combatState.lastEvent.goldDropped ?? 0}G 드롭${combatState.lastEvent.heartDropped ? " · 하트 드롭" : ""}`
          : "";
        updateStatus(`${hitMonster?.name ?? "적"}에게 ${combatState.lastEvent.damage} 피해 · 남은 체력 ${combatState.lastEvent.remainingHealth}${dropText}`);
        combatState.lastEvent = null;
      } else if (combatState.lastEvent?.type === "enemy-hit") {
        playAudioCue("hit", { volume: 0.92 });
        updateStatus(`적 마법에 ${combatState.lastEvent.damage} 피해 · 플레이어 체력 ${combatState.lastEvent.remainingHealth}`);
        combatState.lastEvent = null;
      } else if (combatState.lastEvent?.type === "enemy-melee-hit") {
        playAudioCue("hit", { volume: 0.92 });
        updateStatus(`적 근접 공격에 ${combatState.lastEvent.damage} 피해 · 플레이어 체력 ${combatState.lastEvent.remainingHealth}`);
        combatState.lastEvent = null;
      } else if (combatState.lastEvent?.type === "enemy-area-hit") {
        playAudioCue("hit", { volume: 0.92 });
        updateStatus(`적 범위 공격에 ${combatState.lastEvent.damage} 피해 · 플레이어 체력 ${combatState.lastEvent.remainingHealth}`);
        combatState.lastEvent = null;
      } else if (combatState.lastEvent?.type === "enemy-contact-hit") {
        playAudioCue("hit", { volume: 0.92 });
        updateStatus(`슬라임과 충돌해 ${combatState.lastEvent.damage} 피해 · 플레이어 체력 ${combatState.lastEvent.remainingHealth}`);
        combatState.lastEvent = null;
      } else if (combatState.lastEvent?.type === "gold-collected") {
        playAudioCue("coinPickup", { volume: 0.9 });
        updateStatus(`${combatState.lastEvent.amount}G 획득 · 보유 ${combatState.lastEvent.totalGold}G`);
        combatState.lastEvent = null;
      } else if (combatState.lastEvent?.type === "heart-collected") {
        playAudioCue("potionDrink", { volume: 0.9 });
        updateStatus(`하트 획득 · 체력 ${combatState.lastEvent.healed} 회복 · 현재 ${combatState.lastEvent.currentHealth}`);
        combatState.lastEvent = null;
      }
      const activeRoom = dungeon.roomById[worldSession.currentRoomId];
      const defeatedBoss = activeRoom?.isBossRoom
        ? (monstersByRoom[worldSession.currentRoomId] ?? []).find((monster) => monster.isBoss)
        : null;
      if (defeatedBoss && (defeatedBoss.currentHealth ?? defeatedBoss.stats.health) <= 0) {
        copyPlayerToProgress(worldSession.player, playerProgress);
        updatePlayerHud();
        drawRoomScene(worldCanvas, {
          dungeon,
          session: worldSession,
          monstersByRoom,
          combatState,
          assets: GAME_ASSETS,
        });
        showBossClearScreen();
        requestAnimationFrame(gameLoop);
        return;
      }
      if (worldSession.player.health <= 0) {
        copyPlayerToProgress(worldSession.player, playerProgress);
        setDeathDecisionOpen(true);
        resetRuneSelection(runeCanvas);
        renderInputState();
        updatePlayerHud();
        drawRoomScene(worldCanvas, {
          dungeon,
          session: worldSession,
          monstersByRoom,
          combatState,
          assets: GAME_ASSETS,
        });
        requestAnimationFrame(gameLoop);
        return;
      }

      const currentRoom = dungeon.roomById[worldSession.currentRoomId];
      const roomCleared = (monstersByRoom[worldSession.currentRoomId] ?? []).every((monster) => (
        (monster.currentHealth ?? monster.stats.health) <= 0
      ));
      if (currentRoom.isStageEnd && roomCleared && !currentRoom.completionAnnounced) {
        currentRoom.completionAnnounced = true;
        updateStatus("전투 노드 완료 · 상점 통로와 다음 스테이지 통로가 열렸습니다.");
      }
      const enteredPortal = findEnteredStagePortal(worldSession, currentRoom, roomCleared);
      if (!enteredPortal) {
        currentStagePortalId = null;
      } else if (enteredPortal.id !== currentStagePortalId) {
        currentStagePortalId = enteredPortal.id;
        if (enteredPortal.type === "shop") {
          openShop({ returnTarget: "final-room", shopKey: `combat-${currentCombatNodeKey}` });
        } else {
          completeCurrentStage();
        }
      }

      if (worldSession.npcNearby) beginNpcDialogueSequence();
      if (hudUpdateAccumulatorMs >= HUD_UPDATE_INTERVAL_MS) {
        hudUpdateAccumulatorMs = 0;
        updatePlayerHud();
      }
      if (miniMapUpdateAccumulatorMs >= MINI_MAP_UPDATE_INTERVAL_MS) {
        miniMapUpdateAccumulatorMs = 0;
        updateMiniMapEntities();
      }
      if (!menuOpen && worldRenderAccumulatorMs >= WORLD_RENDER_INTERVAL_MS) {
        worldRenderAccumulatorMs %= WORLD_RENDER_INTERVAL_MS;
        drawRoomScene(worldCanvas, {
          dungeon,
          session: worldSession,
          monstersByRoom,
          combatState,
          assets: GAME_ASSETS,
        });
        if (inputController.state.mode !== GestureMode.EXPLORING || runeTrace.sparks.length > 0) {
          drawRuneTrace(runeCanvas, runeTrace);
        }
      }
    }
    requestAnimationFrame(gameLoop);
  };
  requestAnimationFrame(gameLoop);
}

try {
  bootApp();
} catch (error) {
  const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  updateStatus(`초기화 오류: ${message}`);
}
