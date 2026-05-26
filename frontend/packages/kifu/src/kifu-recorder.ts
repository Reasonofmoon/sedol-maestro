// ============================================================
// Kifu Recorder — Development Game Record
// 기보(棋譜): Every move recorded as executable UKDL
// The kifu IS the project history — replayable, annotatable,
// shareable, and diffable like a Go game record.
// ============================================================

import type { DevAction } from '@baduck/encoder';
import type { MyoResult } from '@baduck/mcts';
import { boardToUKDL } from '@baduck/ukdl-bridge';
import type { BoardState } from '@baduck/encoder';
import * as fs from 'fs';
import * as path from 'path';

export interface KifuMove {
  moveNumber: number;
  action: DevAction;
  myo: MyoResult;
  winRateBefore: number;
  winRateAfter: number;
  deltaWinRate: number;
  boardPos: [number, number];
  timestamp: Date;
  annotation?: string;      // LLM-generated post-hoc explanation
  boardStateSnapshot?: BoardState;
}

export interface KifuRecord {
  sessionId: string;
  projectName: string;
  rootDir: string;
  startedAt: Date;
  moves: KifuMove[];
  currentWinRate: number;
  totalMoves: number;
  myoCount: number;
}

export class KifuRecorder {
  private record: KifuRecord;
  private kifuPath: string;

  constructor(rootDir: string, kifuPath = './kifu.ukdl') {
    this.kifuPath = kifuPath;
    this.record = {
      sessionId: Date.now().toString(36),
      projectName: path.basename(rootDir),
      rootDir,
      startedAt: new Date(),
      moves: [],
      currentWinRate: 0,
      totalMoves: 0,
      myoCount: 0,
    };
  }

  /** Record a move played */
  recordMove(
    action: DevAction,
    myo: MyoResult,
    winRateBefore: number,
    winRateAfter: number,
    boardStateSnapshot?: BoardState,
  ): KifuMove {
    const moveNumber = this.record.moves.length + 1;
    const boardPos = actionToBoardPos(action, moveNumber);
    const move: KifuMove = {
      moveNumber,
      action,
      myo,
      winRateBefore,
      winRateAfter,
      deltaWinRate: winRateAfter - winRateBefore,
      boardPos,
      timestamp: new Date(),
      boardStateSnapshot,
    };
    this.record.moves.push(move);
    this.record.currentWinRate = winRateAfter;
    this.record.totalMoves = moveNumber;
    if (myo.isMyo) this.record.myoCount++;

    this.save();
    return move;
  }

  /** Add annotation to a move */
  annotate(moveNumber: number, annotation: string): void {
    const move = this.record.moves.find(m => m.moveNumber === moveNumber);
    if (move) {
      move.annotation = annotation;
      this.save();
    }
  }

  /** Save kifu as executable UKDL */
  save(): void {
    const ukdl = this.toUKDL();
    fs.writeFileSync(this.kifuPath, ukdl, 'utf-8');
  }

  /** Convert to UKDL format */
  toUKDL(): string {
    const r = this.record;
    const lines: string[] = [];

    lines.push(`:: meta id=kifu-${r.sessionId}`);
    lines.push(`  title: ${r.projectName} 기보 (Game Record)`);
    lines.push(`  version: 1.0.0`);
    lines.push(`  date: ${r.startedAt.toISOString().slice(0,10)}`);
    lines.push(`  level: L5`);
    lines.push(`  root-dir: ${r.rootDir}`);
    lines.push(`  total-moves: ${r.totalMoves}`);
    lines.push(`  win-rate: ${r.currentWinRate}`);
    lines.push(`  myo-count: ${r.myoCount}`);
    lines.push(``);

    // Win-rate trajectory as block
    const trajectory = r.moves.map(m => m.winRateAfter).join(', ');
    lines.push(`:: block id=blk:win-rate-trajectory`);
    lines.push(`  ## Win-Rate 궤적`);
    lines.push(`  시작 → ${r.moves[0]?.winRateBefore ?? 0}% → [${trajectory}]`);
    lines.push(`  최대 수 폭: ${Math.max(...r.moves.map(m => Math.abs(m.deltaWinRate)))}%`);
    lines.push(``);

    // Each move as action node
    for (const move of r.moves) {
      const dH = move.action.deltaHealth >= 0 ? `+${move.action.deltaHealth.toFixed(3)}` : move.action.deltaHealth.toFixed(3);
      lines.push(`:: action id=${move.action.id} type=${move.action.type}`);
      lines.push(`  kind: ${move.action.actionKind}`);
      lines.push(`  intent: ${move.action.intent}`);
      lines.push(`  prior: ${move.action.prior.toFixed(3)}`);
      lines.push(`  delta-health: ${dH}`);
      lines.push(`  win-rate-before: ${move.winRateBefore}`);
      lines.push(`  win-rate-after: ${move.winRateAfter}`);
      lines.push(`  delta-win-rate: ${move.deltaWinRate >= 0 ? '+' : ''}${move.deltaWinRate}`);
      if (move.myo.isMyo) {
        lines.push(`  badge: 묘수`);
        lines.push(`  myo-score: ${move.myo.myoScore}`);
        lines.push(`  myo-reasons: [${move.myo.reasons.join(', ')}]`);
      } else {
        lines.push(`  badge: ${move.myo.badgeLabel}`);
      }
      lines.push(`  board-pos: [${move.boardPos[0]}, ${move.boardPos[1]}]`);
      lines.push(`  timestamp: ${move.timestamp.toISOString()}`);
      if (move.annotation) {
        lines.push(`  annotation: ${move.annotation}`);
      }
      lines.push(``);
    }

    // Myo moves summary
    const myoMoves = r.moves.filter(m => m.myo.isMyo);
    if (myoMoves.length > 0) {
      lines.push(`:: block id=blk:myo-summary`);
      lines.push(`  ## 묘수 정리`);
      for (const m of myoMoves) {
        lines.push(`  수${m.moveNumber}: ${m.action.intent} (+${m.deltaWinRate}%, 점수 ${m.myo.myoScore})`);
      }
      lines.push(``);
    }

    return lines.join('\n');
  }

  getRecord(): KifuRecord { return this.record; }
}

/** Map action target to board coordinates */
function actionToBoardPos(action: DevAction, moveNumber: number): [number, number] {
  // Hash the target path to a board position
  const hash = action.target.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) & 0xFFFF, 0);
  const x = hash % 19;
  const y = (hash >> 4) % 19;
  return [x, y];
}
