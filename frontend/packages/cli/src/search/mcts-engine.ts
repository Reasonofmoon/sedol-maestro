/**
 * 碁道コーティング — MCTS Engine
 *
 * AlphaGo Zero MCTS의 4단계를 소프트웨어 개발에 적용:
 *   1. Selection (선택)   — PUCT로 최유망 경로 탐색
 *   2. Expansion (확장)   — 정책 엔진(LLM)으로 후보 행동 생성
 *   3. Evaluation (평가)  — 가치 엔진(피트니스 함수)으로 가치 추정
 *   4. Backpropagation (역전파) — 경로 Q값/방문 횟수 갱신
 *
 * LATS(Language Agent Tree Search) 참조:
 * - LLM이 행동 생성기 + 가치 함수 + 반영 메커니즘 3역할 동시 수행
 */

import type { BoardState, DevAction } from '../encoder/types.js';
import { generateActions } from '../policy/policy-engine.js';
import { evaluateAction, type FitnessEvaluation } from '../value/fitness-function.js';
import {
  createRootNode,
  createChildNode,
  selectChild,
  backpropagate,
  selectFinalMove,
  addDirichletNoise,
  DEFAULT_CONFIG,
  type MCTSNode,
  type MCTSConfig,
} from './mcts-node.js';
import { generateReflection } from './reflection.js';
import type { LLMConfig } from '../policy/llm-provider.js';

export interface SearchResult {
  /** The best development path found */
  bestPath: PathStep[];
  /** The root node of the MCTS tree (for visualization) */
  root: MCTSNode;
  /** Total simulations run */
  totalSimulations: number;
  /** Search config used */
  config: MCTSConfig;
  /** Reflections generated during search */
  reflections: string[];
}

export interface PathStep {
  action: DevAction;
  evaluation: FitnessEvaluation;
  cumulativeHealth: number;
  depth: number;
}

/**
 * Run MCTS search to find the optimal development path.
 *
 * This is the entry point for `gido plan`.
 *
 * Like AlphaGo playing a game, each simulation:
 * 1. Traverses the tree following PUCT until a leaf
 * 2. Expands the leaf by generating new candidate actions
 * 3. Evaluates the leaf's value using the fitness function
 * 4. Backpropagates the value up the tree
 */
export async function searchPlan(
  boardState: BoardState,
  configOverride?: Partial<MCTSConfig>,
  llmConfig?: Partial<LLMConfig>
): Promise<SearchResult> {
  const config = { ...DEFAULT_CONFIG, ...configOverride };
  const root = createRootNode(boardState);
  const reflections: string[] = [];

  // Phase 1: Initial expansion at root
  await expandNode(root, boardState, llmConfig);

  // Add Dirichlet noise to root for exploration
  addDirichletNoise(root, config);

  // Phase 2: Run simulations
  for (let sim = 0; sim < config.numSimulations; sim++) {
    // Selection: traverse tree using PUCT
    let current = root;
    while (current.children.length > 0 && current.depth < config.maxDepth) {
      const selected = selectChild(current, config);
      if (!selected) break;
      current = selected;
    }

    // Expansion: if leaf is not at max depth, expand it
    if (current.depth < config.maxDepth && current.children.length === 0) {
      await expandNode(current, boardState, llmConfig);
    }

    // Evaluation: compute leaf value
    const value = evaluateLeaf(current, boardState, root.estimatedHealth);

    // Reflection: if value is poor, generate a reflection
    if (value < 0 && current.action) {
      const reflection = await generateReflection(current, boardState, llmConfig);
      if (reflection) {
        current.reflections.push(reflection);
        reflections.push(reflection);
      }
    }

    // Backpropagation: update Q values up the tree
    backpropagate(current, value);
  }

  // Extract best path
  const bestPath = extractBestPath(root, boardState, config);

  return {
    bestPath,
    root,
    totalSimulations: config.numSimulations,
    config,
    reflections,
  };
}

/**
 * Expand a node by generating candidate actions.
 */
async function expandNode(
  node: MCTSNode,
  boardState: BoardState,
  llmConfig?: Partial<LLMConfig>
): Promise<void> {
  // Add reflection context to guide generation
  const contextOverride = node.reflections.length > 0
    ? { reflections: node.reflections }
    : undefined;

  const policyOutput = await generateActions(boardState, llmConfig);

  for (let i = 0; i < policyOutput.actions.length; i++) {
    const action = policyOutput.actions[i];
    const evaluation = evaluateAction(action, boardState);
    const estimatedHealth = node.estimatedHealth + evaluation.deltaHealth;
    createChildNode(node, action, estimatedHealth, i);
  }
}

/**
 * Evaluate a leaf node's value.
 * Returns a value in [-1, +1] representing the quality of this position.
 */
function evaluateLeaf(
  leaf: MCTSNode,
  boardState: BoardState,
  rootHealth: number
): number {
  // Value = how much better this path is than the starting position
  const healthImprovement = leaf.estimatedHealth - rootHealth;

  // Normalize to [-1, +1]
  return Math.max(-1, Math.min(1, healthImprovement * 5));
}

/**
 * Extract the best path from root to leaf by following most-visited children.
 */
function extractBestPath(
  root: MCTSNode,
  boardState: BoardState,
  config: MCTSConfig
): PathStep[] {
  const path: PathStep[] = [];
  let current = root;
  let cumulativeHealth = root.estimatedHealth;

  while (current.children.length > 0) {
    // Select most-visited child (greedy — τ=0 for final path)
    const best = selectFinalMove(current, 0);
    if (!best || !best.action) break;

    const evaluation = evaluateAction(best.action, boardState);
    cumulativeHealth += evaluation.deltaHealth;

    path.push({
      action: best.action,
      evaluation,
      cumulativeHealth: Math.round(cumulativeHealth * 100) / 100,
      depth: best.depth,
    });

    current = best;
  }

  return path;
}
