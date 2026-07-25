export const AUDIO_ASSETS = Object.freeze({
  magic: new URL("../assets/audio/magic.mp3", import.meta.url).href,
  fire: new URL("../assets/audio/fire.mp3", import.meta.url).href,
  ice: new URL("../assets/audio/ice.mp3", import.meta.url).href,
  electric: new URL("../assets/audio/electric-spell.mp3", import.meta.url).href,
  electricThird: new URL("../assets/audio/electric-third.mp3", import.meta.url).href,
  lightBeam: new URL("../assets/audio/light-beam.mp3", import.meta.url).href,
  ultimateRune1: new URL("../assets/audio/ultimate-rune-1.mp3", import.meta.url).href,
  ultimateRune2: new URL("../assets/audio/ultimate-rune-2.mp3", import.meta.url).href,
  ultimateRune3: new URL("../assets/audio/ultimate-rune-3.mp3", import.meta.url).href,
  ultimateAura: new URL("../assets/audio/ultimate-aura.mp3", import.meta.url).href,
  bossMelee: new URL("../assets/audio/boss-melee.mp3", import.meta.url).href,
  bossIntro: new URL("../assets/audio/boss-intro.mp3", import.meta.url).href,
  bossDarkRelease: new URL("../assets/audio/boss-dark-release.mp3", import.meta.url).href,
  bossPhaseTwo: new URL("../assets/audio/boss-phase-two.mp3", import.meta.url).href,
  bossDarkArea: new URL("../assets/audio/boss-dark-area.mp3", import.meta.url).href,
  bossSummon: new URL("../assets/audio/boss-summon.mp3", import.meta.url).href,
  bossDefeat: new URL("../assets/audio/boss-defeat.mp3", import.meta.url).href,
  meteorImpact: new URL("../assets/audio/meteor-impact.mp3", import.meta.url).href,
  waterWave: new URL("../assets/audio/water-wave.mp3", import.meta.url).href,
  water: new URL("../assets/audio/water.mp3", import.meta.url).href,
  grass: new URL("../assets/audio/grass.mp3", import.meta.url).href,
  light: new URL("../assets/audio/light.mp3", import.meta.url).href,
  rock: new URL("../assets/audio/rock.mp3", import.meta.url).href,
  dark: new URL("../assets/audio/dark.mp3", import.meta.url).href,
  slimeJump: new URL("../assets/audio/slime-jump.mp3", import.meta.url).href,
  slimeLand: new URL("../assets/audio/slime-land.mp3", import.meta.url).href,
  melee: new URL("../assets/audio/melee.mp3", import.meta.url).href,
  footstep1: new URL("../assets/audio/footstep-1.mp3", import.meta.url).href,
  footstep2: new URL("../assets/audio/footstep-2.mp3", import.meta.url).href,
  footstep3: new URL("../assets/audio/footstep-3.mp3", import.meta.url).href,
  hit: new URL("../assets/audio/hit.mp3", import.meta.url).href,
  backgroundMusic: new URL("../assets/audio/background-music.mp3", import.meta.url).href,
  bossMusic: new URL("../assets/audio/boss-music.mp3", import.meta.url).href,
  coinPickup: new URL("../assets/audio/coin-pickup.mp3", import.meta.url).href,
  potionDrink: new URL("../assets/audio/potion-drink.mp3", import.meta.url).href,
});

const ELEMENT_AUDIO_KEY = Object.freeze({
  fire: "fire",
  ice: "ice",
  electric: "electric",
  water: "water",
  grass: "grass",
  light: "light",
  rock: "rock",
  dark: "dark",
});

const FOOTSTEP_KEYS = Object.freeze(["footstep1", "footstep2", "footstep3"]);
export const DEFAULT_AUDIO_VOLUMES = Object.freeze({
  footsteps: 0.62,
  enemies: 0.82,
  magic: 0.86,
  music: 0.42,
});
const CUE_CATEGORY = Object.freeze({
  magic: "magic",
  fire: "magic",
  ice: "magic",
  electric: "magic",
  electricThird: "magic",
  lightBeam: "magic",
  ultimateRune1: "magic",
  ultimateRune2: "magic",
  ultimateRune3: "magic",
  ultimateAura: "magic",
  bossMelee: "enemies",
  bossIntro: "enemies",
  bossDarkRelease: "enemies",
  bossPhaseTwo: "enemies",
  bossDarkArea: "enemies",
  bossSummon: "enemies",
  bossDefeat: "enemies",
  meteorImpact: "magic",
  waterWave: "magic",
  water: "magic",
  grass: "magic",
  light: "magic",
  rock: "magic",
  dark: "magic",
  slimeJump: "enemies",
  slimeLand: "enemies",
  melee: "enemies",
  hit: "enemies",
  footstep1: "footsteps",
  footstep2: "footsteps",
  footstep3: "footsteps",
  backgroundMusic: "music",
  bossMusic: "music",
  coinPickup: "enemies",
  potionDrink: "enemies",
});
const activeAudio = new Set();
const audioStopHandlers = new WeakMap();
const audioVolumes = { ...DEFAULT_AUDIO_VOLUMES };
let audioPrimed = false;
let backgroundMusic = null;
let backgroundMusicCue = null;

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/** 적의 공간 음향은 14칸 밖에서 들리지 않고 거리가 멀수록 완만하게 작아진다. */
export function calculateSpatialVolume(distance, { baseVolume = 1, maximumDistance = 14 } = {}) {
  const normalizedDistance = clamp((Number(distance) || 0) / maximumDistance, 0, 1);
  return Math.round(baseVolume * ((1 - normalizedDistance) ** 1.35) * 1000) / 1000;
}

export function getElementAudioKey(element) {
  return ELEMENT_AUDIO_KEY[element] ?? null;
}

export function getAudioVolumes() {
  return { ...audioVolumes };
}

export function setAudioVolume(category, volume) {
  if (!(category in audioVolumes)) return false;
  audioVolumes[category] = clamp(Number(volume) || 0, 0, 1);
  if (category === "music" && backgroundMusic) {
    backgroundMusic.volume = audioVolumes.music;
  }
  return true;
}

/** 첫 사용자 입력 때 파일을 미리 읽어 이후 전투 중 재생 지연을 줄인다. */
export function primeAudioSystem() {
  if (audioPrimed || typeof Audio === "undefined") return false;
  audioPrimed = true;
  for (const source of Object.values(AUDIO_ASSETS)) {
    const audio = new Audio(source);
    audio.preload = "auto";
    audio.load?.();
  }
  return true;
}

export function playAudioCue(cue, { volume = 1, playbackRate = 1, category = CUE_CATEGORY[cue] } = {}) {
  const source = AUDIO_ASSETS[cue];
  if (!source || typeof Audio === "undefined") return null;
  const audio = new Audio(source);
  audio.preload = "auto";
  const categoryVolume = category && category in audioVolumes ? audioVolumes[category] : 1;
  audio.volume = clamp(volume * categoryVolume, 0, 1);
  audio.playbackRate = clamp(playbackRate, 0.5, 2);
  audio.preservesPitch = false;
  audio.mozPreservesPitch = false;
  audio.webkitPreservesPitch = false;
  activeAudio.add(audio);
  const release = () => activeAudio.delete(audio);
  const releaseWithTimers = () => {
    audioStopHandlers.get(audio)?.();
    audioStopHandlers.delete(audio);
    release();
  };
  audio.addEventListener?.("ended", releaseWithTimers, { once: true });
  audio.addEventListener?.("error", releaseWithTimers, { once: true });
  const playResult = audio.play?.();
  playResult?.catch?.(releaseWithTimers);
  return audio;
}

export function stopAudioCue(audio) {
  if (!audio) return false;
  audioStopHandlers.get(audio)?.();
  audioStopHandlers.delete(audio);
  audio.pause?.();
  activeAudio.delete(audio);
  return true;
}

/** 지정 시간 동안 재생하고 마지막 구간에서 음량을 부드럽게 줄인다. */
export function playFadingAudioCue(cue, {
  volume = 1,
  playbackRate = 1,
  durationMs = 3000,
  fadeOutMs = 800,
  loop = false,
  category = CUE_CATEGORY[cue],
} = {}) {
  const audio = playAudioCue(cue, { volume, playbackRate, category });
  if (!audio) return null;
  audio.loop = Boolean(loop);
  const startingVolume = audio.volume;
  const fadeDuration = Math.max(80, Math.min(durationMs, fadeOutMs));
  const fadeStartMs = Math.max(0, durationMs - fadeDuration);
  let fadeTimer = null;
  const fadeStartTimer = setTimeout(() => {
    const startedAt = Date.now();
    fadeTimer = setInterval(() => {
      const progress = clamp((Date.now() - startedAt) / fadeDuration, 0, 1);
      audio.volume = startingVolume * (1 - progress);
      if (progress >= 1) {
        clearInterval(fadeTimer);
        audio.pause?.();
        activeAudio.delete(audio);
        audioStopHandlers.delete(audio);
      }
    }, 50);
  }, fadeStartMs);
  audioStopHandlers.set(audio, () => {
    clearTimeout(fadeStartTimer);
    if (fadeTimer) clearInterval(fadeTimer);
  });
  return audio;
}

export function startBackgroundMusic(track = "normal") {
  if (typeof Audio === "undefined") return null;
  const cue = track === "boss" ? "bossMusic" : "backgroundMusic";
  if (!backgroundMusic || backgroundMusicCue !== cue) {
    backgroundMusic?.pause?.();
    backgroundMusic = new Audio(AUDIO_ASSETS[cue]);
    backgroundMusic.preload = "auto";
    backgroundMusic.loop = true;
    backgroundMusicCue = cue;
  }
  backgroundMusic.volume = audioVolumes.music;
  backgroundMusic.play?.().catch?.(() => {});
  return backgroundMusic;
}

export function stopBackgroundMusic() {
  backgroundMusic?.pause?.();
  if (backgroundMusic) {
    try { backgroundMusic.currentTime = 0; } catch {}
  }
}

/** 공격 마법은 공통음과 속성음을 겹치고, 방어 마법은 공통음만 재생한다. */
export function playMagicAudio(element, {
  defense = false,
  enemy = false,
  distance = 0,
  playElement = true,
} = {}) {
  const baseVolume = enemy ? 0.7 : 1;
  const volume = enemy
    ? calculateSpatialVolume(distance, { baseVolume })
    : baseVolume;
  if (volume <= 0) return [];
  const played = [playAudioCue("magic", { volume })].filter(Boolean);
  const elementCue = getElementAudioKey(element);
  if (!defense && playElement && elementCue) {
    const elementAudio = playAudioCue(elementCue, { volume });
    if (elementAudio) played.push(elementAudio);
  }
  return played;
}

export function playSpatialCue(cue, {
  distance = 0,
  baseVolume = 0.85,
  playbackRate = 1,
} = {}) {
  const volume = calculateSpatialVolume(distance, { baseVolume });
  if (volume <= 0) return null;
  return playAudioCue(cue, {
    volume,
    playbackRate,
  });
}

export function playRandomFootstep({ random = Math.random, volume = 0.62 } = {}) {
  const index = Math.min(FOOTSTEP_KEYS.length - 1, Math.floor(random() * FOOTSTEP_KEYS.length));
  return playAudioCue(FOOTSTEP_KEYS[index], { volume });
}
