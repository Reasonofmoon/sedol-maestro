// gdb think [--sims N] — 수읽기 (MCTS)

import { searchPlan } from '@baduck/mcts';
import { detectMyo } from '@baduck/mcts';
import { calcWinRate, rankMoves, formatCandidatesPanel } from '@baduck/probability';
import { c } from '../colors';
import * as fs from 'fs';

export async function think(args: string[]): Promise<void> {
  // Parse --sims
  const simsIdx = args.indexOf('--sims');
  const numSims = simsIdx >= 0 ? parseInt(args[simsIdx + 1] ?? '48') : 48;
  const depth = 3;

  // Load board state
  if (!fs.existsSync('./board-state.json')) {
    console.error(`${c.red}board-state.json 없음. 먼저 gdb scan 실행.${c.reset}`);
    process.exit(1);
  }
  const board = JSON.parse(fs.readFileSync('./board-state.json', 'utf-8'));
  const winRate = calcWinRate(board);

  console.log(`\n${c.bold}${c.cyan}수읽기 (MCTS Search)${c.reset}`);
  console.log(`${c.dim}└ 시뮬레이션: ${numSims}회  깊이: ${depth}수${c.reset}\n`);

  // Progress bar
  const startMs = Date.now();
  process.stdout.write(`Thinking... `);
  const interval = setInterval(() => {
    const elapsed = Date.now() - startMs;
    const done = Math.min(numSims, Math.round(numSims * elapsed / 5000));
    const bar = '█'.repeat(Math.round(done / numSims * 20)) + '░'.repeat(20 - Math.round(done / numSims * 20));
    process.stdout.write(`\r${c.cyan}${bar}${c.reset} ${done}/${numSims}`);
  }, 200);

  let searchResult;
  try {
    searchResult = await searchPlan(board, { numSimulations: numSims, maxDepth: depth });
  } finally {
    clearInterval(interval);
    process.stdout.write(`\r${'█'.repeat(20)} ${numSims}/${numSims}  (${((Date.now() - startMs)/1000).toFixed(1)}s)\n\n`);
  }

  // Save search result
  fs.writeFileSync('./think-result.json', JSON.stringify(searchResult, null, 2));

  // Build candidate display
  const ctx = {
    atariModules: board.summary.riskModules,
    cycles: board.graph.cycles,
  };

  const candidates = rankMoves(searchResult.root, board, winRate.value, ctx);
  const elapsed = Date.now() - startMs;
  console.log(formatCandidatesPanel(candidates, numSims, elapsed));

  // Highlight top myo if found
  const top = candidates[0];
  if (top?.myo.isMyo) {
    console.log(`\n${c.yellow}${c.bold}★ 묘수 발견!${c.reset} ${top.action.intent}`);
    console.log(`${c.dim}  승률 ${winRate.value}% → ${top.projectedWinRate}% (+${top.deltaWinRate}%)${c.reset}`);
    top.myo.reasons.forEach(r => console.log(`  ${c.yellow}→${c.reset} ${r}`));
  }

  // Show sente chain
  if (searchResult.bestPath.length > 1) {
    console.log(`\n${c.bold}수읽기 (${searchResult.bestPath.length}수):${c.reset}`);
    searchResult.bestPath.forEach((step, i) => {
      const prefix = i === 0 ? `수①` : `  └수${['②','③','④'][i] ?? (i+1).toString()}`;
      const badge = step.evaluation >= 0.15 ? `${c.yellow}★묘수${c.reset}` :
                    step.evaluation >= 0.05 ? `${c.cyan}○선수${c.reset}` :
                    `${c.dim}△후수${c.reset}`;
      console.log(`  ${prefix} ${badge} ${step.action.intent.slice(0,40)}  ΔWin${step.evaluation>=0?'+':''}${Math.round(step.evaluation*100)}%`);
    });
  }

  console.log(`\n${c.dim}→ think-result.json 저장됨${c.reset}`);
  console.log(`${c.dim}→ 다음: ${c.reset}${c.cyan}gdb move ${candidates[0]?.action.id ?? '<action-id>'}${c.reset}`);
}
