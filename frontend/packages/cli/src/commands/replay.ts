// gdb replay [kifu.ukdl] — 복기

import { c } from '../colors';
import * as fs from 'fs';

export async function replay(args: string[]): Promise<void> {
  const kifuFile = args[0] ?? './kifu.ukdl';
  if (!fs.existsSync(kifuFile)) {
    console.error(`${c.red}기보 파일 없음: ${kifuFile}${c.reset}`);
    process.exit(1);
  }

  const ukdl = fs.readFileSync(kifuFile, 'utf-8');

  // Parse action nodes from UKDL
  const moves: Array<{
    num: number; intent: string; type: string; badge: string;
    wrBefore: number; wrAfter: number; delta: number;
  }> = [];

  let moveNum = 0;
  const lines = ukdl.split('\n');
  let current: Record<string, string> = {};
  let inAction = false;

  for (const line of lines) {
    if (line.startsWith(':: action')) {
      inAction = true;
      current = { type: line.match(/type=(\S+)/)?.[1] ?? '' };
      continue;
    }
    if (inAction) {
      if (line.trim() === '') {
        inAction = false;
        if (current.intent) {
          moveNum++;
          moves.push({
            num: moveNum,
            intent: current.intent,
            type: current.type,
            badge: current.badge ?? '△후수',
            wrBefore: parseInt(current['win-rate-before'] ?? '0'),
            wrAfter: parseInt(current['win-rate-after'] ?? '0'),
            delta: parseInt(current['delta-win-rate'] ?? '0'),
          });
        }
        current = {};
        continue;
      }
      const [k, ...vs] = line.trim().split(': ');
      if (k && vs.length) current[k.trim()] = vs.join(': ').trim();
    }
  }

  if (moves.length === 0) {
    console.log(`${c.dim}기보에 수가 없습니다.${c.reset}`);
    return;
  }

  console.log(`\n${c.bold}복기 (Kifu Replay)${c.reset}  — ${kifuFile}\n`);
  console.log(`${'수'.padStart(4)} ${'배지'.padEnd(6)} ${'의도'.padEnd(38)} ${'이전':>5} → ${'이후':>5}  ${'변화':>6}`);
  console.log('─'.repeat(75));

  for (const m of moves) {
    const badge = m.badge.includes('묘수') ? `${c.yellow}★묘수${c.reset}` :
                  m.badge.includes('선수') ? `${c.cyan}○선수${c.reset}` :
                  m.badge.includes('정석') ? `${c.green}○정석${c.reset}` :
                  m.badge.includes('실착') ? `${c.red}✗실착${c.reset}` :
                  `${c.dim}△후수${c.reset}`;
    const deltaStr = m.delta >= 0 ? `${c.green}+${m.delta}%${c.reset}` : `${c.red}${m.delta}%${c.reset}`;
    const bar = '▓'.repeat(Math.round(m.wrAfter / 5)) + '░'.repeat(20 - Math.round(m.wrAfter / 5));
    console.log(`  수${String(m.num).padStart(2)} ${badge.padEnd(10)} ${m.intent.slice(0,38).padEnd(38)} ${String(m.wrBefore).padStart(3)}% → ${String(m.wrAfter).padStart(3)}%  ${deltaStr}`);
  }

  console.log('─'.repeat(75));
  const last = moves[moves.length - 1];
  const first = moves[0];
  console.log(`\n  최종 Win-Rate: ${c.bold}${last?.wrAfter ?? 0}%${c.reset}`);
  console.log(`  총 변화: ${(last?.wrAfter ?? 0) - (first?.wrBefore ?? 0) >= 0 ? c.green : c.red}${(last?.wrAfter ?? 0) - (first?.wrBefore ?? 0) >= 0 ? '+' : ''}${(last?.wrAfter ?? 0) - (first?.wrBefore ?? 0)}%${c.reset}  (${moves.length}수)`);

  const myoMoves = moves.filter(m => m.badge.includes('묘수'));
  if (myoMoves.length > 0) {
    console.log(`\n  ${c.yellow}★ 묘수${c.reset}: ${myoMoves.map(m => `수${m.num}(+${m.delta}%)`).join(', ')}`);
  }
}
