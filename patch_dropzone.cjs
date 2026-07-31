const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetState = `  const [showStats, setShowStats] = useState(false);`;
const replacementState = `  const [showStats, setShowStats] = useState(false);
  const [isDragging, setIsDragging] = useState(false);`;
content = content.replace(targetState, replacementState);

const targetDiv = `        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth space-y-8"
          id="main-scroll-area"
          onWheel={() => lastUserScrollRef.current = Date.now()}
          onTouchMove={() => lastUserScrollRef.current = Date.now()}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseUp}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleAddFiles(e.dataTransfer.files);
          }}
        >
             <div 
                  className="group relative border-2 border-dashed border-slate-700/50 hover:border-purple-500/50 bg-slate-900/20 hover:bg-slate-900/50 transition-all duration-500 rounded-[2rem] p-12 text-center cursor-pointer overflow-hidden min-h-[300px] flex flex-col items-center justify-center"`;

const replacementDiv = `        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-8 custom-scrollbar scroll-smooth space-y-8 relative"
          id="main-scroll-area"
          onWheel={() => lastUserScrollRef.current = Date.now()}
          onTouchMove={() => lastUserScrollRef.current = Date.now()}
          onMouseDown={handleMouseDown}
          onMouseLeave={(e) => {
             handleMouseUp(e);
             setIsDragging(false);
          }}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onDragEnter={(e) => {
             e.preventDefault();
             setIsDragging(true);
          }}
          onDragOver={(e) => {
             e.preventDefault();
             setIsDragging(true);
          }}
          onDragLeave={(e) => {
             e.preventDefault();
             setIsDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleAddFiles(e.dataTransfer.files);
          }}
        >
             <div 
                  className={\`group relative border-2 border-dashed transition-all duration-500 rounded-[2rem] p-12 text-center cursor-pointer overflow-hidden min-h-[300px] flex flex-col items-center justify-center \${isDragging ? 'border-purple-500 bg-purple-500/10 shadow-[0_0_50px_rgba(168,85,247,0.3)] scale-[1.02] z-10' : 'border-slate-700/50 hover:border-purple-500/50 bg-slate-900/20 hover:bg-slate-900/50 scale-100'}\`}
                  style={{
                      boxShadow: isDragging ? '0 0 40px -10px rgba(168, 85, 247, 0.4), inset 0 0 20px -5px rgba(168, 85, 247, 0.2)' : 'none'
                  }}`;

content = content.replace(targetDiv, replacementDiv);
fs.writeFileSync('src/App.tsx', content);
