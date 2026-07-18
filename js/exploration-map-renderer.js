const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const NODE_LABELS = Object.freeze({
  combat: "전투",
  shop: "상점",
  event: "선택",
  boss: "보스",
});

function nodePosition(graph, node) {
  const layerCount = graph.layers.length;
  const layer = graph.layers[node.layer];
  return {
    x: 8 + (node.layer / Math.max(layerCount - 1, 1)) * 84,
    y: 50 + (node.row - (layer.length - 1) / 2) * Math.min(22, 62 / Math.max(layer.length - 1, 1)),
  };
}

/** 탐험 노드와 단방향 연결선을 화면에 그린다. */
export function renderExplorationMap(container, graph, state, onSelect) {
  const connectorLayer = document.createElementNS(SVG_NAMESPACE, "svg");
  connectorLayer.classList.add("exploration-connectors");
  connectorLayer.setAttribute("viewBox", "0 0 100 100");
  connectorLayer.setAttribute("preserveAspectRatio", "none");
  connectorLayer.setAttribute("aria-hidden", "true");

  for (const edge of graph.edges) {
    const from = nodePosition(graph, graph.nodeById[edge.from]);
    const to = nodePosition(graph, graph.nodeById[edge.to]);
    const line = document.createElementNS(SVG_NAMESPACE, "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    connectorLayer.append(line);
  }

  const nodeButtons = graph.nodes.map((node) => {
    const position = nodePosition(graph, node);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "exploration-node";
    button.dataset.nodeId = node.id;
    button.dataset.nodeType = node.type;
    button.style.left = `${position.x}%`;
    button.style.top = `${position.y}%`;
    button.textContent = NODE_LABELS[node.type];
    button.disabled = !state.availableNodeIds.includes(node.id);
    button.classList.toggle("is-current", state.currentNodeId === node.id);
    button.classList.toggle("is-visited", state.visitedNodeIds.includes(node.id));
    button.addEventListener("click", () => onSelect(node.id));
    return button;
  });

  container.replaceChildren(connectorLayer, ...nodeButtons);
}
