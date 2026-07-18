/** 캔버스 해상도를 표시 크기와 기기 픽셀 비율에 맞춘다. */
export function resizeCanvas(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(bounds.width * pixelRatio));
  const height = Math.max(1, Math.floor(bounds.height * pixelRatio));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return { width, height, pixelRatio };
}

/** 플레이어의 탐험 위치를 저장하는 장면 상태를 만든다. */
export function createSceneState() {
  return { playerOffset: { x: 0, y: 0 }, cameraYaw: 0 };
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

/** 손짓 이동 입력으로 플레이어 위치를 갱신한다. */
export function updateSceneState(state, gestureState, elapsedMs) {
  const cameraTurn = gestureState.cameraTurn ?? 0;
  if (!gestureState.isMoving && cameraTurn === 0) {
    return state;
  }

  const distance = (elapsedMs / 1000) * 0.45;
  const x = gestureState.isMoving ? clamp(state.playerOffset.x + gestureState.moveVector.x * distance, -1, 1) : state.playerOffset.x;
  const y = gestureState.isMoving ? clamp(state.playerOffset.y + gestureState.moveVector.y * distance, -1, 1) : state.playerOffset.y;
  const cameraYaw = state.cameraYaw + cameraTurn * (elapsedMs / 1000) * 1.4;
  return { ...state, playerOffset: { x, y }, cameraYaw };
}

/** 캐릭터 뒤쪽을 바라보는 2.5D 전장 뼈대를 그린다. */
export function drawExplorationScene(canvas, sceneState = createSceneState()) {
  const { width, height } = resizeCanvas(canvas);
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const horizon = height * 0.34;
  const centerX = width / 2;
  context.clearRect(0, 0, width, height);

  const sky = context.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, "#141a42");
  sky.addColorStop(1, "#6b507e");
  context.fillStyle = sky;
  context.fillRect(0, 0, width, horizon);

  const floor = context.createLinearGradient(0, horizon, 0, height);
  floor.addColorStop(0, "#32445a");
  floor.addColorStop(1, "#16202d");
  context.fillStyle = floor;
  context.fillRect(0, horizon, width, height - horizon);

  context.strokeStyle = "rgb(167 159 230 / 26%)";
  context.lineWidth = Math.max(1, width * 0.001);
  for (let index = -6; index <= 6; index += 1) {
    context.beginPath();
    context.moveTo(centerX, horizon);
    context.lineTo(centerX + index * width * 0.18, height);
    context.stroke();
  }

  for (let index = 1; index < 7; index += 1) {
    const progress = index / 7;
    const y = horizon + (height - horizon) * progress * progress;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const cameraShift = Math.sin(sceneState.cameraYaw) * width * 0.14;
  const enemyX = centerX + width * (0.12 - sceneState.playerOffset.x * 0.18) - cameraShift;
  const enemyY = horizon + height * (0.2 - sceneState.playerOffset.y * 0.08);
  context.fillStyle = "#db5a68";
  context.beginPath();
  context.arc(enemyX, enemyY, Math.max(12, width * 0.018), 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#fff2f3";
  context.font = `${Math.max(13, width * 0.013)}px system-ui`;
  context.textAlign = "center";
  context.fillText("적", enemyX, enemyY - Math.max(20, width * 0.03));

  const playerY = height * (0.76 + sceneState.playerOffset.y * 0.04);
  const playerScale = Math.max(28, width * 0.045);
  context.fillStyle = "#ded8f5";
  context.beginPath();
  const playerX = centerX + width * sceneState.playerOffset.x * 0.07;
  context.arc(playerX, playerY - playerScale * 1.2, playerScale * 0.42, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#564291";
  context.beginPath();
  context.moveTo(playerX - playerScale, playerY + playerScale);
  context.lineTo(playerX + playerScale, playerY + playerScale);
  context.lineTo(playerX, playerY - playerScale * 0.75);
  context.closePath();
  context.fill();
  context.fillStyle = "#ffffff";
  context.fillText("플레이어", playerX, playerY + playerScale * 1.5);
}
