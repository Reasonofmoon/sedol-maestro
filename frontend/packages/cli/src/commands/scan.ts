// gdb scan [dir] — 판 읽기

import { buildBoardState } from '@baduck/encoder';
import { boardToUKDL } from '@baduck/ukdl-bridge';
import { calcWinRate } from '@baduck/probability';
import { c } from '../colors';
import * as fs from 'fs';
import * as path from 'path';

export async function scan(args: string[]): Promise<void> {
  const targetDir = args[0] ?? './src';
  const absDir = path.resolve(targetDir);

  console.log(`\n${c.bold}${c.cyan}판 읽기 (Board Scan)${c.reset}`);
  console.log(`${c.dim}└ 대상: ${absDir}${c.reset}\n`);

  // Spinner frames
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let frameIdx = 0;
  const spinner = setInterval(() => {
    process.stdout.write(`\r${c.cyan}${frames[frameIdx++ % frames.length]}${c.reset} 스캔 중...`);
  }, 80);

  let board;
  try {
    board = await buildBoardState(absDir);
  } finally {
    clearInterval(spinner);
    process.stdout.write('\r');
  }

  const winRateResult = calcWinRate(board);

  // Save board state
  fs.writeFileSync('./board-state.json', JSON.stringify(board, null, 2));

  // Generate UKDL
  const sessionId = Date.now().toString(36);
  const ukdlText = boardToUKDL(board, sessionId, winRateResult.value);
  fs.writeFileSync('./board-state.ukdl', ukdlText);

  // ── Output ──────────────────────────────────────────────
  const summary = board.summary;
  const trendIcon = winRateResult.trend === 'rising' ? '↗' : winRateResult.trend === 'falling' ? '↘' : '→';

  console.log(`${c.bold}스캔 결과${c.reset}`);
  console.log(`  파일: ${c.cyan}${summary.totalFiles}${c.reset}개  |  라인: ${c.cyan}${summary.totalLines.toLocaleString()}${c.reset}줄`);
  console.log(`  패(순환 의존성): ${board.graph.cycles.length > 0 ? c.red : c.green}${board.graph.cycles.length}개${c.reset}`);
  console.log(`  단수(위험 모듈): ${c.yellow}${summary.riskModules.length}개${c.reset}`);
  if (summary.riskModules.length > 0) {
    summary.riskModules.slice(0, 3).forEach(r => {
      console.log(`    ${c.red}▼${c.reset} ${r}`);
    });
  }
  console.log(`  평균 복잡도: ${summary.avgComplexity.toFixed(1)}`);
  console.log(`  전체 건강도: ${summary.overallHealth >= 0 ? c.green : c.red}${summary.overallHealth.toFixed(3)}${c.reset}`);
  console.log(``);
  console.log(`${c.bold}PROJECT VITALITY${c.reset}  ${winRateResult.label}  ${trendIcon}`);
  console.log(``);
  console.log(`${c.dim}→ board-state.json, board-state.ukdl 저장됨${c.reset}`);
  console.log(`${c.dim}→ 다음: ${c.reset}${c.cyan}gdb think${c.reset}${c.dim} 으로 수읽기 시작${c.reset}`);
}
