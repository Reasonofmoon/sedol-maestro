/**
 * 碁道코딩 — Move Evaluator
 *
 * Orchestrates Policy Engine → Value Engine pipeline.
 * This is the full "수 읽기(reading moves)" flow:
 *   1. Board Encoder produces BoardState (Phase 1)
 *   2. Policy Engine generates candidate DevActions (this phase)
 *   3. Value Engine evaluates each action's ΔHealth (this phase)
 *   4. Actions are ranked and presented to the user
 */

import type { BoardState } from '../encoder/types.js';
import { generateActions } from '../policy/policy-engine.js';
import { evaluateAllActions, type FitnessEvaluation } from './fitness-function.js';
import type { LLMConfig } from '../policy/llm-provider.js';

export interface AnalysisResult {
  /** Board state at time of analysis */
  boardState: BoardState;
  /** Evaluated and ranked actions */
  evaluations: FitnessEvaluation[];
  /** Model/mode used for policy generation */
  policyModel: string;
  policyMode: 'llm' | 'heuristic';
  /** LLM usage stats (if applicable) */
  usage?: { inputTokens: number; outputTokens: number };
  /** Analysis timestamp */
  analyzedAt: string;
}

/**
 * Run the full analysis pipeline: Scan → Policy → Value → Rank.
 *
 * This is the entry point for `gido analyze`.
 */
export async function analyzeProject(
  boardState: BoardState,
  llmConfig?: Partial<LLMConfig>
): Promise<AnalysisResult> {
  // Step 1: Generate candidate actions (Policy Engine)
  const policyOutput = await generateActions(boardState, llmConfig);

  // Step 2: Evaluate each action's fitness (Value Engine)
  const evaluations = evaluateAllActions(policyOutput.actions, boardState);

  return {
    boardState,
    evaluations,
    policyModel: policyOutput.model,
    policyMode: policyOutput.mode,
    usage: policyOutput.usage,
    analyzedAt: new Date().toISOString(),
  };
}
