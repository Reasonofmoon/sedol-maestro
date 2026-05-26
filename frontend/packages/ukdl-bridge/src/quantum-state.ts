// ============================================================
// Quantum State Manager
// Manages probability distributions over code quality dimensions
// Observation (move completion) collapses the superposition
// Entanglement links risk ↔ velocity
// ============================================================

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
export type VelocityState = 'accelerating' | 'stable' | 'decelerating';
export type ClarityState = 'clear' | 'evolving' | 'muddy';

export interface QuantumProjectState {
  risk: Record<RiskLevel, number>;
  velocity: Record<VelocityState, number>;
  clarity: Record<ClarityState, number>;
  observationCount: number;
  lastObservedAt: Date;
}

export function initQuantumState(overallHealth: number, cycleCount: number): QuantumProjectState {
  const h = overallHealth;

  // Risk: inversely proportional to health
  const risk = normalise({
    critical: Math.max(0, -h - 0.3),
    high: Math.max(0, 0.4 - h * 0.5),
    medium: Math.max(0, h + 0.5),
    low: Math.max(0, h + 1) * 0.3,
  });

  // Velocity: initially stable, uncorrelated with health
  const velocity: Record<VelocityState, number> = { accelerating: 0.35, stable: 0.50, decelerating: 0.15 };

  // Clarity: inversely proportional to cycle count
  const clarity = normalise({
    clear: Math.max(0, 1 - cycleCount * 0.2),
    evolving: Math.min(0.6, cycleCount * 0.15),
    muddy: Math.max(0, cycleCount * 0.15 - 0.1),
  });

  return { risk, velocity, clarity, observationCount: 0, lastObservedAt: new Date() };
}

/** Collapse quantum state on observation (move completion) */
export function observe(
  state: QuantumProjectState,
  deltaHealth: number,
): QuantumProjectState {
  const newHealth = Math.max(-1, Math.min(1, deltaHealth));

  // Risk collapses toward lower risk if health improved
  const newRisk = entangle(state.risk, newHealth > 0 ? -0.2 : 0.1);

  // Velocity collapses based on consecutive improvements
  const newVelocity: Record<VelocityState, number> = deltaHealth > 0.1
    ? normalise({ accelerating: state.velocity.accelerating + 0.2, stable: state.velocity.stable, decelerating: Math.max(0, state.velocity.decelerating - 0.1) })
    : state.velocity;

  // Clarity improves with refactoring
  const newClarity = deltaHealth > 0.05
    ? normalise({ clear: state.clarity.clear + 0.1, evolving: state.clarity.evolving, muddy: Math.max(0, state.clarity.muddy - 0.05) })
    : state.clarity;

  return {
    risk: newRisk,
    velocity: newVelocity,
    clarity: newClarity,
    observationCount: state.observationCount + 1,
    lastObservedAt: new Date(),
  };
}

/** Decay toward uniform distribution if unobserved (uncertainty grows) */
export function decay(state: QuantumProjectState, hoursElapsed: number): QuantumProjectState {
  const decayRate = Math.min(0.5, hoursElapsed * 0.02);
  return {
    risk: decayTowardUniform(state.risk, decayRate),
    velocity: decayTowardUniform(state.velocity, decayRate),
    clarity: decayTowardUniform(state.clarity, decayRate),
    observationCount: state.observationCount,
    lastObservedAt: state.lastObservedAt,
  };
}

// ── Helpers ──────────────────────────────────────────────

function normalise<T extends string>(dist: Record<T, number>): Record<T, number> {
  const total = Object.values(dist).reduce((s, v) => s + (v as number), 0) || 1;
  return Object.fromEntries(
    Object.entries(dist).map(([k, v]) => [k, (v as number) / total])
  ) as Record<T, number>;
}

function entangle<T extends string>(dist: Record<T, number>, shift: number): Record<T, number> {
  const keys = Object.keys(dist) as T[];
  const shifted: Record<T, number> = { ...dist };
  // shift probability mass toward lower-risk states
  if (shift < 0) {
    const lastKey = keys[keys.length - 1];
    const firstKey = keys[0];
    (shifted as Record<string, number>)[lastKey] = Math.min(1, dist[lastKey] + Math.abs(shift));
    (shifted as Record<string, number>)[firstKey] = Math.max(0, dist[firstKey] + shift);
  }
  return normalise(shifted);
}

function decayTowardUniform<T extends string>(dist: Record<T, number>, rate: number): Record<T, number> {
  const keys = Object.keys(dist) as T[];
  const uniform = 1 / keys.length;
  return Object.fromEntries(
    keys.map(k => [k, dist[k] * (1 - rate) + uniform * rate])
  ) as Record<T, number>;
}
