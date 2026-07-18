import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIO_ASSETS,
  calculateSpatialVolume,
  getAudioVolumes,
  getElementAudioKey,
  setAudioVolume,
  startBackgroundMusic,
  stopBackgroundMusic,
} from "./audio-system.js";

test("제공된 공통·속성·슬라임·근접·발자국 효과음 경로를 모두 연결한다", () => {
  for (const key of [
    "magic", "fire", "ice", "electric", "water", "grass", "light", "rock", "dark",
    "slimeJump", "slimeLand", "melee", "hit", "backgroundMusic", "footstep1", "footstep2", "footstep3",
    "coinPickup", "potionDrink", "electricThird", "lightBeam", "bossPhaseTwo",
    "bossDarkArea", "bossSummon", "meteorImpact", "waterWave", "bossDefeat",
    "ultimateRune1", "ultimateRune2", "ultimateRune3", "ultimateAura", "bossMelee",
    "bossIntro", "bossDarkRelease",
  ]) {
    assert.match(AUDIO_ASSETS[key], /\.mp3$/);
  }
  assert.equal(getElementAudioKey("electric"), "electric");
  assert.match(AUDIO_ASSETS.electric, /electric-spell\.mp3$/);
  assert.match(AUDIO_ASSETS.electricThird, /electric-third\.mp3$/);
  assert.equal(getElementAudioKey("normal"), null);
});

test("발자국·적·마법·배경음악 음량을 각각 조절한다", () => {
  assert.equal(setAudioVolume("music", 0.25), true);
  assert.equal(setAudioVolume("magic", 0.7), true);
  const volumes = getAudioVolumes();
  assert.equal(volumes.music, 0.25);
  assert.equal(volumes.magic, 0.7);
});

test("적 효과음은 기본 70%에서 거리가 멀어질수록 작아진다", () => {
  assert.equal(calculateSpatialVolume(0, { baseVolume: 0.7 }), 0.7);
  assert.ok(calculateSpatialVolume(7, { baseVolume: 0.7 }) < 0.7);
  assert.equal(calculateSpatialVolume(14, { baseVolume: 0.7 }), 0);
});

test("타이틀로 돌아갈 때 배경음악을 멈추고 재생 위치를 처음으로 되돌린다", () => {
  const OriginalAudio = globalThis.Audio;
  class FakeAudio {
    constructor(source) {
      this.source = source;
      this.currentTime = 18;
      this.paused = false;
    }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  globalThis.Audio = FakeAudio;
  try {
    const audio = startBackgroundMusic("boss");
    stopBackgroundMusic();
    assert.equal(audio.paused, true);
    assert.equal(audio.currentTime, 0);
  } finally {
    globalThis.Audio = OriginalAudio;
  }
});
