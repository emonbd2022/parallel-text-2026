const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/const STORAGE_STATS = 'parrarel_stats_v1';\n/, '');
code = code.replace(/{ id: 'auto', name: 'Auto \(Best Effort\)', rpm: 5 },/, "{ id: 'turbo', name: 'Turbo', rpm: 5 },");

// Replace modelStats state
code = code.replace(/  const \[modelStats, setModelStats\] = useState<Record<string, { totalTimeMs: number, count: number, fails: number }>>\(\(\) => {[\s\S]*?  }\);\n/, '');

// Add turbo stats refs
const turboStatsRefs = `
  const turboTitleStatsRef = useRef<Record<string, { latencies: number[], fails: number, lastFailTime: number }>>({});
  const turboCategoryStatsRef = useRef<Record<string, { latencies: number[], fails: number, lastFailTime: number }>>({});

  const getBestTurboModel = (statsRef: React.MutableRefObject<Record<string, { latencies: number[], fails: number, lastFailTime: number }>>) => {
      const models = [
          'gemini-3.5-flash-lite',
          'gemini-3.1-flash-lite-preview',
          'gemini-3.7-flash',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-3-flash-preview',
          'gemini-2.5-flash',
          'gemini-2.5-flash-lite'
      ];
      let bestModel = models[0];
      let bestScore = Infinity;
      const now = Date.now();

      for (const m of models) {
          const stat = statsRef.current[m];
          let score = 10000;
          if (stat) {
              const lats = stat.latencies;
              const recent = lats.slice(-5);
              const avgLat = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 10000;
              
              let failPenalty = 0;
              if (stat.fails > 0) {
                  const timeSinceFail = now - stat.lastFailTime;
                  if (timeSinceFail < 60000) failPenalty = 50000;
                  else if (timeSinceFail < 300000) failPenalty = 10000;
                  else stat.fails = 0;
              }
              score = avgLat + failPenalty;
          } else {
              if (m.includes('lite')) score = 5000;
              else score = 8000;
          }
          if (score < bestScore) {
              bestScore = score;
              bestModel = m;
          }
      }
      return bestModel;
  };
`;
code = code.replace(/  const \[isProcessing, setIsProcessing\] = useState\(false\);/, turboStatsRefs + '\  const [isProcessing, setIsProcessing] = useState(false);');

// Remove modelStats save
code = code.replace(/  useEffect\(\(\) => {\n    localStorage\.setItem\(STORAGE_STATS, JSON\.stringify\(modelStats\)\);\n  }, \[modelStats\]\);\n\n/, '');

fs.writeFileSync('src/App.tsx', code);
