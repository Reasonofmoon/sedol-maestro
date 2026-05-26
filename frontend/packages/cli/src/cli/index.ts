#!/usr/bin/env node
/**
 * 碁道코딩 CLI — Entry Point
 *
 * "선수를 잡는 자가 판을 지배한다"
 *
 * Commands:
 *   gido scan      — 프로젝트 형세도 (Board Scan)
 *   gido analyze   — 후보수 분석 (Move Analysis)
 *   gido           — 형세 요약 + 최선의 다음 수 추천
 */

import { Command } from 'commander';
import { resolve } from 'path';
import { scanProject } from '../encoder/board-state.js';
import { renderBoardState } from './renderer.js';
import { analyzeProject } from '../value/move-evaluator.js';
import { renderAnalysis } from './analyze-renderer.js';
import { searchPlan } from '../search/mcts-engine.js';
import { renderPlan } from './plan-renderer.js';

const program = new Command();

program
  .name('gido')
  .description('碁道코딩 CLI — 바둑 AI의 전략적 지혜를 코드에 심는 도구')
  .version('0.1.0');

// ── gido scan ──
program
  .command('scan')
  .description('프로젝트 형세도 출력 (Board Scan + Ownership Heatmap)')
  .argument('[dir]', 'Project directory to scan', '.')
  .action((dir: string) => {
    const targetDir = resolve(dir);
    console.log(`\n  Scanning ${targetDir}...\n`);

    try {
      const boardState = scanProject(targetDir);
      const output = renderBoardState(boardState);
      console.log(output);
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// ── gido analyze ──
program
  .command('analyze')
  .description('후보 행동 분석 + ΔHealth 출력 (Move Analysis)')
  .argument('[dir]', 'Project directory to analyze', '.')
  .option('--provider <provider>', 'LLM provider: anthropic, openai, or heuristic', undefined)
  .option('--model <model>', 'LLM model name override', undefined)
  .action(async (dir: string, opts: { provider?: string; model?: string }) => {
    const targetDir = resolve(dir);
    console.log(`\n  Scanning & analyzing ${targetDir}...\n`);

    try {
      // Phase 1: Scan
      const boardState = scanProject(targetDir);

      // Phase 2: Analyze
      const llmConfig: any = {};
      if (opts.provider) llmConfig.provider = opts.provider;
      if (opts.model) llmConfig.model = opts.model;

      const result = await analyzeProject(boardState, llmConfig);
      const output = renderAnalysis(result);
      console.log(output);
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// ── gido (default) — Quick recommendation ──
program
  .command('recommend', { isDefault: true })
  .description('형세 요약 + 최선의 다음 수 1개 추천')
  .argument('[dir]', 'Project directory', '.')
  .action(async (dir: string) => {
    const targetDir = resolve(dir);

    try {
      const boardState = scanProject(targetDir);
      const result = await analyzeProject(boardState);

      // Quick summary
      const s = boardState.summary;
      const healthColor = s.overallHealth >= 0 ? '\x1b[32m' : '\x1b[31m';
      console.log('');
      console.log(`  碁道코딩 — Quick Read`);
      console.log(`  Health: ${healthColor}${s.overallHealth.toFixed(2)}\x1b[0m  |  ${s.totalFiles} files  |  Cycles: ${s.cycleCount}`);

      if (result.evaluations.length > 0) {
        const best = result.evaluations[0];
        console.log('');
        console.log(`  \x1b[1m▶ Next move: ${best.action.intent}\x1b[0m`);
        console.log(`    ${best.badukTerm}  |  ΔHealth: ${best.deltaHealth >= 0 ? '+' : ''}${best.deltaHealth.toFixed(2)}`);
        console.log(`    Target: ${best.action.target}`);
      }
      console.log('');
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

// ── gido plan ──
program
  .command('plan')
  .description('n수 앞 개발 경로 탐색 (MCTS Search)')
  .argument('[dir]', 'Project directory', '.')
  .option('--depth <depth>', 'Search depth (number of steps ahead)', '3')
  .option('--simulations <n>', 'Number of MCTS simulations', '12')
  .action(async (dir: string, opts: { depth?: string; simulations?: string }) => {
    const targetDir = resolve(dir);
    const depth = parseInt(opts.depth || '3', 10);
    const sims = parseInt(opts.simulations || '12', 10);
    console.log(`\n  Scanning & planning ${depth}수 ahead (${sims} simulations)...\n`);

    try {
      const boardState = scanProject(targetDir);
      const result = await searchPlan(boardState, {
        maxDepth: depth,
        numSimulations: sims,
      });
      const output = renderPlan(result, boardState.summary.overallHealth);
      console.log(output);
    } catch (err) {
      console.error(`  Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command('play')
  .description('[Phase 4] 선택한 행동 실행 + Git 커밋')
  .action(() => {
    console.log('\n  ⏳ gido play will be available in Phase 4 (CLI UX Integration).\n');
  });

program
  .command('review')
  .description('[Phase 2+] 최근 변경의 ΔHealth 복기')
  .action(() => {
    console.log('\n  ⏳ gido review coming soon.\n');
  });

program.parse();
