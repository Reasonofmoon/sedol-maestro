// gdb move <action-id> — 착점 (수 확정)

import { calcWinRate } from '@baduck/probability';
import { KifuRecorder } from '@baduck/kifu';
import { detectMyo } from '@baduck/mcts';
import { c } from '../colors';
import * as fs from 'fs';

export async function move(args: string[]): Promise<void> {
  const actionId = args[0];
  if (!actionId) {
    console.error(`${c.red}액션 ID 필요. 예: gdb move act:extract-auth${c.reset}`);
    process.exit(1);
  }

  // Load state
  const board = JSON.parse(fs.readFileSync('./board-state.json', 'utf-8'));
  const thinkResult = fs.existsSync('./think-result.json')
    ? JSON.parse(fs.readFileSync('./think-result.json', 'utf-8'))
    : null;

  const winRateBefore = calcWinRate(board).value;

  // Find the action
  const action = thinkResult?.bestPath?.find((p: any) => p.action?.id === actionId)?.action
    ?? thinkResult?.root?.children?.find((c: any) => c.action?.id === actionId)?.action;

  if (!action) {
    console.error(`${c.red}액션 '${actionId}' 를 think-result.json 에서 찾을 수 없습니다.${c.reset}`);
    console.error(`먼저 gdb think 를 실행하세요.`);
    process.exit(1);
  }

  // Find MCTS node for myo detection
  const node = thinkResult?.root?.children?.find((c: any) => c.action?.id === actionId)
    ?? { getQ: () => action.deltaHealth, prior: action.prior, visits: 1, children: [], depth: 1, id: '', puctScore: () => 0 };
  const topChildren = node.children?.slice(0,3) ?? [];
  const ctx = { atariModules: board.summary.riskModules, cycles: board.graph.cycles };
  const myo = detectMyo(action, node, topChildren, ctx);

  const winRateAfter = winRateBefore + Math.round(action.deltaHealth * 50);

  // Record in kifu
  const recorder = new KifuRecorder(board.rootDir, './kifu.ukdl');

  // Load existing kifu if present
  const recorded = recorder.recordMove(action, myo, winRateBefore, winRateAfter, board);

  // Output
  const badge = myo.isMyo ? `${c.yellow}★ 묘수!${c.reset}` :
                myo.badgeLabel === '○선수' ? `${c.cyan}○ 선수${c.reset}` :
                myo.badgeLabel === '○정석' ? `${c.green}○ 정석${c.reset}` :
                `${c.dim}△ 후수${c.reset}`;

  console.log(`\n${c.bold}착점 완료${c.reset}  ${badge}\n`);
  console.log(`  수${recorded.moveNumber}: ${action.intent}`);
  console.log(`  대상: ${action.target}`);
  console.log(`  ΔHealth: ${action.deltaHealth >= 0 ? '+' : ''}${action.deltaHealth.toFixed(3)}`);
  console.log(``);

  const barBefore = '█'.repeat(Math.round(winRateBefore/5)) + '░'.repeat(20-Math.round(winRateBefore/5));
  const barAfter  = '█'.repeat(Math.round(winRateAfter/5))  + '░'.repeat(20-Math.round(winRateAfter/5));
  const delta = winRateAfter - winRateBefore;
  const dStr = delta >= 0 ? `${c.green}▲ +${delta}%${c.reset}` : `${c.red}▼ ${delta}%${c.reset}`;

  console.log(`  이전: ${barBefore} ${winRateBefore}%`);
  console.log(`  이후: ${barAfter} ${winRateAfter}%  ${dStr}`);

  if (myo.isMyo) {
    console.log(``);
    myo.reasons.forEach(r => console.log(`  ${c.yellow}→${c.reset} ${r}`));
  }

  console.log(`\n${c.dim}→ kifu.ukdl 업데이트됨${c.reset}`);
  console.log(`${c.dim}→ 다음: ${c.reset}${c.cyan}gdb scan${c.reset}${c.dim} 으로 수 결과 확인${c.reset}`);
}
