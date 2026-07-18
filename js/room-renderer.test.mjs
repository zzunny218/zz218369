import assert from "node:assert/strict";
import test from "node:test";
import { createSeededRandom, generateDungeon } from "./dungeon-generator.js";
import { calculateBillboardHeight, calculateBillboardWidth, drawRoomScene, getMonsterBillboardOpacity, getMonsterDisplayLabel, getThirdPersonCamera, getWallTextureWorldPoint } from "./room-renderer.js";
import { ROOM_HALF_SIZE, createWorldSession, rotateWorldCamera } from "./world-session.js";

test("몬스터 이미지는 히트박스 크기에 찌그러지지 않고 원본 종횡비를 유지한다", () => {
  assert.equal(calculateBillboardWidth({ billboardHeight: 120, widthRatio: 0.64, imageWidth: 512, imageHeight: 512 }), 120);
  assert.equal(calculateBillboardWidth({ billboardHeight: 120, widthRatio: 0.64, imageWidth: 600, imageHeight: 800 }), 90);
});

test("슬라임은 80% 불투명도로 표시되고 노말 적 이름에는 속성명이 붙지 않는다", () => {
  assert.equal(getMonsterBillboardOpacity({ templateId: "slime" }), 0.8);
  assert.equal(getMonsterBillboardOpacity({ templateId: "bigSlime" }), 0.8);
  assert.equal(getMonsterBillboardOpacity({ templateId: "fairy" }), 1);
  assert.equal(getMonsterDisplayLabel({ element: "normal", name: "슬라임" }), "슬라임");
  assert.equal(getMonsterDisplayLabel({ element: "fire", name: "슬라임" }), "불의 슬라임");
  assert.equal(getMonsterDisplayLabel({ element: "dark", name: "타락한 정령왕", isBoss: true }), "타락한 정령왕");
});

test("보스 확대 연출 카메라는 이전보다 낮은 높이로 내려간다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(22) });
  const session = createWorldSession(dungeon);
  session.bossCinematic = { active: true, elapsedMs: 2600, durationMs: 5200, focus: { x: 0, y: 0, z: 0 } };
  assert.equal(getThirdPersonCamera(session).y, 1.1);
});

test("3인칭 카메라는 플레이어가 벽에 붙어도 방 밖으로 넘어가지 않는다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(14) });
  const session = createWorldSession(dungeon);
  session.player.x = ROOM_HALF_SIZE - 0.25;
  session.player.z = ROOM_HALF_SIZE - 0.25;
  session.player.cameraYaw = 0;
  const camera = getThirdPersonCamera(session);
  assert.ok(camera.x < ROOM_HALF_SIZE);
  assert.ok(camera.z < ROOM_HALF_SIZE);
});

test("룬 그리기 줌 진행도에 따라 카메라가 발사 방향으로 부드럽게 가까워진다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(24) });
  const session = createWorldSession(dungeon);
  session.player.x = 0;
  session.player.z = 0;
  session.player.cameraYaw = 0;
  session.player.runeZoomProgress = 0;
  const normal = getThirdPersonCamera(session);
  session.player.runeZoomProgress = 1;
  const zoomed = getThirdPersonCamera(session);
  assert.ok(Math.hypot(zoomed.x, zoomed.z) < Math.hypot(normal.x, normal.z));
  assert.ok(zoomed.y < normal.y);
});

test("카메라 회전은 플레이어의 실제 월드 위치를 변경하지 않는다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(15) });
  const session = createWorldSession(dungeon);
  const position = { x: session.player.x, z: session.player.z };
  rotateWorldCamera(session, Math.PI / 2);
  assert.deepEqual({ x: session.player.x, z: session.player.z }, position);
});

test("벽 그림의 기준점은 카메라 회전과 무관한 월드 좌표에 고정된다", () => {
  const dungeon = generateDungeon({ random: createSeededRandom(18) });
  const session = createWorldSession(dungeon);
  const before = getWallTextureWorldPoint("north", 0.35, 0.4);
  rotateWorldCamera(session, Math.PI / 2);
  const after = getWallTextureWorldPoint("north", 0.35, 0.4);
  assert.deepEqual(after, before);
  assert.equal(before.z, -ROOM_HALF_SIZE);
});

test("NPC·돌·적 빌보드는 멀어질수록 같은 원근식으로 계속 작아진다", () => {
  const nearHeight = calculateBillboardHeight({ focal: 900, worldHeight: 1.4, depth: 4, canvasHeight: 720 });
  const farHeight = calculateBillboardHeight({ focal: 900, worldHeight: 1.4, depth: 45, canvasHeight: 720 });
  assert.ok(nearHeight > farHeight);
  assert.ok(farHeight < 34);
});

test("레이저·낙뢰·파도·메테오·공중 블랙홀과 보스 경고가 있는 프레임을 예외 없이 렌더링한다", () => {
  globalThis.window = { devicePixelRatio: 1 };
  const dungeon = generateDungeon({ random: createSeededRandom(31) });
  const session = createWorldSession(dungeon);
  const gradient = { addColorStop() {} };
  const context = {
    clearRect() {}, createLinearGradient: () => gradient, fillRect() {}, beginPath() {},
    moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, save() {}, restore() {},
    translate() {}, rotate() {}, arc() {}, rect() {}, bezierCurveTo() {}, ellipse() {},
    roundRect() {}, drawImage() {}, fillText() {},
  };
  const canvas = {
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: 1280, height: 720 }),
    getContext: () => context,
  };
  context.canvas = canvas;
  const baseLaser = {
    owner: "player",
    roomId: session.currentRoomId,
    x: session.player.x,
    y: 0.92,
    z: session.player.z,
    direction: { x: 0, z: -1 },
    length: 4,
    lifeMs: 300,
    maximumLifeMs: 480,
  };
  assert.doesNotThrow(() => drawRoomScene(canvas, {
    dungeon,
    session,
    monstersByRoom: {},
    combatState: {
      lasers: [
        { ...baseLaser, id: "electric", element: "electric", isLightning: true },
        { ...baseLaser, id: "light", element: "light", isLightning: false },
      ],
      verticalLightnings: [{
        id: "vertical-electric", roomId: session.currentRoomId, x: 0, y: 0.5, z: -2,
        topY: 5.8, element: "electric", lifeMs: 500, maximumLifeMs: 620, phase: 0,
      }],
      groundMagicCircles: [{
        id: "summon-circle", roomId: session.currentRoomId, x: 1, y: 0.025, z: -2,
        radius: 1, element: "dark", lifeMs: 800, maximumLifeMs: 1200,
      }],
      projectiles: [], particles: [], castEffects: [],
      waves: [{
        id: "wave", roomId: session.currentRoomId, x: 0, y: 0.2, z: -2,
        direction: { x: 0, z: -1 }, width: 8, thickness: 1.3,
      }],
      blackHoles: [{
        id: "black-hole", roomId: session.currentRoomId, x: 2, y: 1.55, z: -3,
        coreRadius: 1.25,
      }],
      meteors: [{ id: "meteor", roomId: session.currentRoomId, x: -2, y: 3, z: -3 }],
      trajectoryWarnings: [{
        id: "trajectory", roomId: session.currentRoomId, x: 0, y: 0.028, z: 0,
        direction: { x: 0, z: -1 }, length: 5, width: 0.2, element: "fire",
        lifeMs: 800, maximumLifeMs: 2000,
      }],
      blackFlames: [{
        id: "black-flame", roomId: session.currentRoomId, x: 0, y: 0.04, z: -3,
        radius: 1, lifeMs: 900, maximumLifeMs: 1800,
      }],
      areaAttacks: [{
        id: "dark-area", roomId: session.currentRoomId, x: -1, y: 0.025, z: -2,
        radius: 1, element: "dark", warningMs: 500, maximumWarningMs: 700,
        warningVisual: "dark-magic-circle", triggered: false,
      }],
      goldDrops: [],
    },
    assets: {},
  }));
  delete globalThis.window;
});
