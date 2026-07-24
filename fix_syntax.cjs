const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const badPart = `return (
    <>
      <style>{\`
        @keyframes hourglass-flip {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(180deg); }
          100% { transform: rotate(180deg); }
        }
        .hourglass-anim {
          animation: hourglass-flip 2s ease-in-out infinite;
        }
      \`}</style>) => clearInterval(autoSaveInterval);`;

content = content.replace(badPart, `return () => clearInterval(autoSaveInterval);`);

const mainReturn = `  return (
    <div className="h-screen w-screen`;

const correctMainReturn = `  return (
    <>
      <style>{\`
        @keyframes hourglass-flip {
          0% { transform: rotate(0deg); }
          40% { transform: rotate(180deg); }
          100% { transform: rotate(180deg); }
        }
        .hourglass-anim {
          animation: hourglass-flip 2s ease-in-out infinite;
        }
      \`}</style>
    <div className="h-screen w-screen`;

content = content.replace(mainReturn, correctMainReturn);

fs.writeFileSync('src/App.tsx', content);
