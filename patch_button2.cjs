const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `              <button 
                onClick={handleStartStop}
                disabled={items.length === 0}
                title={isProcessing ? 'Stop Processing (Ctrl+Enter / Cmd+Enter)' : 'Start Processing (Ctrl+Enter / Cmd+Enter)'}
                className={\`relative px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 \${
                    isProcessing 
                    ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-[0_0_20px_rgba(234,88,12,0.6)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]' 
                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-blue-900/30 hover:shadow-blue-900/50'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none\`}
              >
                {isProcessing ? 'Stop' : 'Start'} Processing
              </button>`;

const replacement = `              <div className="relative">
                {isProcessing && (
                  <div className="absolute inset-0 bg-orange-500 rounded-lg animate-ping opacity-75"></div>
                )}
                <button 
                  onClick={handleStartStop}
                  disabled={items.length === 0}
                  title={isProcessing ? 'Stop Processing (Ctrl+Enter / Cmd+Enter)' : 'Start Processing (Ctrl+Enter / Cmd+Enter)'}
                  className={\`relative px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 \${
                      isProcessing 
                      ? 'bg-gradient-to-r from-orange-600 to-red-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.5)]' 
                      : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-blue-900/30 hover:shadow-blue-900/50'
                  } disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none\`}
                >
                  {isProcessing ? 'Stop' : 'Start'} Processing
                </button>
              </div>`;

content = content.replace(target, replacement);

fs.writeFileSync('src/App.tsx', content);
