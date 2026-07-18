export const ExplorationNodeType = Object.freeze({
  COMBAT: "combat",
  SHOP: "shop",
  EVENT: "event",
  BOSS: "boss",
});

export const COMBAT_NODE_CHANCE = 0.4;
export const EVENT_NODE_CHANCE = 0.35;
export const SHOP_NODE_CHANCE = 0.25;
export const REGULAR_NODE_WIDTH = 3;

function pickRegularNodeType(random) {
  const roll = random();
  if (roll < COMBAT_NODE_CHANCE) return ExplorationNodeType.COMBAT;
  if (roll < COMBAT_NODE_CHANCE + EVENT_NODE_CHANCE) return ExplorationNodeType.EVENT;
  return ExplorationNodeType.SHOP;
}

/**
 * 총 7단계 탐험 지도를 만든다.
 * 1단계는 최초 전투 맵 하나, 2~6단계는 무작위 노드 3개, 7단계는 보스방 하나다.
 */
export function generateExplorationGraph({
  random = Math.random,
  stageCount = 7,
  minimumRegularWidth = 1,
  maximumRegularWidth = 3,
} = {}) {
  if (stageCount < 3 || minimumRegularWidth < 1 || maximumRegularWidth < minimumRegularWidth) {
    throw new Error("탐험 노드 생성 범위가 올바르지 않습니다.");
  }

  const layers = [];
  const nodes = [];
  const initialNode = {
    id: "node-0-0",
    layer: 0,
    stage: 1,
    row: 0,
    type: ExplorationNodeType.COMBAT,
    isInitialMap: true,
  };
  layers.push([initialNode]);
  nodes.push(initialNode);

  for (let layerIndex = 1; layerIndex < stageCount - 1; layerIndex += 1) {
    const width = REGULAR_NODE_WIDTH;
    const layer = Array.from({ length: width }, (_, nodeIndex) => {
      const node = {
        id: `node-${layerIndex}-${nodeIndex}`,
        layer: layerIndex,
        stage: layerIndex + 1,
        row: nodeIndex,
        type: pickRegularNodeType(random),
      };
      nodes.push(node);
      return node;
    });
    layers.push(layer);
  }

  const bossNode = {
    id: `node-${stageCount - 1}-0`,
    layer: stageCount - 1,
    stage: stageCount,
    row: 0,
    type: ExplorationNodeType.BOSS,
  };
  layers.push([bossNode]);
  nodes.push(bossNode);

  const edgeKeys = new Set();
  const edges = [];
  const connect = (from, to) => {
    const key = `${from.id}>${to.id}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({ from: from.id, to: to.id });
    }
  };

  for (let layerIndex = 0; layerIndex < layers.length - 1; layerIndex += 1) {
    const currentLayer = layers[layerIndex];
    const nextLayer = layers[layerIndex + 1];

    // 다음 단계의 모든 노드가 적어도 하나의 진입 경로를 갖는다.
    nextLayer.forEach((nextNode, index) => connect(currentLayer[index % currentLayer.length], nextNode));
    // 현재 단계의 모든 노드가 적어도 하나의 전진 경로를 갖는다.
    currentLayer.forEach((currentNode, index) => {
      connect(currentNode, nextLayer[index % nextLayer.length]);
      if (nextLayer.length > 1 && random() >= 0.45) {
        connect(currentNode, nextLayer[(index + 1) % nextLayer.length]);
      }
    });
  }

  return {
    nodes,
    layers: layers.map((layer) => layer.map((node) => node.id)),
    edges,
    initialNodeId: initialNode.id,
    bossNodeId: bossNode.id,
    nodeById: Object.fromEntries(nodes.map((node) => [node.id, node])),
    nodeTypeDistributionIsTemporary: true,
  };
}

export function createExplorationState(graph) {
  return {
    currentNodeId: null,
    visitedNodeIds: [],
    availableNodeIds: [...graph.layers[0]],
  };
}

/** 선택 가능한 전진 노드만 허용하며 지나온 단계에는 다시 진입할 수 없다. */
export function selectExplorationNode(graph, state, nodeId) {
  if (!state.availableNodeIds.includes(nodeId)) {
    return state;
  }

  const availableNodeIds = graph.edges
    .filter((edge) => edge.from === nodeId)
    .map((edge) => edge.to);
  return {
    currentNodeId: nodeId,
    visitedNodeIds: [...state.visitedNodeIds, nodeId],
    availableNodeIds,
  };
}
