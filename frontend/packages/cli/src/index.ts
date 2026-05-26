#!/usr/bin/env node
// ============================================================
// gdb — Baduck Coding CLI
// 바둑처럼 코딩하는 커맨드라인 워크벤치
//
// Commands:
//   gdb scan [dir]          판 읽기 — 코드베이스 분석
//   gdb think [--sims N]    수읽기 — MCTS 탐색
//   gdb move <action-id>    착점 — 수 실행
//   gdb rate                승률 — Win-Rate 표시
//   gdb replay [file]       복기 — 기보 재생
// ============================================================

import { scan }   from './commands/scan';
import { think }  from './commands/think';
import { move }   from './commands/move';
import { rate }   from './commands/rate';
import { replay } from './commands/replay';
import { c }      from './colors';

const VERSION = '1.0.0';

const HELP = `
${c.bold}${c.cyan}gdb${c.reset} — Baduck Coding Workbench v${VERSION}
${c.dim}바둑처럼 두면 세계 최고 수준의 앱이 만들어진다${c.reset}

${c.bold}COMMANDS:${c.reset}
  ${c.cyan}gdb scan${c.reset} [dir]              판 읽기 — 코드베이스 전체 분석
  ${c.cyan}gdb think${c.reset} [--sims N]        수읽기 — MCTS ${c.dim}(기본 48회)${c.reset}
  ${c.cyan}gdb move${c.reset} <action-id>        착점 — 수 확정 + 기보 기록
  ${c.cyan}gdb rate${c.reset}                    승률 — Win-Rate 실시간 표시
  ${c.cyan}gdb replay${c.reset} [kifu.ukdl]      복기 — 기보 재생

${c.bold}EXAMPLES:${c.reset}
  npx gdb scan ./src
  npx gdb think --sims 96
  npx gdb move act:extract-auth
  npx gdb rate
  npx gdb replay ./kifu.ukdl

${c.bold}METAPHOR:${c.reset}
  ${c.yellow}★ 묘수${c.reset}  Q > Prior×1.5 + 연쇄 선수 + 다중 위험 해소
  ${c.cyan}○ 선수${c.reset}  주도적 개선, 다음 수를 선수로 만듦
  ${c.green}○ 정석${c.reset}  검증된 패턴 적용
  ${c.dim}△ 후수${c.reset}  반응적 수정
  ${c.red}✗ 실착${c.reset}  ΔHealth < -0.10, 피해야 할 수
`;

async function main() {
  const [,, cmd, ...args] = process.argv;

  if (!cmd || cmd === '--help' || cmd === '-h') {
    console.log(HELP);
    return;
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION);
    return;
  }

  const startMs = Date.now();

  try {
    switch (cmd) {
      case 'scan':    await scan(args);   break;
      case 'think':   await think(args);  break;
      case 'move':    await move(args);   break;
      case 'rate':    await rate(args);   break;
      case 'replay':  await replay(args); break;
      default:
        console.error(`${c.red}알 수 없는 커맨드: ${cmd}${c.reset}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (err) {
    console.error(`${c.red}오류: ${err instanceof Error ? err.message : String(err)}${c.reset}`);
    process.exit(1);
  }

  const elapsed = ((Date.now() - startMs) / 1000).toFixed(2);
  console.log(`\n${c.dim}완료 (${elapsed}s)${c.reset}`);
}

main();
