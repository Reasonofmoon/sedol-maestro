// ============================================================
// Mandala Matrix Data — 프로그래밍 언어 x 라이브러리/프레임워크
// ============================================================

export interface Library {
  name: string;
  description: string;
  category: 'framework' | 'data' | 'web' | 'ai' | 'testing' | 'devops' | 'mobile' | 'db' | 'util';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: string;
}

export interface Language {
  id: string;
  name: string;
  icon: string;
  color: string;
  textColor: string;
  description: string;
  libraries: Library[];
}

export const LANGUAGES: Language[] = [
  {
    id: 'python', name: 'Python', icon: '\u{1F40D}',
    color: 'bg-yellow-500/20', textColor: 'text-yellow-400',
    description: '\uB370\uC774\uD130 \uBD84\uC11D, AI, \uC6F9 \uAC1C\uBC1C\uC758 \uB9CC\uB2A5 \uC5B8\uC5B4',
    libraries: [
      { name: 'FastAPI', description: '\uCD08\uACE0\uC18D \uBE44\uB3D9\uAE30 \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'intermediate', icon: '\u26A1' },
      { name: 'Django', description: '\uD480\uC2A4\uD0DD \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C (\uBC30\uD130\uB9AC \uD3EC\uD568)', category: 'framework', difficulty: 'intermediate', icon: '\u{1F3AF}' },
      { name: 'Flask', description: '\uACBD\uB7C9 \uB9C8\uC774\uD06C\uB85C \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'beginner', icon: '\u{1F9EA}' },
      { name: 'pandas', description: '\uB370\uC774\uD130 \uBD84\uC11D/\uC870\uC791 \uB77C\uC774\uBE0C\uB7EC\uB9AC', category: 'data', difficulty: 'beginner', icon: '\u{1F43C}' },
      { name: 'NumPy', description: '\uC218\uCE58 \uACC4\uC0B0 \uD575\uC2EC \uB77C\uC774\uBE0C\uB7EC\uB9AC', category: 'data', difficulty: 'beginner', icon: '\u{1F522}' },
      { name: 'scikit-learn', description: '\uBA38\uC2E0\uB7EC\uB2DD \uC54C\uACE0\uB9AC\uC998 \uBAA8\uC74C', category: 'ai', difficulty: 'intermediate', icon: '\u{1F916}' },
      { name: 'PyTorch', description: '\uB525\uB7EC\uB2DD \uD504\uB808\uC784\uC6CC\uD06C (\uC5F0\uAD6C\uC6A9)', category: 'ai', difficulty: 'advanced', icon: '\u{1F525}' },
      { name: 'LangChain', description: 'LLM \uC571 \uAC1C\uBC1C \uD504\uB808\uC784\uC6CC\uD06C', category: 'ai', difficulty: 'intermediate', icon: '\u{1F517}' },
      { name: 'Streamlit', description: '\uB370\uC774\uD130 \uC571 \uBE60\uB978 \uD504\uB85C\uD1A0\uD0C0\uC774\uD551', category: 'web', difficulty: 'beginner', icon: '\u{1F4CA}' },
      { name: 'pytest', description: '\uD30C\uC774\uC36C \uD14C\uC2A4\uD2B8 \uD504\uB808\uC784\uC6CC\uD06C', category: 'testing', difficulty: 'beginner', icon: '\u2705' },
      { name: 'SQLAlchemy', description: 'SQL ORM + \uB370\uC774\uD130\uBCA0\uC774\uC2A4 \uD234\uD0B7', category: 'db', difficulty: 'intermediate', icon: '\u{1F5C3}\uFE0F' },
      { name: 'Celery', description: '\uBD84\uC0B0 \uD0DC\uC2A4\uD06C \uD050', category: 'devops', difficulty: 'advanced', icon: '\u{1F96C}' },
    ],
  },
  {
    id: 'typescript', name: 'TypeScript', icon: '\u{1F4D8}',
    color: 'bg-blue-500/20', textColor: 'text-blue-400',
    description: '\uD0C0\uC785 \uC548\uC804\uD55C JavaScript \u2014 \uC6F9/\uC11C\uBC84/\uC571 \uC804 \uC601\uC5ED',
    libraries: [
      { name: 'React', description: '\uCEF4\uD3EC\uB10C\uD2B8 \uAE30\uBC18 UI \uB77C\uC774\uBE0C\uB7EC\uB9AC', category: 'framework', difficulty: 'intermediate', icon: '\u269B\uFE0F' },
      { name: 'Next.js', description: 'React \uD480\uC2A4\uD0DD \uD504\uB808\uC784\uC6CC\uD06C (SSR/SSG)', category: 'framework', difficulty: 'intermediate', icon: '\u25B2' },
      { name: 'Vue.js', description: '\uC810\uC9C4\uC801 UI \uD504\uB808\uC784\uC6CC\uD06C', category: 'framework', difficulty: 'beginner', icon: '\u{1F49A}' },
      { name: 'Svelte', description: '\uCEF4\uD30C\uC77C\uB7EC \uAE30\uBC18 \uCD08\uACBD\uB7C9 UI', category: 'framework', difficulty: 'beginner', icon: '\u{1F536}' },
      { name: 'Express', description: 'Node.js \uBBF8\uB2C8\uBA40 \uC6F9 \uC11C\uBC84', category: 'web', difficulty: 'beginner', icon: '\u{1F682}' },
      { name: 'Prisma', description: '\uD0C0\uC785\uC138\uC774\uD504 ORM', category: 'db', difficulty: 'beginner', icon: '\u{1F48E}' },
      { name: 'tRPC', description: 'End-to-end \uD0C0\uC785\uC138\uC774\uD504 API', category: 'web', difficulty: 'intermediate', icon: '\u{1F50C}' },
      { name: 'Tailwind CSS', description: '\uC720\uD2F8\uB9AC\uD2F0 CSS \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'beginner', icon: '\u{1F3A8}' },
      { name: 'Zod', description: '\uB7F0\uD0C0\uC784 \uC2A4\uD0A4\uB9C8 \uAC80\uC99D', category: 'util', difficulty: 'beginner', icon: '\u{1F6E1}\uFE0F' },
      { name: 'Vitest', description: '\uCD08\uACE0\uC18D \uB2E8\uC704 \uD14C\uC2A4\uD2B8', category: 'testing', difficulty: 'beginner', icon: '\u26A1' },
      { name: 'React Native', description: '\uD06C\uB85C\uC2A4 \uD50C\uB7AB\uD3FC \uBAA8\uBC14\uC77C \uC571', category: 'mobile', difficulty: 'intermediate', icon: '\u{1F4F1}' },
      { name: 'Anthropic SDK', description: 'Claude API \uD1B5\uD569', category: 'ai', difficulty: 'intermediate', icon: '\u{1F9E0}' },
    ],
  },
  {
    id: 'rust', name: 'Rust', icon: '\u{1F980}',
    color: 'bg-orange-500/20', textColor: 'text-orange-400',
    description: '\uC548\uC804\uD558\uACE0 \uBE60\uB978 \uC2DC\uC2A4\uD15C \uD504\uB85C\uADF8\uB798\uBC0D \uC5B8\uC5B4',
    libraries: [
      { name: 'Actix Web', description: '\uCD08\uACE0\uC131\uB2A5 \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'advanced', icon: '\u{1F680}' },
      { name: 'Axum', description: 'Tokio \uAE30\uBC18 \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'intermediate', icon: '\u{1F527}' },
      { name: 'Tauri', description: '\uACBD\uB7C9 \uB370\uC2A4\uD06C\uD1B1 \uC571 \uD504\uB808\uC784\uC6CC\uD06C', category: 'framework', difficulty: 'intermediate', icon: '\u{1F5A5}\uFE0F' },
      { name: 'Serde', description: '\uC9C1\uB82C\uD654/\uC5ED\uC9C1\uB82C\uD654 \uD504\uB808\uC784\uC6CC\uD06C', category: 'util', difficulty: 'beginner', icon: '\u{1F4E6}' },
      { name: 'Tokio', description: '\uBE44\uB3D9\uAE30 \uB7F0\uD0C0\uC784', category: 'util', difficulty: 'intermediate', icon: '\u26A1' },
      { name: 'SQLx', description: '\uBE44\uB3D9\uAE30 SQL \uB77C\uC774\uBE0C\uB7EC\uB9AC', category: 'db', difficulty: 'intermediate', icon: '\u{1F5C3}\uFE0F' },
      { name: 'WASM', description: 'WebAssembly \uD0C0\uAC9F \uCEF4\uD30C\uC77C', category: 'web', difficulty: 'advanced', icon: '\u{1F310}' },
      { name: 'Bevy', description: '\uAC8C\uC784 \uC5D4\uC9C4 (ECS \uC544\uD0A4\uD14D\uCC98)', category: 'framework', difficulty: 'advanced', icon: '\u{1F3AE}' },
    ],
  },
  {
    id: 'go', name: 'Go', icon: '\u{1F439}',
    color: 'bg-cyan-500/20', textColor: 'text-cyan-400',
    description: '\uAC04\uACB0\uD558\uACE0 \uB3D9\uC2DC\uC131\uC774 \uB6F0\uC5B4\uB09C \uC11C\uBC84 \uC5B8\uC5B4',
    libraries: [
      { name: 'Gin', description: '\uACE0\uC131\uB2A5 HTTP \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'beginner', icon: '\u{1F378}' },
      { name: 'Fiber', description: 'Express \uC2A4\uD0C0\uC77C \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'beginner', icon: '\u26A1' },
      { name: 'GORM', description: 'Go ORM \uB77C\uC774\uBE0C\uB7EC\uB9AC', category: 'db', difficulty: 'beginner', icon: '\u{1F5C3}\uFE0F' },
      { name: 'gRPC', description: '\uACE0\uC131\uB2A5 RPC \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'intermediate', icon: '\u{1F50C}' },
      { name: 'Cobra', description: 'CLI \uC571 \uD504\uB808\uC784\uC6CC\uD06C', category: 'util', difficulty: 'beginner', icon: '\u{1F40D}' },
      { name: 'Docker SDK', description: '\uCEE8\uD14C\uC774\uB108 \uAD00\uB9AC SDK', category: 'devops', difficulty: 'intermediate', icon: '\u{1F433}' },
      { name: 'Kubernetes Client', description: 'K8s API \uD074\uB77C\uC774\uC5B8\uD2B8', category: 'devops', difficulty: 'advanced', icon: '\u2638\uFE0F' },
      { name: 'Bubble Tea', description: 'TUI \uD504\uB808\uC784\uC6CC\uD06C', category: 'util', difficulty: 'intermediate', icon: '\u{1FAE7}' },
    ],
  },
  {
    id: 'java', name: 'Java', icon: '\u2615',
    color: 'bg-red-500/20', textColor: 'text-red-400',
    description: '\uC5D4\uD130\uD504\uB77C\uC774\uC988 \uD45C\uC900 \u2014 \uC548\uB4DC\uB85C\uC774\uB4DC, \uC11C\uBC84, \uBE45\uB370\uC774\uD130',
    libraries: [
      { name: 'Spring Boot', description: '\uC5D4\uD130\uD504\uB77C\uC774\uC988 \uC6F9 \uD504\uB808\uC784\uC6CC\uD06C', category: 'framework', difficulty: 'intermediate', icon: '\u{1F331}' },
      { name: 'Quarkus', description: '\uD074\uB77C\uC6B0\uB4DC \uB124\uC774\uD2F0\uBE0C Java', category: 'framework', difficulty: 'intermediate', icon: '\u26A1' },
      { name: 'Hibernate', description: 'JPA ORM \uAD6C\uD604\uCCB4', category: 'db', difficulty: 'intermediate', icon: '\u{1F5C3}\uFE0F' },
      { name: 'Kafka', description: '\uBD84\uC0B0 \uC774\uBCA4\uD2B8 \uC2A4\uD2B8\uB9AC\uBC0D', category: 'devops', difficulty: 'advanced', icon: '\u{1F4E8}' },
      { name: 'JUnit 5', description: 'Java \uD14C\uC2A4\uD2B8 \uD504\uB808\uC784\uC6CC\uD06C', category: 'testing', difficulty: 'beginner', icon: '\u2705' },
      { name: 'Jetpack Compose', description: '\uC548\uB4DC\uB85C\uC774\uB4DC \uC120\uC5B8\uC801 UI', category: 'mobile', difficulty: 'intermediate', icon: '\u{1F4F1}' },
      { name: 'Apache Spark', description: '\uBE45\uB370\uC774\uD130 \uCC98\uB9AC \uC5D4\uC9C4', category: 'data', difficulty: 'advanced', icon: '\u2728' },
      { name: 'Gradle', description: '\uBE4C\uB4DC \uC790\uB3D9\uD654 \uB3C4\uAD6C', category: 'devops', difficulty: 'beginner', icon: '\u{1F418}' },
    ],
  },
  {
    id: 'swift', name: 'Swift', icon: '\u{1F34E}',
    color: 'bg-pink-500/20', textColor: 'text-pink-400',
    description: 'Apple \uC0DD\uD0DC\uACC4 \u2014 iOS, macOS, visionOS',
    libraries: [
      { name: 'SwiftUI', description: '\uC120\uC5B8\uC801 UI \uD504\uB808\uC784\uC6CC\uD06C', category: 'framework', difficulty: 'beginner', icon: '\u{1F4F1}' },
      { name: 'Combine', description: '\uB9AC\uC561\uD2F0\uBE0C \uD504\uB85C\uADF8\uB798\uBC0D', category: 'util', difficulty: 'intermediate', icon: '\u{1F504}' },
      { name: 'Vapor', description: 'Swift \uC11C\uBC84 \uD504\uB808\uC784\uC6CC\uD06C', category: 'web', difficulty: 'intermediate', icon: '\u{1F4A8}' },
      { name: 'CoreML', description: 'Apple \uAE30\uAE30 ML \uCD94\uB860', category: 'ai', difficulty: 'intermediate', icon: '\u{1F9E0}' },
      { name: 'ARKit', description: 'AR \uC571 \uAC1C\uBC1C', category: 'framework', difficulty: 'advanced', icon: '\u{1F453}' },
      { name: 'Swift Testing', description: 'Apple \uACF5\uC2DD \uD14C\uC2A4\uD2B8', category: 'testing', difficulty: 'beginner', icon: '\u2705' },
    ],
  },
];

export const CATEGORIES = [
  { id: 'framework', name: '\uD504\uB808\uC784\uC6CC\uD06C', icon: '\u{1F3D7}\uFE0F' },
  { id: 'web', name: '\uC6F9', icon: '\u{1F310}' },
  { id: 'data', name: '\uB370\uC774\uD130', icon: '\u{1F4CA}' },
  { id: 'ai', name: 'AI/ML', icon: '\u{1F916}' },
  { id: 'testing', name: '\uD14C\uC2A4\uD2B8', icon: '\u2705' },
  { id: 'devops', name: 'DevOps', icon: '\u{1F527}' },
  { id: 'mobile', name: '\uBAA8\uBC14\uC77C', icon: '\u{1F4F1}' },
  { id: 'db', name: '\uB370\uC774\uD130\uBCA0\uC774\uC2A4', icon: '\u{1F5C3}\uFE0F' },
  { id: 'util', name: '\uC720\uD2F8\uB9AC\uD2F0', icon: '\u{1F9F0}' },
] as const;
