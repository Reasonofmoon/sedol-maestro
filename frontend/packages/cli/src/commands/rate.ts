// gdb rate — 승률 표시

import { calcWinRate, WIN_RATE_WEIGHTS } from '@baduck/probability';
import { c } from '../colors';
import * as fs from 'fs';

export async function rate(_args: string[]): Promise<void> {
  if (!fs.existsSync('./board-state.json')) {
    console.error(`${c.red}board-state.json 없음. 먼저 gdb scan 실행.${c.reset}`);
    process.exit(1);
  }
  const board = JSON.parse(fs.readFileSync('./board-state.json', 'utf-8'));
  const result = calcWinRate(board);

  const { value, components, trend, deltaFromPrev } = result;
  const trendStr = trend === 'rising' ? `${c.green}↗ 상승 (+${deltaFromPrev}%)${c.reset}` :
                   trend === 'falling' ? `${c.red}↘ 하락 (${deltaFromPrev}%)${c.reset}` :
                   `${c.dim}→ 유지${c.reset}`;

  console.log(`\n${c.bold}PROJECT VITALITY${c.reset}\n`);

  const bar = '█'.repeat(Math.round(value / 5)) + '░'.repeat(20 - Math.round(value / 5));
  const barColour = value >= 70 ? c.green : value >= 40 ? c.yellow : c.red;
  console.log(`  ${barColour}${bar}${c.reset}  ${c.bold}${value}%${c.reset}  ${trendStr}`);
  console.log(``);

  // Component breakdown
  console.log(`${c.bold}구성 요소:${c.reset}`);
  const keys = Object.keys(WIN_RATE_WEIGHTS) as Array<keyof typeof WIN_RATE_WEIGHTS>;
  const labels: Record<string, string> = {
    healthScore:    '모듈 건강도  (×0.35)',
    testCoverage:   '테스트 커버리지 (×0.25)',
    complexityInv:  '복잡도 역수  (×0.20)',
    velocity:       '개발 속도    (×0.10)',
    debtRatioInv:   '기술 부채 역수 (×0.10)',
  };
  for (const k of keys) {
    const v = components[k];
    const contribution = Math.round(v * WIN_RATE_WEIGHTS[k] * 100);
    const miniBar = '▓'.repeat(Math.round(v * 10)) + '░'.repeat(10 - Math.round(v * 10));
    console.log(`  ${labels[k].padEnd(25)} ${miniBar}  ${(v*100).toFixed(0).padStart(3)}%  (기여 ${contribution}%)`);
  }

  console.log(``);
  console.log(`${c.dim}세계 최고 수준 목표: 90%+${c.reset}`);
}
