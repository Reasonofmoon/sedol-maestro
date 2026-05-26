/**
 * 碁道코딩 — MCTS Node
 *
 * AlphaGo Zero의 MCTS 트리 노드 대응.
 * 각 노드는 코드베이스의 한 "상태"와 그 상태에 도달하기 위해 취한 "행동"을 나타낸다.
 *
 * PUCT 선택 공식:
 *   score(s,a) = Q(s,a) + c_puct × P(s,a) × √(Σ_b N(s,b)) / (1 + N(s,a))
 *
 * Q(s,a) = 평균 행동 가치 (활용, exploitation)
 * P(s,a) = 정책 사전확률 (탐색, exploration)
 * N(s,a) = 방문 횟수
 */

import type { DevAction, BoardState } from '../encoder/types.js';

export interface MCTSNode {
  /** Unique node ID */
  id: string;
  /** The DevAction that led to this state (null for root) */
  action: DevAction | null;
  /** Simulated board state at this node */
  estimatedHealth: number;
  /** Parent node (null for root) */
  parent: MCTSNode | null;
  /** Child nodes */
  children: MCTSNode[];
  /** Visit count N(s,a) */
  visits: number;
  /** Total accumulated value W(s,a) */
  totalValue: number;
  /** Prior probability P(s,a) from policy network */
  prior: number;
  /** Depth in the tree (0 = root) */
  depth: number;
  /** Reflection notes from failed paths */
  reflections: string[];
}

/** MCTS hyperparameters */
export interface MCTSConfig {
  /** Exploration constant c_puct (higher = more exploration) */
  cPuct: number;
  /** Maximum tree depth (number of moves to look ahead) */
  maxDepth: number;
  /** Number of simulations to run */
  numSimulations: number;
  /** Temperature τ for final move selection (lower = more greedy) */
  temperature: number;
  /** Dirichlet noise alpha for root exploration */
  dirichletAlpha: number;
  /** Dirichlet noise weight */
  dirichletEpsilon: number;
}

export const DEFAULT_CONFIG: MCTSConfig = {
  cPuct: 1.5,          // Exploration constant (AlphaGo Zero uses ~1.0-2.5)
  maxDepth: 3,          // 3수 앞까지 탐색 (= 3 development steps ahead)
  numSimulations: 12,   // 12 simulations (vs AlphaGo's 1600 — LLM cost constraint)
  temperature: 1.0,     // τ=1 for balanced exploration/exploitation
  dirichletAlpha: 0.3,  // Root noise (AlphaGo Zero uses 0.03 for 19x19)
  dirichletEpsilon: 0.25,
};

/**
 * Calculate the mean action value Q(s,a).
 */
export function getQ(node: MCTSNode): number {
  return node.visits > 0 ? node.totalValue / node.visits : 0;
}

/**
 * Calculate PUCT score for selecting child nodes.
 * 
 * This is the core of AlphaGo's tree traversal strategy:
 * - High Q → exploit nodes with proven value
 * - High P with low N → explore promising but unvisited nodes
 */
export function puctScore(child: MCTSNode, parentVisits: number, config: MCTSConfig): number {
  const q = getQ(child);
  const u = config.cPuct * child.prior * Math.sqrt(parentVisits) / (1 + child.visits);
  return q + u;
}

/**
 * Select the best child using PUCT.
 */
export function selectChild(node: MCTSNode, config: MCTSConfig): MCTSNode | null {
  if (node.children.length === 0) return null;

  let bestScore = -Infinity;
  let bestChild: MCTSNode | null = null;

  for (const child of node.children) {
    const score = puctScore(child, node.visits, config);
    if (score > bestScore) {
      bestScore = score;
      bestChild = child;
    }
  }

  return bestChild;
}

/**
 * Create the root node from the current board state.
 */
export function createRootNode(boardState: BoardState): MCTSNode {
  return {
    id: 'root',
    action: null,
    estimatedHealth: boardState.summary.overallHealth,
    parent: null,
    children: [],
    visits: 0,
    totalValue: 0,
    prior: 1.0,
    depth: 0,
    reflections: [],
  };
}

/**
 * Create a child node from a DevAction.
 */
export function createChildNode(
  parent: MCTSNode,
  action: DevAction,
  estimatedHealth: number,
  childIndex: number
): MCTSNode {
  const child: MCTSNode = {
    id: `${parent.id}-${childIndex}`,
    action,
    estimatedHealth,
    parent,
    children: [],
    visits: 0,
    totalValue: 0,
    prior: action.prior,
    depth: parent.depth + 1,
    reflections: [],
  };
  parent.children.push(child);
  return child;
}

/**
 * Backpropagate the evaluation value up the tree.
 * Each ancestor node's visit count and total value are updated.
 */
export function backpropagate(node: MCTSNode, value: number): void {
  let current: MCTSNode | null = node;
  while (current !== null) {
    current.visits += 1;
    current.totalValue += value;
    current = current.parent;
  }
}

/**
 * Select the final move from the root's children based on visit count.
 * π_a ∝ N(root, a)^(1/τ)
 */
export function selectFinalMove(root: MCTSNode, temperature: number): MCTSNode | null {
  if (root.children.length === 0) return null;

  if (temperature === 0) {
    // Greedy: pick most-visited child
    return root.children.reduce((best, c) => c.visits > best.visits ? c : best, root.children[0]);
  }

  // Temperature-weighted sampling by visit count
  const weights = root.children.map(c => Math.pow(c.visits, 1 / temperature));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  let rand = Math.random() * totalWeight;
  for (let i = 0; i < root.children.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return root.children[i];
  }

  return root.children[root.children.length - 1];
}

/**
 * Add Dirichlet noise to root priors for exploration.
 * This prevents the search from becoming deterministic.
 */
export function addDirichletNoise(root: MCTSNode, config: MCTSConfig): void {
  if (root.children.length === 0) return;

  const noise = dirichletSample(root.children.length, config.dirichletAlpha);
  const eps = config.dirichletEpsilon;

  for (let i = 0; i < root.children.length; i++) {
    root.children[i].prior = (1 - eps) * root.children[i].prior + eps * noise[i];
  }
}

/**
 * Sample from a symmetric Dirichlet distribution.
 */
function dirichletSample(n: number, alpha: number): number[] {
  // Use gamma distribution sampling via the Box-Muller-like approximation
  const samples = Array.from({ length: n }, () => gammaSample(alpha));
  const sum = samples.reduce((s, x) => s + x, 0);
  return samples.map(x => x / sum);
}

function gammaSample(alpha: number): number {
  // Marsaglia & Tsang's method for alpha >= 1
  // For alpha < 1, use alpha+1 then adjust
  if (alpha < 1) {
    return gammaSample(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
  }

  const d = alpha - 1/3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x: number, v: number;
    do {
      x = normalRandom();
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();

    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function normalRandom(): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
