import assert from "node:assert/strict";
import test from "node:test";
import { createSeededRandom } from "./dungeon-generator.js";
import {
  COMBAT_NODE_CHANCE,
  EVENT_NODE_CHANCE,
  ExplorationNodeType,
  REGULAR_NODE_WIDTH,
  SHOP_NODE_CHANCE,
  createExplorationState,
  generateExplorationGraph,
  selectExplorationNode,
} from "./exploration-nodes.js";

test("일반 단계 노드는 전투 40%, 선택지 35%, 상점 25% 확률을 사용한다", () => {
  assert.equal(COMBAT_NODE_CHANCE, 0.4);
  assert.equal(EVENT_NODE_CHANCE, 0.35);
  assert.equal(SHOP_NODE_CHANCE, 0.25);
  const eventGraph = generateExplorationGraph({ random: () => 0.6, minimumRegularWidth: 1, maximumRegularWidth: 1 });
  assert.ok(eventGraph.nodes.filter((node) => node.stage >= 2 && node.stage <= 6)
    .every((node) => node.type === ExplorationNodeType.EVENT));
  const combatGraph = generateExplorationGraph({ random: () => 0, minimumRegularWidth: 1, maximumRegularWidth: 1 });
  assert.ok(combatGraph.nodes.filter((node) => node.stage >= 2 && node.stage <= 6)
    .every((node) => node.type === ExplorationNodeType.COMBAT));
  const shopGraph = generateExplorationGraph({ random: () => 0.9, minimumRegularWidth: 1, maximumRegularWidth: 1 });
  assert.ok(shopGraph.nodes.filter((node) => node.stage >= 2 && node.stage <= 6)
    .every((node) => node.type === ExplorationNodeType.SHOP));
});

test("탐험 노드는 다음 층으로만 연결되고 마지막 보스 하나로 수렴한다", () => {
  const graph = generateExplorationGraph({ random: createSeededRandom(42) });
  const bossNodes = graph.nodes.filter((node) => node.type === ExplorationNodeType.BOSS);

  assert.equal(bossNodes.length, 1);
  assert.equal(graph.layers.at(-1).length, 1);
  for (const edge of graph.edges) {
    assert.equal(graph.nodeById[edge.to].layer, graph.nodeById[edge.from].layer + 1);
  }
  for (const node of graph.nodes.filter((candidate) => candidate.id !== graph.bossNodeId)) {
    assert.ok(graph.edges.some((edge) => edge.from === node.id));
  }
});

test("탐험 지도는 7단계이며 2~6단계에는 항상 노드가 3개씩 등장한다", () => {
  const graph = generateExplorationGraph({ random: createSeededRandom(18) });
  assert.equal(graph.layers.length, 7);
  assert.equal(graph.layers[0].length, 1);
  assert.equal(graph.nodeById[graph.layers[0][0]].type, ExplorationNodeType.COMBAT);
  assert.equal(graph.nodeById[graph.layers[0][0]].isInitialMap, true);
  assert.equal(REGULAR_NODE_WIDTH, 3);
  assert.ok(graph.layers.slice(1, 6).every((layer) => layer.length === 3));
  assert.deepEqual(graph.layers[6], [graph.bossNodeId]);
  const sixthStageIds = new Set(graph.layers[5]);
  assert.ok([...sixthStageIds].every((nodeId) => graph.edges.some((edge) => (
    edge.from === nodeId && edge.to === graph.bossNodeId
  ))));
});

test("연결된 노드만 선택할 수 있고 지나온 노드로 돌아갈 수 없다", () => {
  const graph = generateExplorationGraph({ random: createSeededRandom(7) });
  let state = createExplorationState(graph);
  const firstNodeId = state.availableNodeIds[0];
  state = selectExplorationNode(graph, state, firstNodeId);

  assert.equal(state.currentNodeId, firstNodeId);
  assert.ok(state.availableNodeIds.every((nodeId) => graph.nodeById[nodeId].layer === 1));
  assert.equal(selectExplorationNode(graph, state, firstNodeId), state);
});
