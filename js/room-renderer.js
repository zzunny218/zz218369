import { ROOM_GRID_SIZE } from "./dungeon-generator.js";
import {
  ELEMENT_PRESENTATION,
  MonsterState,
  getElementDisplayName,
  getMeleeAttackRange,
  getMonsterHitboxRadius,
} from "./combat-system.js";
import {
  DOOR_WORLD_HEIGHT,
  DOOR_WORLD_WIDTH,
  PLAYER_WORLD_HEIGHT,
} from "./world-session.js";

const imageCache = new Map();
const checkerboardRemovedImageCache = new Map();
const ROOM_HALF_SIZE = ROOM_GRID_SIZE / 2;
const WALL_HEIGHT = 2.7;
const CAMERA_DISTANCE = 3.2;
const CAMERA_HEIGHT = 1.8;
const CAMERA_SHOULDER_OFFSET = 0.62;
const CAMERA_WALL_MARGIN = 0.16;
const CAMERA_PITCH = 12 * Math.PI / 180;
const HORIZONTAL_FIELD_OF_VIEW = 60 * Math.PI / 180;
const NEAR_PLANE = 0.08;
const ENTITY_VISUAL_SCALE = 5;
const BASE_ENTITY_WORLD_HEIGHT = 0.32;
const ROCK_WORLD_HEIGHT = 0.32 * ENTITY_VISUAL_SCALE;

function getLoadedImage(source) {
  if (!source || typeof Image === "undefined") {
    return null;
  }
  if (!imageCache.has(source)) {
    const image = new Image();
    image.src = source;
    imageCache.set(source, image);
  }
  const image = imageCache.get(source);
  return image.complete && image.naturalWidth > 0 ? image : null;
}

function getCheckerboardRemovedImage(source) {
  const image = getLoadedImage(source);
  if (!image) return null;
  if (checkerboardRemovedImageCache.has(source)) return checkerboardRemovedImageCache.get(source);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return image;
  context.drawImage(image, 0, 0);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const channelSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (Math.min(red, green, blue) >= 185 && channelSpread <= 10) pixels[index + 3] = 0;
  }
  context.putImageData(imageData, 0, 0);
  checkerboardRemovedImageCache.set(source, canvas);
  return canvas;
}

function resizeCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(bounds.width * pixelRatio));
  const height = Math.max(1, Math.floor(bounds.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}

function cameraVectors(yaw) {
  return {
    forward: { x: Math.sin(yaw), z: -Math.cos(yaw) },
    right: { x: Math.cos(yaw), z: Math.sin(yaw) },
  };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** 플레이어 뒤의 카메라가 벽 밖으로 나가지 않도록 방 안쪽으로 당긴다. */
export function getThirdPersonCamera(session) {
  const { forward, right } = cameraVectors(session.player.cameraYaw);
  const runeZoomProgress = clamp(session.player.runeZoomProgress ?? 0, 0, 1);
  const cameraDistance = CAMERA_DISTANCE - runeZoomProgress * 0.82;
  const shoulderOffset = CAMERA_SHOULDER_OFFSET * (1 - runeZoomProgress * 0.24);
  const desiredX = session.player.x - forward.x * cameraDistance + right.x * shoulderOffset;
  const desiredZ = session.player.z - forward.z * cameraDistance + right.z * shoulderOffset;
  const normalCamera = {
    x: clamp(desiredX, -ROOM_HALF_SIZE + CAMERA_WALL_MARGIN, ROOM_HALF_SIZE - CAMERA_WALL_MARGIN),
    y: CAMERA_HEIGHT - runeZoomProgress * 0.12,
    z: clamp(desiredZ, -ROOM_HALF_SIZE + CAMERA_WALL_MARGIN, ROOM_HALF_SIZE - CAMERA_WALL_MARGIN),
    forward,
    right,
  };
  const cinematic = session.bossCinematic;
  if (!cinematic?.active || !cinematic.focus) return normalCamera;
  const progress = clamp(cinematic.elapsedMs / cinematic.durationMs, 0, 1);
  const ease = (value) => value * value * (3 - value * 2);
  const blend = progress < 0.18
    ? ease(progress / 0.18)
    : progress < 0.68
      ? 1
      : 1 - ease((progress - 0.68) / 0.32);
  const focus = cinematic.focus;
  const closeYaw = Math.atan2(focus.x - session.player.x, -(focus.z - session.player.z));
  const yaw = session.player.cameraYaw + normalizeAngle(closeYaw - session.player.cameraYaw) * blend;
  const closeVectors = cameraVectors(yaw);
  const closeX = clamp(focus.x - closeVectors.forward.x * 2.45, -ROOM_HALF_SIZE + CAMERA_WALL_MARGIN, ROOM_HALF_SIZE - CAMERA_WALL_MARGIN);
  const closeZ = clamp(focus.z - closeVectors.forward.z * 2.45, -ROOM_HALF_SIZE + CAMERA_WALL_MARGIN, ROOM_HALF_SIZE - CAMERA_WALL_MARGIN);
  return {
    x: normalCamera.x + (closeX - normalCamera.x) * blend,
    y: normalCamera.y + (1.1 - normalCamera.y) * blend,
    z: normalCamera.z + (closeZ - normalCamera.z) * blend,
    forward: closeVectors.forward,
    right: closeVectors.right,
  };
}

function toCameraPoint(point, session) {
  const camera = getThirdPersonCamera(session);
  const relativeX = point.x - camera.x;
  const relativeY = (point.y ?? 0) - camera.y;
  const relativeZ = point.z - camera.z;
  const horizontalDepth = relativeX * camera.forward.x + relativeZ * camera.forward.z;
  return {
    side: relativeX * camera.right.x + relativeZ * camera.right.z,
    height: horizontalDepth * Math.sin(CAMERA_PITCH) + relativeY * Math.cos(CAMERA_PITCH),
    depth: horizontalDepth * Math.cos(CAMERA_PITCH) - relativeY * Math.sin(CAMERA_PITCH),
  };
}

function projectCameraPoint(point, width, height) {
  if (point.depth < NEAR_PLANE) {
    return null;
  }
  const focal = width / (2 * Math.tan(HORIZONTAL_FIELD_OF_VIEW / 2));
  return {
    x: width / 2 + point.side * focal / point.depth,
    y: height * 0.43 - point.height * focal / point.depth,
    depth: point.depth,
    focal,
  };
}

function projectWorldPoint(point, session, width, height) {
  return projectCameraPoint(toCameraPoint(point, session), width, height);
}

function clipPolygonToNearPlane(points) {
  const clipped = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[(index + points.length - 1) % points.length];
    const currentInside = current.depth >= NEAR_PLANE;
    const previousInside = previous.depth >= NEAR_PLANE;
    if (currentInside !== previousInside) {
      const amount = (NEAR_PLANE - previous.depth) / (current.depth - previous.depth);
      clipped.push({
        side: previous.side + (current.side - previous.side) * amount,
        height: previous.height + (current.height - previous.height) * amount,
        depth: NEAR_PLANE,
      });
    }
    if (currentInside) {
      clipped.push(current);
    }
  }
  return clipped;
}

function projectedPolygon(worldPoints, session, width, height) {
  return clipPolygonToNearPlane(worldPoints.map((point) => toCameraPoint(point, session)))
    .map((point) => projectCameraPoint(point, width, height))
    .filter(Boolean);
}

function fillPolygon(context, points, fillStyle, strokeStyle = null) {
  if (points.length < 3) {
    return;
  }
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) {
    context.lineTo(point.x, point.y);
  }
  context.closePath();
  context.fillStyle = fillStyle;
  context.fill();
  if (strokeStyle) {
    context.strokeStyle = strokeStyle;
    context.stroke();
  }
}

function clipTexturedPolygonToNearPlane(points) {
  const clipped = [];
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[(index + points.length - 1) % points.length];
    const currentInside = current.depth >= NEAR_PLANE;
    const previousInside = previous.depth >= NEAR_PLANE;
    if (currentInside !== previousInside) {
      const amount = (NEAR_PLANE - previous.depth) / (current.depth - previous.depth);
      clipped.push({
        side: previous.side + (current.side - previous.side) * amount,
        height: previous.height + (current.height - previous.height) * amount,
        depth: NEAR_PLANE,
        u: previous.u + (current.u - previous.u) * amount,
        v: previous.v + (current.v - previous.v) * amount,
      });
    }
    if (currentInside) clipped.push(current);
  }
  return clipped;
}

function drawTexturedTriangle(context, image, source, destination, opacity) {
  const [s0, s1, s2] = source;
  const center = destination.reduce((point, current) => ({
    x: point.x + current.x / destination.length,
    y: point.y + current.y / destination.length,
  }), { x: 0, y: 0 });
  const expandedDestination = destination.map((point) => {
    const offsetX = point.x - center.x;
    const offsetY = point.y - center.y;
    const distance = Math.max(0.001, Math.hypot(offsetX, offsetY));
    const overlap = 0.85;
    return {
      x: point.x + offsetX / distance * overlap,
      y: point.y + offsetY / distance * overlap,
    };
  });
  const [d0, d1, d2] = expandedDestination;
  const denominator = s0.x * (s1.y - s2.y)
    + s1.x * (s2.y - s0.y)
    + s2.x * (s0.y - s1.y);
  if (Math.abs(denominator) < 0.0001) return;
  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denominator;
  const c = (d0.x * (s2.x - s1.x) + d1.x * (s0.x - s2.x) + d2.x * (s1.x - s0.x)) / denominator;
  const e = (d0.x * (s1.x * s2.y - s2.x * s1.y)
    + d1.x * (s2.x * s0.y - s0.x * s2.y)
    + d2.x * (s0.x * s1.y - s1.x * s0.y)) / denominator;
  const b = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denominator;
  const d = (d0.y * (s2.x - s1.x) + d1.y * (s0.x - s2.x) + d2.y * (s1.x - s0.x)) / denominator;
  const f = (d0.y * (s1.x * s2.y - s2.x * s1.y)
    + d1.y * (s2.x * s0.y - s0.x * s2.y)
    + d2.y * (s0.x * s1.y - s1.x * s0.y)) / denominator;
  context.save();
  context.beginPath();
  context.moveTo(d0.x, d0.y);
  context.lineTo(d1.x, d1.y);
  context.lineTo(d2.x, d2.y);
  context.closePath();
  context.clip();
  context.globalAlpha = opacity;
  context.transform(a, b, c, d, e, f);
  context.drawImage(image, 0, 0);
  context.restore();
}

function drawTexturedWorldTriangle(context, image, vertices, session, width, height, opacity) {
  const imageWidth = image.naturalWidth || image.width;
  const imageHeight = image.naturalHeight || image.height;
  const clipped = clipTexturedPolygonToNearPlane(vertices.map((vertex) => ({
    ...toCameraPoint(vertex.world, session),
    u: vertex.u,
    v: vertex.v,
  })));
  if (clipped.length < 3) return;
  for (let index = 1; index < clipped.length - 1; index += 1) {
    const triangle = [clipped[0], clipped[index], clipped[index + 1]];
    const destination = triangle.map((point) => projectCameraPoint(point, width, height));
    if (destination.some((point) => !point)) continue;
    drawTexturedTriangle(
      context,
      image,
      triangle.map((point) => ({ x: point.u * imageWidth, y: point.v * imageHeight })),
      destination,
      opacity,
    );
  }
}

function drawWorldLine(context, start, end, session, width, height, strokeStyle) {
  let cameraStart = toCameraPoint(start, session);
  let cameraEnd = toCameraPoint(end, session);
  if (cameraStart.depth < NEAR_PLANE && cameraEnd.depth < NEAR_PLANE) {
    return;
  }
  if (cameraStart.depth < NEAR_PLANE || cameraEnd.depth < NEAR_PLANE) {
    const behind = cameraStart.depth < NEAR_PLANE ? cameraStart : cameraEnd;
    const ahead = cameraStart.depth < NEAR_PLANE ? cameraEnd : cameraStart;
    const amount = (NEAR_PLANE - behind.depth) / (ahead.depth - behind.depth);
    const clipped = {
      side: behind.side + (ahead.side - behind.side) * amount,
      height: behind.height + (ahead.height - behind.height) * amount,
      depth: NEAR_PLANE,
    };
    if (cameraStart.depth < NEAR_PLANE) cameraStart = clipped;
    else cameraEnd = clipped;
  }
  const projectedStart = projectCameraPoint(cameraStart, width, height);
  const projectedEnd = projectCameraPoint(cameraEnd, width, height);
  if (!projectedStart || !projectedEnd) return;
  context.beginPath();
  context.moveTo(projectedStart.x, projectedStart.y);
  context.lineTo(projectedEnd.x, projectedEnd.y);
  context.strokeStyle = strokeStyle;
  context.stroke();
}

function createWalls() {
  const h = ROOM_HALF_SIZE;
  return [
    { direction: "north", points: [{ x: -h, y: 0, z: -h }, { x: h, y: 0, z: -h }, { x: h, y: WALL_HEIGHT, z: -h }, { x: -h, y: WALL_HEIGHT, z: -h }] },
    { direction: "east", points: [{ x: h, y: 0, z: -h }, { x: h, y: 0, z: h }, { x: h, y: WALL_HEIGHT, z: h }, { x: h, y: WALL_HEIGHT, z: -h }] },
    { direction: "south", points: [{ x: h, y: 0, z: h }, { x: -h, y: 0, z: h }, { x: -h, y: WALL_HEIGHT, z: h }, { x: h, y: WALL_HEIGHT, z: h }] },
    { direction: "west", points: [{ x: -h, y: 0, z: h }, { x: -h, y: 0, z: -h }, { x: -h, y: WALL_HEIGHT, z: -h }, { x: -h, y: WALL_HEIGHT, z: h }] },
  ];
}

function interpolateWallTexturePoint(wall, u, v) {
  const bottomLeft = wall.points[0];
  const bottomRight = wall.points[1];
  const topRight = wall.points[2];
  const topLeft = wall.points[3];
  const left = {
    x: topLeft.x + (bottomLeft.x - topLeft.x) * v,
    y: topLeft.y + (bottomLeft.y - topLeft.y) * v,
    z: topLeft.z + (bottomLeft.z - topLeft.z) * v,
  };
  const right = {
    x: topRight.x + (bottomRight.x - topRight.x) * v,
    y: topRight.y + (bottomRight.y - topRight.y) * v,
    z: topRight.z + (bottomRight.z - topRight.z) * v,
  };
  return {
    x: left.x + (right.x - left.x) * u,
    y: left.y + (right.y - left.y) * u,
    z: left.z + (right.z - left.z) * u,
  };
}

export function getWallTextureWorldPoint(direction, u, v) {
  const wall = createWalls().find((candidate) => candidate.direction === direction);
  if (!wall) return null;
  return interpolateWallTexturePoint(wall, clamp(u, 0, 1), clamp(v, 0, 1));
}

function drawFixedWallTexture(context, wall, image, session, width, height, opacity = 1) {
  if (!image) return;
  const horizontalSegments = 10;
  const verticalSegments = 4;
  for (let row = 0; row < verticalSegments; row += 1) {
    const v0 = row / verticalSegments;
    const v1 = (row + 1) / verticalSegments;
    for (let column = 0; column < horizontalSegments; column += 1) {
      const u0 = column / horizontalSegments;
      const u1 = (column + 1) / horizontalSegments;
      const topLeft = { world: interpolateWallTexturePoint(wall, u0, v0), u: u0, v: v0 };
      const topRight = { world: interpolateWallTexturePoint(wall, u1, v0), u: u1, v: v0 };
      const bottomRight = { world: interpolateWallTexturePoint(wall, u1, v1), u: u1, v: v1 };
      const bottomLeft = { world: interpolateWallTexturePoint(wall, u0, v1), u: u0, v: v1 };
      drawTexturedWorldTriangle(context, image, [topLeft, topRight, bottomRight], session, width, height, opacity);
      drawTexturedWorldTriangle(context, image, [topLeft, bottomRight, bottomLeft], session, width, height, opacity);
    }
  }
}

function doorPoints(direction) {
  const h = ROOM_HALF_SIZE - 0.006;
  const halfWidth = DOOR_WORLD_WIDTH / 2;
  const top = DOOR_WORLD_HEIGHT;
  const definitions = {
    north: [{ x: -halfWidth, y: 0, z: -h }, { x: halfWidth, y: 0, z: -h }, { x: halfWidth, y: top, z: -h }, { x: -halfWidth, y: top, z: -h }],
    east: [{ x: h, y: 0, z: -halfWidth }, { x: h, y: 0, z: halfWidth }, { x: h, y: top, z: halfWidth }, { x: h, y: top, z: -halfWidth }],
    south: [{ x: halfWidth, y: 0, z: h }, { x: -halfWidth, y: 0, z: h }, { x: -halfWidth, y: top, z: h }, { x: halfWidth, y: top, z: h }],
    west: [{ x: -h, y: 0, z: halfWidth }, { x: -h, y: 0, z: -halfWidth }, { x: -h, y: top, z: -halfWidth }, { x: -h, y: top, z: halfWidth }],
  };
  return definitions[direction];
}

function drawRoomShell(context, width, height, room, session, backgroundSource = "", doorsLocked = false) {
  context.clearRect(0, 0, width, height);
  const backgroundImage = getLoadedImage(backgroundSource);
  const sky = context.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#183c3a");
  sky.addColorStop(0.55, "#87cba3");
  sky.addColorStop(1, "#47a37e");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, height);

  const floor = projectedPolygon([
    { x: -ROOM_HALF_SIZE, y: 0, z: -ROOM_HALF_SIZE },
    { x: ROOM_HALF_SIZE, y: 0, z: -ROOM_HALF_SIZE },
    { x: ROOM_HALF_SIZE, y: 0, z: ROOM_HALF_SIZE },
    { x: -ROOM_HALF_SIZE, y: 0, z: ROOM_HALF_SIZE },
  ], session, width, height);
  fillPolygon(context, floor, "#47a37e");
  drawFloorGrass(context, room, session, width, height);

  const walls = createWalls().map((wall) => ({
    ...wall,
    depth: wall.points.reduce((total, point) => total + toCameraPoint(point, session).depth, 0) / wall.points.length,
  })).sort((left, right) => right.depth - left.depth);

  walls.forEach((wall, index) => {
    const polygon = projectedPolygon(wall.points, session, width, height);
    fillPolygon(context, polygon, index % 2 === 0 ? "#176b58" : "#125247");
    if (backgroundImage) drawFixedWallTexture(context, wall, backgroundImage, session, width, height, 0.96);
    fillPolygon(
      context,
      polygon,
      index % 2 === 0 ? "rgb(0 35 30 / 18%)" : "rgb(0 18 22 / 28%)",
      "rgb(141 226 183 / 32%)",
    );
    if (room.doors[wall.direction]) {
      fillPolygon(
        context,
        projectedPolygon(doorPoints(wall.direction), session, width, height),
        doorsLocked ? "#351018" : "#010205",
        doorsLocked ? "rgb(255 78 88 / 82%)" : "rgb(132 123 172 / 62%)",
      );
    }
  });

}

function drawFloorGrass(context, room, session, width, height) {
  const roomSeed = [...String(room.id ?? "room")]
    .reduce((total, character) => total + character.codePointAt(0), 0);
  context.save();
  context.lineWidth = Math.max(1.25, height * 0.0018);
  context.lineCap = "round";
  context.shadowColor = "rgb(18 90 68 / 68%)";
  context.shadowBlur = Math.max(1, height * 0.002);
  for (let index = 0; index < 42; index += 1) {
    const x = -6.7 + ((index * 37 + roomSeed * 11) % 134) / 10;
    const z = -6.7 + ((index * 71 + roomSeed * 17) % 134) / 10;
    if (Math.hypot(x - (room.campfire?.x ?? 99), z - (room.campfire?.z ?? 99)) < 1.25) continue;
    const heightScale = 0.14 + ((index * 29 + roomSeed) % 8) * 0.018;
    for (const lean of [-0.08, 0, 0.08]) {
      drawWorldLine(
        context,
        { x, y: 0.014, z },
        { x: x + lean, y: heightScale, z: z + lean * 0.35 },
        session,
        width,
        height,
        "#47a37e",
      );
    }
  }
  context.restore();
}

function drawCampfireParticles(context, campfire, session, width, height) {
  if (!campfire) return;
  const time = (typeof performance === "undefined" ? Date.now() : performance.now()) * 0.001;
  fillPolygon(
    context,
    projectedPolygon(horizontalCirclePoints(campfire, 0.62, 22), session, width, height),
    "rgb(255 121 24 / 16%)",
  );
  for (let index = 0; index < 110; index += 1) {
    const progress = (time * (0.72 + index % 4 * 0.07) + index * 0.137) % 1;
    const angle = index * 2.399;
    const baseSpread = 0.1 + index % 9 * 0.036;
    const sway = Math.sin(time * (2.2 + index % 5 * 0.18) + index * 1.71)
      * (0.035 + progress * 0.16);
    const forwardFlutter = Math.cos(time * 1.7 + index * 0.83) * progress * 0.08;
    const projection = projectWorldPoint({
      x: campfire.x + Math.cos(angle) * baseSpread + sway,
      y: 0.34 + progress * (0.82 + index % 4 * 0.08),
      z: campfire.z + Math.sin(angle) * baseSpread + forwardFlutter,
    }, session, width, height);
    if (!projection) continue;
    const radius = Math.max(1.4, Math.min(6.5, projection.focal * (0.017 + (1 - progress) * 0.031) / projection.depth));
    context.save();
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = Math.sin(Math.PI * progress) * 0.82;
    context.fillStyle = index % 5 === 0 ? "#ffe77a" : index % 2 === 0 ? "#ff9b1f" : "#ff5a1f";
    context.shadowColor = "#ff7a1a";
    context.shadowBlur = radius * 2.2;
    context.fillRect(projection.x - radius, projection.y - radius, radius * 2, radius * 2);
    context.restore();
  }
}

function projectEntity(entity, session, width, height) {
  const projection = projectWorldPoint({ x: entity.x, y: entity.y ?? 0, z: entity.z }, session, width, height);
  if (!projection) return null;
  return {
    ...projection,
  };
}

function isBetweenCameraAndPlayer(entity, session) {
  const camera = getThirdPersonCamera(session);
  const segmentX = session.player.x - camera.x;
  const segmentZ = session.player.z - camera.z;
  const lengthSquared = segmentX ** 2 + segmentZ ** 2;
  if (lengthSquared === 0) return false;
  const amount = ((entity.x - camera.x) * segmentX + (entity.z - camera.z) * segmentZ) / lengthSquared;
  if (amount <= 0.04 || amount >= 0.96) return false;
  const closestX = camera.x + segmentX * amount;
  const closestZ = camera.z + segmentZ * amount;
  return Math.hypot(entity.x - closestX, entity.z - closestZ) <= 0.72;
}

/** 모든 빌보드가 같은 투영식으로 거리에 비례해 작아지도록 화면 높이를 계산한다. */
export function calculateBillboardHeight({ focal, worldHeight, depth, canvasHeight, maxViewportRatio = 0.52 }) {
  return Math.min(canvasHeight * maxViewportRatio, Math.max(4, focal * worldHeight / Math.max(depth, NEAR_PLANE)));
}

export function calculateBillboardWidth({ billboardHeight, widthRatio = 0.64, imageWidth = 0, imageHeight = 0 }) {
  if (imageWidth > 0 && imageHeight > 0) {
    return billboardHeight * (imageWidth / imageHeight);
  }
  return billboardHeight * widthRatio;
}

export function getMonsterDisplayLabel(monster) {
  return monster.isBoss || monster.element === "normal"
    ? monster.name
    : `${getElementDisplayName(monster.element)}의 ${monster.name}`;
}

export function getMonsterBillboardOpacity(monster, isOccluded = false) {
  if (isOccluded) return 0.2;
  return monster.templateId === "slime" || monster.templateId === "bigSlime" ? 0.8 : 1;
}

function drawBillboard(context, projection, {
  label,
  color,
  worldHeight = BASE_ENTITY_WORLD_HEIGHT * ENTITY_VISUAL_SCALE,
  widthRatio = 0.64,
  maxViewportRatio = 0.52,
  shape = "ellipse",
  opacity = 1,
  element = null,
  healthRatio = null,
  imageSource = "",
  removeCheckerboard = false,
  auraColor = null,
  hitFlash = false,
  waterHitFlash = false,
  visualScaleX = 1,
  visualScaleY = 1,
}) {
  const baseBillboardHeight = calculateBillboardHeight({
    focal: projection.focal,
    worldHeight,
    depth: projection.depth,
    canvasHeight: context.canvas.height,
    maxViewportRatio,
  });
  const billboardHeight = baseBillboardHeight * visualScaleY;
  const image = removeCheckerboard ? getCheckerboardRemovedImage(imageSource) : getLoadedImage(imageSource);
  const billboardWidth = calculateBillboardWidth({
    billboardHeight: baseBillboardHeight,
    widthRatio,
    imageWidth: image?.naturalWidth,
    imageHeight: image?.naturalHeight,
  }) * visualScaleX;
  context.save();
  context.globalAlpha = opacity;
  if (auraColor) {
    context.fillStyle = `${auraColor}32`;
    context.shadowColor = auraColor;
    context.shadowBlur = billboardHeight * 0.22;
    context.beginPath();
    context.ellipse(projection.x, projection.y - billboardHeight * 0.5, billboardWidth * 0.62, billboardHeight * 0.54, 0, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
  }
  if (image) {
    // 자연 종횡비를 보존한 이미지를 히트박스와 같은 월드 위치에 바닥 기준으로 배치한다.
    // 평면 이미지는 화면 좌표에 직접 그려 카메라 회전 중에도 항상 정면을 본다.
    if (hitFlash) context.filter = "sepia(1) saturate(9) hue-rotate(315deg) brightness(1.22)";
    else if (waterHitFlash) context.filter = "sepia(1) saturate(5) hue-rotate(155deg) brightness(1.12)";
    context.drawImage(image, projection.x - billboardWidth / 2, projection.y - billboardHeight, billboardWidth, billboardHeight);
    context.filter = "none";
  } else {
    context.fillStyle = hitFlash ? "#ff303f" : waterHitFlash ? "#428dff" : color;
    if (shape === "heart") {
      const centerY = projection.y - billboardHeight * 0.5;
      const radius = Math.min(billboardWidth, billboardHeight) * 0.34;
      context.beginPath();
      context.moveTo(projection.x, centerY + radius * 1.15);
      context.bezierCurveTo(projection.x - radius * 1.7, centerY + radius * 0.1, projection.x - radius * 1.1, centerY - radius, projection.x, centerY - radius * 0.28);
      context.bezierCurveTo(projection.x + radius * 1.1, centerY - radius, projection.x + radius * 1.7, centerY + radius * 0.1, projection.x, centerY + radius * 1.15);
      context.fill();
    } else if (shape === "rectangle") {
      context.beginPath();
      context.roundRect(projection.x - billboardWidth / 2, projection.y - billboardHeight, billboardWidth, billboardHeight, Math.min(12, billboardWidth * 0.08));
      context.fill();
    } else {
      context.beginPath();
      context.ellipse(projection.x, projection.y - billboardHeight * 0.5, billboardWidth * 0.46, billboardHeight * 0.48, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = "rgb(255 255 255 / 58%)";
    context.stroke();
  }
  if (label) {
    context.fillStyle = "#ffffff";
    context.font = `800 ${Math.min(24, Math.max(10, billboardWidth * 0.12))}px system-ui`;
    context.textAlign = "center";
    context.fillText(label, projection.x, projection.y + 10);
  }
  if (element) {
    context.fillStyle = "#d8d1ff";
    context.font = `700 ${Math.min(18, Math.max(9, billboardWidth * 0.1))}px system-ui`;
    context.fillText(element, projection.x, projection.y + 24);
  }
  if (Number.isFinite(healthRatio)) {
    const barWidth = Math.max(16, billboardWidth * 0.82);
    const barHeight = Math.max(3, Math.min(7, billboardHeight * 0.035));
    context.fillStyle = "rgb(10 12 20 / 82%)";
    context.fillRect(projection.x - barWidth / 2, projection.y + 29, barWidth, barHeight);
    context.fillStyle = "#ff526b";
    context.fillRect(projection.x - barWidth / 2, projection.y + 29, barWidth * Math.max(0, healthRatio), barHeight);
  }
  context.restore();
}

function horizontalCirclePoints(position, radius, segments = 24) {
  return Array.from({ length: segments }, (_, index) => {
    const angle = index / segments * Math.PI * 2;
    return {
      x: position.x + Math.cos(angle) * radius,
      y: 0.018,
      z: position.z + Math.sin(angle) * radius,
    };
  });
}

function drawMonsterGroundEffects(context, monsters, session, width, height) {
  for (const monster of monsters) {
    if ((monster.currentHealth ?? monster.stats.health) <= 0) continue;
    const hitboxRadius = getMonsterHitboxRadius(monster);
    fillPolygon(
      context,
      projectedPolygon(horizontalCirclePoints(monster.position, hitboxRadius), session, width, height),
      "rgb(0 0 0 / 38%)",
    );

    if (monster.aiState !== MonsterState.ATTACK_PREPARING || monster.pendingAttackType !== "melee") continue;
    const progress = monster.chargeProgress ?? 0;
    const arcPoints = [{ x: monster.position.x, y: 0.026, z: monster.position.z }];
    const halfArc = Math.PI * 0.28;
    for (let index = 0; index <= 20; index += 1) {
      const yaw = monster.attackYaw - halfArc + index / 20 * halfArc * 2;
      arcPoints.push({
        x: monster.position.x + Math.sin(yaw) * getMeleeAttackRange(monster),
        y: 0.026,
        z: monster.position.z - Math.cos(yaw) * getMeleeAttackRange(monster),
      });
    }
    fillPolygon(
      context,
      projectedPolygon(arcPoints, session, width, height),
      `rgb(255 35 51 / ${0.2 + progress * 0.34})`,
      `rgb(255 98 98 / ${0.65 + progress * 0.3})`,
    );
  }
}

function drawParticleShape(context, particle, x, y, radius) {
  context.translate(x, y);
  context.rotate(particle.rotation ?? 0);
  context.beginPath();
  if (particle.shape === "square") {
    context.rect(-radius, -radius, radius * 2, radius * 2);
  } else if (particle.shape === "four-point-star") {
    for (let index = 0; index < 8; index += 1) {
      const angle = -Math.PI / 2 + index * Math.PI / 4;
      const pointRadius = index % 2 === 0 ? radius * 1.5 : radius * 0.28;
      const xPoint = Math.cos(angle) * pointRadius;
      const yPoint = Math.sin(angle) * pointRadius;
      if (index === 0) context.moveTo(xPoint, yPoint);
      else context.lineTo(xPoint, yPoint);
    }
    context.closePath();
  } else if (particle.shape === "triangle") {
    context.moveTo(0, -radius * 1.25);
    context.lineTo(radius * 1.1, radius);
    context.lineTo(-radius * 1.1, radius);
    context.closePath();
  } else if (particle.shape === "leaf") {
    context.moveTo(-radius * 1.25, 0);
    context.bezierCurveTo(-radius * 0.35, -radius, radius * 0.65, -radius * 0.75, radius * 1.25, 0);
    context.bezierCurveTo(radius * 0.35, radius, -radius * 0.65, radius * 0.75, -radius * 1.25, 0);
    context.closePath();
  } else {
    context.arc(0, 0, radius, 0, Math.PI * 2);
  }
  context.fill();
}

function drawCombatParticles(context, combatState, session, width, height) {
  if (!combatState) return;
  const projectedParticles = combatState.particles
    .filter((particle) => !particle.roomId || particle.roomId === session.currentRoomId)
    .map((particle) => ({ particle, projection: projectWorldPoint(particle, session, width, height) }))
    .filter(({ projection }) => projection
      && projection.depth > 0.28
      && projection.x > -width * 0.25 && projection.x < width * 1.25
      && projection.y > -height * 0.25 && projection.y < height * 1.25)
    .sort((left, right) => right.projection.depth - left.projection.depth);

  for (const { particle, projection } of projectedParticles) {
    const radius = Math.min(context.canvas.height * 0.014, Math.max(1, projection.focal * particle.size / projection.depth));
    context.save();
    context.globalAlpha = Math.max(0, particle.lifeMs / particle.maximumLifeMs) * (particle.opacity ?? 1);
    context.globalCompositeOperation = particle.blendMode ?? (particle.glow ? "lighter" : "source-over");
    context.fillStyle = particle.color;
    if (particle.glow) {
      context.shadowColor = particle.color;
      context.shadowBlur = radius * 2.8;
    }
    drawParticleShape(context, particle, projection.x, projection.y, radius);
    context.restore();
  }
}

function drawCombatLasers(context, combatState, session, width, height) {
  if (!combatState) return;
  for (const laser of combatState.lasers ?? []) {
    const side = { x: -laser.direction.z, z: laser.direction.x };
    const segmentCount = laser.isLightning ? laser.skillTier === 2 ? 17 : 25 : 2;
    const worldPoints = Array.from({ length: segmentCount }, (_, index) => {
      const amount = index / (segmentCount - 1);
      const offset = laser.isLightning && amount > 0 && amount < 1
        ? Math.sin(amount * Math.PI * 13) * 0.2 + Math.sin(amount * Math.PI * 29) * 0.08
        : 0;
      return {
        x: laser.x + laser.direction.x * laser.length * amount + side.x * offset,
        y: laser.y,
        z: laser.z + laser.direction.z * laser.length * amount + side.z * offset,
      };
    });
    const points = worldPoints.map((point) => toCameraPoint(point, session))
      .filter((point) => point.depth > 0.3)
      .map((point) => projectCameraPoint(point, width, height))
      .filter((point) => point && point.x > -width && point.x < width * 2 && point.y > -height && point.y < height * 2);
    if (points.length < 2) continue;
    const presentation = ELEMENT_PRESENTATION[laser.element] ?? ELEMENT_PRESENTATION.light;
    const opacity = Math.max(0, laser.lifeMs / laser.maximumLifeMs);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = opacity;
    context.strokeStyle = presentation.color;
    context.shadowColor = presentation.color;
    context.shadowBlur = Math.max(18, height * 0.035);
    context.lineCap = "round";
    context.lineWidth = Math.max(7, height * 0.014) * (laser.widthMultiplier ?? 1);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    context.strokeStyle = "#ffffff";
    context.lineWidth = Math.max(2, height * 0.0035) * Math.sqrt(laser.widthMultiplier ?? 1);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    context.restore();
  }
}

function drawVerticalLightnings(context, combatState, session, width, height) {
  for (const lightning of combatState?.verticalLightnings ?? []) {
    if (lightning.roomId !== session.currentRoomId) continue;
    const worldPoints = Array.from({ length: 20 }, (_, index) => {
      const amount = index / 19;
      const taper = Math.sin(amount * Math.PI);
      return {
        x: lightning.x + (Math.sin(index * 5.7 + lightning.phase) * 0.19 + Math.sin(index * 12.1) * 0.07) * taper,
        y: lightning.topY + (lightning.y - lightning.topY) * amount,
        z: lightning.z + (Math.cos(index * 4.9 + lightning.phase) * 0.15 + Math.sin(index * 9.3) * 0.06) * taper,
      };
    });
    const points = worldPoints.map((point) => projectWorldPoint(point, session, width, height)).filter(Boolean);
    if (points.length < 2) continue;
    const opacity = Math.max(0, lightning.lifeMs / lightning.maximumLifeMs);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.globalAlpha = opacity;
    context.lineCap = "round";
    context.strokeStyle = "#ffd62e";
    context.shadowColor = "#ffd62e";
    context.shadowBlur = Math.max(20, height * 0.04);
    context.lineWidth = Math.max(8, height * 0.015);
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
    context.strokeStyle = "#ffffff";
    context.lineWidth = Math.max(2, height * 0.0035);
    context.stroke();
    context.restore();
  }
}

function magicCircleWorldPoint(effect, sideAmount, heightAmount) {
  const side = { x: -effect.direction.z, z: effect.direction.x };
  return {
    x: effect.x + side.x * sideAmount,
    y: effect.y + heightAmount,
    z: effect.z + side.z * sideAmount,
  };
}

function strokeProjectedWorldPoints(context, worldPoints, session, width, height, color, lineWidth) {
  const points = worldPoints.map((point) => projectWorldPoint(point, session, width, height)).filter(Boolean);
  if (points.length < 2) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (const point of points.slice(1)) context.lineTo(point.x, point.y);
  context.strokeStyle = color;
  context.lineWidth = lineWidth;
  context.stroke();
}

const MAGIC_RUNE_GLYPHS = Object.freeze(["ᚠ", "ᚢ", "ᚦ", "ᚨ", "ᚱ", "ᚲ", "ᚷ", "ᚹ", "ᚺ", "ᚾ", "ᛁ", "ᛃ", "ᛇ", "ᛈ", "ᛉ", "ᛋ", "ᛏ", "ᛒ"]);

function groundMagicCirclePoint(effect, radius, angle) {
  return {
    x: effect.x + Math.cos(angle) * radius,
    y: effect.y ?? 0.025,
    z: effect.z + Math.sin(angle) * radius,
  };
}

function drawGroundMagicCircle(context, effect, session, width, height, opacity = 1) {
  const presentation = ELEMENT_PRESENTATION[effect.element] ?? ELEMENT_PRESENTATION.dark;
  const radius = effect.radius ?? 1;
  context.save();
  context.globalAlpha = Math.max(0, opacity);
  context.globalCompositeOperation = "lighter";
  context.shadowColor = presentation.color;
  context.shadowBlur = Math.max(14, height * 0.025);
  fillPolygon(
    context,
    projectedPolygon(horizontalCirclePoints(effect, radius, 48), session, width, height),
    `${presentation.color}18`,
    presentation.color,
  );
  for (const scale of [1, 0.76, 0.34]) {
    const points = Array.from({ length: 49 }, (_, index) => groundMagicCirclePoint(
      effect,
      radius * scale,
      index / 48 * Math.PI * 2,
    ));
    strokeProjectedWorldPoints(context, points, session, width, height, presentation.color, Math.max(2, height * 0.0025));
  }
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    strokeProjectedWorldPoints(context, [
      groundMagicCirclePoint(effect, radius * 0.34, angle),
      groundMagicCirclePoint(effect, radius * 0.76, angle + Math.PI / 4),
    ], session, width, height, presentation.color, Math.max(2, height * 0.002));
  }
  context.fillStyle = "#e8d9ff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${Math.max(8, height * 0.012)}px Georgia, serif`;
  for (let index = 0; index < 14; index += 1) {
    const angle = index / 14 * Math.PI * 2;
    const projection = projectWorldPoint(groundMagicCirclePoint(effect, radius * 0.88, angle), session, width, height);
    if (projection) context.fillText(MAGIC_RUNE_GLYPHS[index % MAGIC_RUNE_GLYPHS.length], projection.x, projection.y);
  }
  context.restore();
}

function drawGroundMagicCircles(context, combatState, session, width, height) {
  for (const circle of combatState?.groundMagicCircles ?? []) {
    if (circle.roomId !== session.currentRoomId) continue;
    const lifeOpacity = Math.max(0, circle.lifeMs / circle.maximumLifeMs);
    const pulse = 0.72 + Math.sin(performance.now() * 0.012) * 0.16;
    drawGroundMagicCircle(context, circle, session, width, height, Math.max(0.34, lifeOpacity) * pulse);
  }
}

function drawUltimateFields(context, combatState, session, width, height) {
  for (const field of combatState?.ultimateFields ?? []) {
    if (field.roomId !== session.currentRoomId) continue;
    const lifeOpacity = Math.min(1, field.lifeMs / 650);
    const pulse = 0.9 + Math.sin(performance.now() * 0.008) * 0.08;
    for (const scale of [1, 0.78, 0.56]) {
      drawGroundMagicCircle(context, {
        ...field,
        element: "light",
        radius: field.radius * scale * pulse,
      }, session, width, height, lifeOpacity * (0.42 + scale * 0.25));
    }
    context.save();
    context.globalCompositeOperation = "lighter";
    context.shadowColor = "#fff0a5";
    context.shadowBlur = Math.max(12, height * 0.02);
    for (const rune of field.runeStrokes ?? []) {
      for (const stroke of rune) {
        const worldPoints = stroke.map((point) => ({
          x: field.x + (point.x - 0.5) * field.radius * 2,
          y: 0.045,
          z: field.z + (point.y - 0.5) * field.radius * 2,
        }));
        strokeProjectedWorldPoints(context, worldPoints, session, width, height, "#fff2a6", Math.max(2.2, height * 0.003));
      }
    }
    context.restore();
  }
}

function drawMagicRuneRing(context, effect, radius, count, session, width, height, color) {
  context.fillStyle = color;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `900 ${Math.max(9, height * 0.014)}px Georgia, serif`;
  for (let index = 0; index < count; index += 1) {
    const angle = index / count * Math.PI * 2 - Math.PI / 2;
    const projection = projectWorldPoint(
      magicCircleWorldPoint(effect, Math.cos(angle) * radius, Math.sin(angle) * radius),
      session,
      width,
      height,
    );
    if (!projection) continue;
    context.save();
    context.translate(projection.x, projection.y);
    context.rotate(angle + Math.PI / 2);
    context.fillText(MAGIC_RUNE_GLYPHS[index % MAGIC_RUNE_GLYPHS.length], 0, 0);
    context.restore();
  }
}

function drawMagicCircles(context, combatState, session, width, height) {
  if (!combatState) return;
  for (const effect of combatState.castEffects ?? []) {
    const presentation = ELEMENT_PRESENTATION[effect.element] ?? ELEMENT_PRESENTATION.normal;
    const opacity = Math.max(0, effect.lifeMs / effect.maximumLifeMs);
    const radius = 0.72;
    context.save();
    context.globalAlpha = opacity;
    context.globalCompositeOperation = "lighter";
    context.shadowColor = presentation.color;
    context.shadowBlur = Math.max(14, height * 0.022);
    for (const scale of [1, 0.78]) {
      const ring = Array.from({ length: 49 }, (_, index) => {
        const angle = index / 48 * Math.PI * 2;
        return magicCircleWorldPoint(effect, Math.cos(angle) * radius * scale, Math.sin(angle) * radius * scale);
      });
      strokeProjectedWorldPoints(context, ring, session, width, height, presentation.color, Math.max(2, height * 0.0024));
    }
    for (let index = 0; index < 12; index += 1) {
      const angle = index / 12 * Math.PI * 2;
      strokeProjectedWorldPoints(context, [
        magicCircleWorldPoint(effect, Math.cos(angle) * radius * 0.84, Math.sin(angle) * radius * 0.84),
        magicCircleWorldPoint(effect, Math.cos(angle) * radius, Math.sin(angle) * radius),
      ], session, width, height, presentation.color, Math.max(2, height * 0.002));
    }
    drawMagicRuneRing(context, effect, radius * 0.89, 14, session, width, height, "#fff7dc");
    drawMagicRuneRing(context, effect, radius * 1.23, 18, session, width, height, presentation.color);
    for (const stroke of effect.runeStrokes ?? []) {
      const runePoints = stroke.map((point) => magicCircleWorldPoint(
        effect,
        (Math.max(-0.25, Math.min(1.25, point.x)) - 0.5) * radius * 1.22,
        (0.5 - Math.max(-0.25, Math.min(1.25, point.y))) * radius * 1.22,
      ));
      strokeProjectedWorldPoints(context, runePoints, session, width, height, "#fff7dc", Math.max(3, height * 0.004));
    }
    context.restore();
  }
}

function drawAreaAttacks(context, combatState, session, width, height) {
  for (const attack of combatState?.areaAttacks ?? []) {
    if (attack.roomId !== session.currentRoomId) continue;
    const circle = projectedPolygon(horizontalCirclePoints(attack, attack.radius, 48), session, width, height);
    const presentation = ELEMENT_PRESENTATION[attack.element] ?? ELEMENT_PRESENTATION.rock;
    const warningFill = `${presentation.color}30`;
    const warningInner = `${presentation.color}1c`;
    if (!attack.triggered) {
      const progress = 1 - Math.max(0, attack.warningMs) / attack.maximumWarningMs;
      if (attack.warningVisual === "dark-magic-circle") {
        drawGroundMagicCircle(context, attack, session, width, height, 0.58 + progress * 0.36);
        continue;
      }
      fillPolygon(
        context,
        circle,
        warningFill,
        presentation.color,
      );
      const innerRadius = attack.radius * (0.2 + progress * 0.8);
      fillPolygon(
        context,
        projectedPolygon(horizontalCirclePoints(attack, innerRadius, 40), session, width, height),
        warningInner,
        presentation.color,
      );
      continue;
    }

    const quakeOpacity = Math.max(0, attack.quakeMs / 420);
    context.save();
    context.globalAlpha = quakeOpacity;
    fillPolygon(context, circle, `${presentation.color}38`, presentation.color);
    for (let index = 0; index < 11; index += 1) {
      const angle = index / 11 * Math.PI * 2 + Math.sin(index * 7.1) * 0.18;
      const inner = 0.16 + (index % 3) * 0.08;
      const outer = attack.radius * (0.68 + (index % 4) * 0.08);
      drawWorldLine(context, {
        x: attack.x + Math.cos(angle) * inner,
        y: 0.035,
        z: attack.z + Math.sin(angle) * inner,
      }, {
        x: attack.x + Math.cos(angle + 0.12) * outer,
        y: 0.035,
        z: attack.z + Math.sin(angle + 0.12) * outer,
      }, session, width, height, presentation.color);
    }
    context.restore();
  }
}

function drawWaves(context, combatState, session, width, height) {
  for (const wave of combatState?.waves ?? []) {
    if (wave.roomId !== session.currentRoomId) continue;
    const side = { x: -wave.direction.z, z: wave.direction.x };
    const halfWidth = wave.width / 2;
    const halfThickness = wave.thickness / 2;
    const backLeft = { x: wave.x + side.x * halfWidth - wave.direction.x * halfThickness, y: 0.04, z: wave.z + side.z * halfWidth - wave.direction.z * halfThickness };
    const backRight = { x: wave.x - side.x * halfWidth - wave.direction.x * halfThickness, y: 0.04, z: wave.z - side.z * halfWidth - wave.direction.z * halfThickness };
    const frontRight = { x: wave.x - side.x * halfWidth + wave.direction.x * halfThickness, y: 0.62, z: wave.z - side.z * halfWidth + wave.direction.z * halfThickness };
    const frontLeft = { x: wave.x + side.x * halfWidth + wave.direction.x * halfThickness, y: 0.62, z: wave.z + side.z * halfWidth + wave.direction.z * halfThickness };
    context.save();
    context.shadowColor = "#65cfff";
    context.shadowBlur = Math.max(10, height * 0.025);
    fillPolygon(context, projectedPolygon([backLeft, backRight, frontRight, frontLeft], session, width, height), "rgb(57 147 235 / 54%)", "#a8e8ff");
    fillPolygon(context, projectedPolygon([
      { ...frontLeft, y: 0.62 },
      { ...frontRight, y: 0.62 },
      { ...frontRight, y: 0.18, x: frontRight.x + wave.direction.x * 0.36, z: frontRight.z + wave.direction.z * 0.36 },
      { ...frontLeft, y: 0.18, x: frontLeft.x + wave.direction.x * 0.36, z: frontLeft.z + wave.direction.z * 0.36 },
    ], session, width, height), "rgb(39 122 222 / 64%)", "#d8f7ff");
    drawWorldLine(context, frontLeft, frontRight, session, width, height, "#f4fdff");
    context.fillStyle = "rgb(245 253 255 / 92%)";
    context.shadowColor = "#d9f8ff";
    context.shadowBlur = Math.max(7, height * 0.012);
    for (let index = 0; index < 31; index += 1) {
      const across = index / 30 * 2 - 1;
      const stagger = ((index * 17) % 7) / 7;
      const foamPoint = {
        x: wave.x + side.x * halfWidth * across + wave.direction.x * (halfThickness + 0.12 + stagger * 0.24),
        y: 0.34 + (index % 4) * 0.075,
        z: wave.z + side.z * halfWidth * across + wave.direction.z * (halfThickness + 0.12 + stagger * 0.24),
      };
      const foam = projectWorldPoint(foamPoint, session, width, height);
      if (!foam) continue;
      const radius = Math.max(2.5, Math.min(9, foam.focal * (0.055 + (index % 3) * 0.014) / foam.depth));
      context.beginPath();
      context.ellipse(foam.x, foam.y, radius * 1.45, radius, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }
}

function drawBlackHoles(context, combatState, session, width, height) {
  for (const blackHole of combatState?.blackHoles ?? []) {
    if (blackHole.roomId !== session.currentRoomId) continue;
    const pulse = 0.94 + Math.sin(performance.now() * 0.01) * 0.06;
    const projection = projectEntity(blackHole, session, width, height);
    if (!projection) continue;
    const radius = Math.max(8, projection.focal * blackHole.coreRadius * pulse / projection.depth);
    context.save();
    context.shadowColor = "#8e5cff";
    context.shadowBlur = Math.max(16, radius * 0.75);
    context.fillStyle = "#020104";
    context.strokeStyle = "#a27cff";
    context.lineWidth = Math.max(3, radius * 0.09);
    context.beginPath();
    context.arc(projection.x, projection.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = radius * 0.22;
    context.strokeStyle = "rgb(220 184 255 / 74%)";
    context.lineWidth = Math.max(1.5, radius * 0.025);
    context.beginPath();
    context.arc(projection.x - radius * 0.12, projection.y - radius * 0.12, radius * 0.76, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

function drawMeteors(context, combatState, session, width, height) {
  for (const meteor of combatState?.meteors ?? []) {
    if (meteor.roomId !== session.currentRoomId) continue;
    const projection = projectEntity(meteor, session, width, height);
    if (!projection) continue;
    const radius = Math.max(7, projection.focal * 0.58 / projection.depth);
    context.save();
    context.shadowColor = "#ff6a1f";
    context.shadowBlur = radius * 0.55;
    context.fillStyle = "#4b4038";
    context.strokeStyle = "#2d2521";
    context.lineWidth = Math.max(2, radius * 0.08);
    context.beginPath();
    context.arc(projection.x, projection.y, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.fillStyle = "rgb(139 118 101 / 66%)";
    context.beginPath();
    context.arc(projection.x - radius * 0.28, projection.y - radius * 0.28, radius * 0.28, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

function drawTrajectoryWarnings(context, combatState, session, width, height) {
  for (const warning of combatState?.trajectoryWarnings ?? []) {
    if (warning.roomId !== session.currentRoomId) continue;
    const side = { x: -warning.direction.z, z: warning.direction.x };
    const opacity = 0.16 + 0.36 * (1 - warning.lifeMs / warning.maximumLifeMs);
    const points = [
      { x: warning.x + side.x * warning.width, y: warning.y, z: warning.z + side.z * warning.width },
      { x: warning.x - side.x * warning.width, y: warning.y, z: warning.z - side.z * warning.width },
      { x: warning.x + warning.direction.x * warning.length - side.x * warning.width, y: warning.y, z: warning.z + warning.direction.z * warning.length - side.z * warning.width },
      { x: warning.x + warning.direction.x * warning.length + side.x * warning.width, y: warning.y, z: warning.z + warning.direction.z * warning.length + side.z * warning.width },
    ];
    const color = (ELEMENT_PRESENTATION[warning.element] ?? ELEMENT_PRESENTATION.normal).color;
    context.save();
    context.globalAlpha = opacity;
    fillPolygon(context, projectedPolygon(points, session, width, height), color, color);
    context.restore();
  }
}

function drawBlackFlames(context, combatState, session, width, height) {
  for (const flame of combatState?.blackFlames ?? []) {
    if (flame.roomId !== session.currentRoomId) continue;
    const progress = Math.max(0, flame.lifeMs / flame.maximumLifeMs);
    const time = performance.now() * 0.006;
    const count = Math.max(8, Math.round(flame.radius * 3));
    for (let index = 0; index < count; index += 1) {
      const angle = index / count * Math.PI * 2;
      const distance = flame.radius * (0.18 + (index % 4) / 5);
      const point = projectEntity({
        x: flame.x + Math.cos(angle) * distance,
        y: 0.13 + Math.abs(Math.sin(time + index * 1.7)) * 0.42 * progress,
        z: flame.z + Math.sin(angle) * distance,
      }, session, width, height);
      if (!point) continue;
      const radius = Math.max(2, point.focal * (0.08 + 0.06 * progress) / point.depth);
      context.save();
      context.globalAlpha = progress * 0.88;
      context.fillStyle = index % 3 === 0 ? "#7b3aad" : "#09050d";
      context.shadowColor = "#9f56d5";
      context.shadowBlur = radius * 2;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }
}

function drawDamageNumbers(context, combatState, session, width, height) {
  for (const number of combatState?.damageNumbers ?? []) {
    if (number.roomId !== session.currentRoomId) continue;
    const projection = projectEntity(number, session, width, height);
    if (!projection) continue;
    const progress = Math.max(0, number.lifeMs / number.maximumLifeMs);
    context.save();
    context.globalAlpha = Math.min(1, progress * 1.8);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.font = number.critical
      ? `1000 ${Math.max(28, height * 0.045)}px system-ui`
      : `900 ${Math.max(15, height * 0.022)}px system-ui`;
    context.lineWidth = number.critical ? 7 : 4;
    context.strokeStyle = number.critical ? "#a94f00" : "#747983";
    context.fillStyle = number.critical ? "#ffd638" : "#ffffff";
    context.strokeText(String(number.damage), projection.x, projection.y);
    context.fillText(String(number.damage), projection.x, projection.y);
    context.restore();
  }
}

function drawMonsterDetectionAlert(context, monster, projection, height) {
  if ((monster.detectionAlertMs ?? 0) <= 0) return;
  const billboardHeight = calculateBillboardHeight({
    focal: projection.focal,
    worldHeight: BASE_ENTITY_WORLD_HEIGHT * ENTITY_VISUAL_SCALE * monster.stats.size,
    depth: projection.depth,
    canvasHeight: height,
  });
  const pulse = 1 + Math.sin((typeof performance === "undefined" ? Date.now() : performance.now()) * 0.018) * 0.08;
  context.save();
  context.translate(projection.x, projection.y - billboardHeight - Math.max(18, billboardHeight * 0.12));
  context.scale(pulse, pulse);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.font = `1000 ${Math.max(28, Math.min(58, billboardHeight * 0.3))}px system-ui`;
  context.lineWidth = Math.max(4, billboardHeight * 0.028);
  context.strokeStyle = "rgb(72 0 9 / 92%)";
  context.fillStyle = "#ff263c";
  context.shadowColor = "#ff263c";
  context.shadowBlur = Math.max(8, billboardHeight * 0.08);
  context.strokeText("!", 0, 0);
  context.fillText("!", 0, 0);
  context.restore();
}

function drawMonsterElementalStatus(context, monster, projection, height) {
  const statusType = monster.elementalStatus?.type ?? ((monster.vineVisualMs ?? 0) > 0 ? "grass" : null);
  if (!statusType || ((monster.immobilizedMs ?? 0) <= 0 && statusType !== "grass")) return;
  const billboardHeight = calculateBillboardHeight({
    focal: projection.focal,
    worldHeight: BASE_ENTITY_WORLD_HEIGHT * ENTITY_VISUAL_SCALE * monster.stats.size,
    depth: projection.depth,
    canvasHeight: height,
  });
  const centerY = projection.y - billboardHeight * 0.5;
  context.save();
  if (statusType === "ice") {
    context.fillStyle = "rgb(72 177 255 / 28%)";
    context.strokeStyle = "rgb(156 224 255 / 88%)";
    context.lineWidth = Math.max(2, billboardHeight * 0.018);
    const radiusX = billboardHeight * 0.36;
    const radiusY = billboardHeight * 0.49;
    context.beginPath();
    for (let index = 0; index < 6; index += 1) {
      const angle = -Math.PI / 2 + index / 6 * Math.PI * 2;
      const x = projection.x + Math.cos(angle) * radiusX;
      const y = centerY + Math.sin(angle) * radiusY;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.fill();
    context.stroke();
  } else if (statusType === "electric") {
    context.fillStyle = "#ffe54f";
    context.shadowColor = "#ffe54f";
    context.shadowBlur = Math.max(7, billboardHeight * 0.09);
    const time = performance.now() * 0.006;
    for (let index = 0; index < 6; index += 1) {
      const angle = time + index / 6 * Math.PI * 2;
      const radius = Math.max(2, billboardHeight * 0.026);
      const x = projection.x + Math.cos(angle) * billboardHeight * 0.38;
      const y = centerY + Math.sin(angle) * billboardHeight * 0.32;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    }
  } else if (statusType === "rock") {
    context.strokeStyle = "rgb(194 135 98 / 92%)";
    context.lineWidth = Math.max(3, billboardHeight * 0.024);
    context.shadowColor = "#c28762";
    context.shadowBlur = Math.max(5, billboardHeight * 0.05);
    for (const scale of [0.25, 0.37]) {
      context.beginPath();
      context.ellipse(projection.x, projection.y - billboardHeight * 0.1, billboardHeight * scale, billboardHeight * scale * 0.32, 0, 0, Math.PI * 2);
      context.stroke();
    }
  } else if (statusType === "grass") {
    context.strokeStyle = "#58e37f";
    context.fillStyle = "#76ed87";
    context.lineWidth = Math.max(3, billboardHeight * 0.022);
    context.shadowColor = "#45dc77";
    context.shadowBlur = Math.max(6, billboardHeight * 0.06);
    const ringLevels = [-0.22, 0, 0.22];
    for (const level of ringLevels) {
      context.beginPath();
      context.ellipse(
        projection.x,
        centerY + billboardHeight * level,
        billboardHeight * 0.42,
        billboardHeight * 0.115,
        0,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    for (const [level, side] of [[-0.11, -1], [-0.11, 1], [0.11, -1], [0.11, 1]]) {
      context.save();
      context.translate(
        projection.x + side * billboardHeight * 0.34,
        centerY + level * billboardHeight,
      );
      context.rotate(side * 0.55 + level * 2.2);
      const leafRadius = billboardHeight * 0.065;
      context.beginPath();
      context.moveTo(-leafRadius, 0);
      context.bezierCurveTo(-leafRadius * 0.25, -leafRadius, leafRadius * 0.55, -leafRadius * 0.7, leafRadius, 0);
      context.bezierCurveTo(leafRadius * 0.25, leafRadius, -leafRadius * 0.55, leafRadius * 0.7, -leafRadius, 0);
      context.fill();
      context.restore();
    }
  }
  context.restore();
}

function drawPlayerBarrier(context, player, projection, height, { outlineOnly = false } = {}) {
  const barrier = player.defenseBarrier;
  if (!barrier) return;
  const presentation = ELEMENT_PRESENTATION[barrier.element] ?? ELEMENT_PRESENTATION.normal;
  const billboardHeight = calculateBillboardHeight({
    focal: projection.focal,
    worldHeight: PLAYER_WORLD_HEIGHT,
    depth: projection.depth,
    canvasHeight: height,
  });
  const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.025;
  context.save();
  context.strokeStyle = presentation.color;
  context.fillStyle = presentation.color;
  context.globalAlpha = outlineOnly ? 0.75 : 0.16;
  context.shadowColor = presentation.color;
  context.shadowBlur = Math.max(9, billboardHeight * 0.1);
  context.lineWidth = Math.max(2, billboardHeight * 0.018);
  context.beginPath();
  context.ellipse(
    projection.x,
    projection.y - billboardHeight * 0.5,
    billboardHeight * 0.47 * pulse,
    billboardHeight * 0.58 * pulse,
    0,
    0,
    Math.PI * 2,
  );
  if (!outlineOnly) context.fill();
  context.stroke();
  context.restore();
}

function drawPlayerUltimateGlow(context, player, projection, height) {
  if ((player.ultimateBuffMs ?? 0) <= 0) return;
  const billboardHeight = calculateBillboardHeight({
    focal: projection.focal,
    worldHeight: PLAYER_WORLD_HEIGHT,
    depth: projection.depth,
    canvasHeight: height,
  });
  const radius = billboardHeight * (0.72 + Math.sin(performance.now() * 0.009) * 0.04);
  const gradient = context.createRadialGradient(
    projection.x,
    projection.y - billboardHeight * 0.48,
    radius * 0.08,
    projection.x,
    projection.y - billboardHeight * 0.48,
    radius,
  );
  gradient.addColorStop(0, "rgb(255 251 204 / 74%)");
  gradient.addColorStop(0.42, "rgb(255 230 111 / 34%)");
  gradient.addColorStop(1, "rgb(255 225 94 / 0%)");
  context.save();
  context.globalCompositeOperation = "lighter";
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(projection.x, projection.y - billboardHeight * 0.48, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawMonsterCharge(context, monster, projection, height) {
  if (monster.aiState !== MonsterState.ATTACK_PREPARING || monster.pendingAttackType !== "ranged") return;
  const presentation = ELEMENT_PRESENTATION[monster.element] ?? ELEMENT_PRESENTATION.normal;
  const progress = monster.chargeProgress ?? 0;
  const radius = Math.max(9, height * (0.015 + progress * 0.012));
  context.save();
  context.globalCompositeOperation = presentation.blendMode === "multiply" ? "source-over" : "lighter";
  context.fillStyle = presentation.color;
  context.strokeStyle = presentation.color;
  context.shadowColor = presentation.color;
  context.shadowBlur = radius * 1.8;
  context.globalAlpha = 0.55 + progress * 0.4;
  context.beginPath();
  context.arc(projection.x, projection.y - radius * 2.1, radius * 0.48, 0, Math.PI * 2);
  context.fill();
  context.lineWidth = Math.max(2, radius * 0.12);
  context.beginPath();
  context.arc(projection.x, projection.y - radius * 2.1, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  context.stroke();
  context.restore();
}

/** 15×15 격자 방과 벽 충돌 카메라, 월드 좌표를 가진 빌보드 엔티티를 그린다. */
export function drawRoomScene(canvas, { dungeon, session, monstersByRoom, combatState = null, assets }) {
  const { width, height } = resizeCanvas(canvas);
  const context = canvas.getContext("2d");
  if (!context) return;

  const room = dungeon.roomById[session.currentRoomId];
  const livingMonsters = (monstersByRoom[session.currentRoomId] ?? [])
    .filter((monster) => (monster.currentHealth ?? monster.stats.health) > 0);
  const doorsLocked = (room.type === "combat" || room.type === "boss") && livingMonsters.length > 0;
  drawRoomShell(context, width, height, room, session, assets?.roomBackgrounds?.chapter1, doorsLocked);
  drawMonsterGroundEffects(context, livingMonsters, session, width, height);
  const entities = [];

  for (const rock of room.rocks ?? []) {
    const projection = projectEntity(rock, session, width, height);
    if (projection) entities.push({
      projection,
      label: "",
      color: "#737786",
      worldHeight: ROCK_WORLD_HEIGHT,
      widthRatio: 0.86,
      maxViewportRatio: 0.42,
      shape: "rectangle",
      opacity: isBetweenCameraAndPlayer(rock, session) ? 0.2 : 1,
      imageSource: assets?.rock,
      removeCheckerboard: true,
    });
  }

  if (room.campfire) {
    const projection = projectEntity(room.campfire, session, width, height);
    if (projection) entities.push({
      projection,
      label: "",
      color: "#533728",
      worldHeight: 0.92,
      widthRatio: 1,
      maxViewportRatio: 0.34,
      shape: "rectangle",
      imageSource: assets?.campfire,
    });
  }

  if (session.npc?.active && session.npc.roomId === session.currentRoomId) {
    const projection = projectEntity(session.npc, session, width, height);
    if (projection) entities.push({
      projection,
      label: session.npc.name ?? "스승 그리모어",
      color: "#c8b6ff",
      worldHeight: session.npc.height,
      maxViewportRatio: 0.48,
      shape: "rectangle",
      opacity: isBetweenCameraAndPlayer(session.npc, session) ? 0.2 : 1,
      imageSource: assets?.entities?.[session.npc.assetKey],
    });
  }

  for (const monster of livingMonsters) {
    const jumpStretch = monster.movementStyle === "hop" && monster.slimeHopState === "jumping"
      ? Math.sin((monster.slimeHopProgress ?? 0) * Math.PI)
      : 0;
    const landingSquash = monster.movementStyle === "hop"
      ? Math.max(0, (monster.slimeLandingSquashMs ?? 0) / 180)
      : 0;
    const walkingLift = monster.aiState === MonsterState.WALKING
      ? monster.movementStyle === "hop"
        ? Math.sin((monster.slimeHopProgress ?? 0) * Math.PI)
          * (monster.templateId === "bigSlime" ? 1.05 : 0.82)
        : Math.abs(Math.sin(performance.now() * 0.012 + monster.position.x)) * 0.08
      : 0;
    const attackingLift = monster.aiState === MonsterState.ATTACKING ? 0.1 : 0;
    const projection = projectEntity({
      ...monster.position,
      y: (monster.position.y ?? 0) + walkingLift + attackingLift,
    }, session, width, height);
    if (projection) entities.push({
      projection,
      monster,
      label: getMonsterDisplayLabel(monster),
      color: monster.spawnClass === "elite" ? "#cf5a6b" : "#9d4f73",
      worldHeight: BASE_ENTITY_WORLD_HEIGHT * ENTITY_VISUAL_SCALE * monster.stats.size,
      healthRatio: (monster.currentHealth ?? monster.stats.health) / (monster.maximumHealth ?? monster.stats.health),
      shape: "rectangle",
      opacity: getMonsterBillboardOpacity(monster, isBetweenCameraAndPlayer(monster.position, session)),
      imageSource: assets?.entities?.[`${monster.assetKey}.${monster.element}`]
        ?? assets?.entities?.[`${monster.assetKey}.normal`]
        ?? assets?.entities?.[monster.assetKey],
      maxViewportRatio: monster.isBoss ? 0.76 : 0.52,
      widthRatio: monster.isBoss ? 0.72 : 0.64,
      auraColor: monster.templateId === "fairy"
        ? (ELEMENT_PRESENTATION[monster.element] ?? ELEMENT_PRESENTATION.normal).color
        : null,
      hitFlash: (monster.hitFlashMs ?? 0) > 0,
      waterHitFlash: (monster.waterHitFlashMs ?? 0) > 0,
      visualScaleX: 1 - jumpStretch * 0.06 + landingSquash * 0.16,
      visualScaleY: 1 + jumpStretch * 0.14 - landingSquash * 0.12,
    });
  }

  for (const drop of combatState?.goldDrops ?? []) {
    if (drop.roomId !== session.currentRoomId) continue;
    const projection = projectEntity({
      ...drop,
      y: drop.y + Math.sin((drop.bobTimeMs ?? 0) * 0.006) * 0.08,
    }, session, width, height);
    if (projection) entities.push({
      projection,
      label: `${drop.amount}G`,
      color: "#f5c72f",
      worldHeight: 0.42,
      widthRatio: 0.8,
      shape: "ellipse",
    });
  }

  for (const drop of combatState?.heartDrops ?? []) {
    if (drop.roomId !== session.currentRoomId) continue;
    const projection = projectEntity({
      ...drop,
      y: drop.y + Math.sin((drop.bobTimeMs ?? 0) * 0.006) * 0.08,
    }, session, width, height);
    if (projection) entities.push({
      projection,
      label: "",
      color: "#ff3f62",
      worldHeight: 0.58,
      widthRatio: 1,
      shape: "heart",
    });
  }

  if (room.isStageEnd && livingMonsters.length === 0) {
    for (const portal of room.stagePortals ?? []) {
      fillPolygon(
        context,
        projectedPolygon(horizontalCirclePoints(portal, portal.radius), session, width, height),
        portal.type === "shop" ? "rgb(245 199 47 / 28%)" : "rgb(91 231 218 / 28%)",
        portal.type === "shop" ? "#f5c72f" : "#5be7da",
      );
      const projection = projectEntity({ ...portal, y: 0.7 }, session, width, height);
      if (projection) entities.push({
        projection,
        label: portal.label,
        color: portal.type === "shop" ? "#ae8523" : "#287f78",
        worldHeight: 0.9,
        widthRatio: 0.72,
        shape: "rectangle",
      });
    }
  }

  // 월드 파티클과 마법 효과를 먼저 그려 적·돌·NPC·플레이어가 앞에서 자연스럽게 가린다.
  drawAreaAttacks(context, combatState, session, width, height);
  drawTrajectoryWarnings(context, combatState, session, width, height);
  drawGroundMagicCircles(context, combatState, session, width, height);
  drawUltimateFields(context, combatState, session, width, height);
  drawWaves(context, combatState, session, width, height);
  drawBlackHoles(context, combatState, session, width, height);
  drawBlackFlames(context, combatState, session, width, height);
  drawMeteors(context, combatState, session, width, height);
  drawMagicCircles(context, combatState, session, width, height);
  drawCombatLasers(context, combatState, session, width, height);
  drawVerticalLightnings(context, combatState, session, width, height);
  drawCombatParticles(context, combatState, session, width, height);

  entities.sort((left, right) => right.projection.depth - left.projection.depth);
  for (const entity of entities) {
    drawBillboard(context, entity.projection, entity);
    if (entity.monster) {
      drawMonsterDetectionAlert(context, entity.monster, entity.projection, height);
      drawMonsterCharge(context, entity.monster, entity.projection, height);
      drawMonsterElementalStatus(context, entity.monster, entity.projection, height);
    }
  }
  // 장작 이미지를 그린 뒤 불꽃을 올려 모닥불이 장작 앞에서 타오르게 한다.
  drawCampfireParticles(context, room.campfire, session, width, height);

  const playerProjection = projectEntity(session.player, session, width, height);
  if (playerProjection) {
    drawPlayerUltimateGlow(context, session.player, playerProjection, height);
    drawPlayerBarrier(context, session.player, playerProjection, height);
    drawBillboard(context, playerProjection, {
      label: "",
      color: "#6250a7",
      worldHeight: PLAYER_WORLD_HEIGHT,
      imageSource: assets?.player,
      hitFlash: (session.player.hitFlashMs ?? 0) > 0,
    });
    drawPlayerBarrier(context, session.player, playerProjection, height, { outlineOnly: true });
  }
  drawDamageNumbers(context, combatState, session, width, height);
}
