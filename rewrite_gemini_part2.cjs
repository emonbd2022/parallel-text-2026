const fs = require('fs');
let code = fs.readFileSync('src/services/geminiService.ts', 'utf8');

const startStr = `        if (onProgress) onProgress("Getting specific categories...");

        // Step 2: Request Categories`;

const endStr = `return results;
  } catch (error: any) {`;

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex > -1 && endIndex > -1) {
    code = code.substring(0, startIndex) + "        return results;\n  } catch (error: any) {" + code.substring(endIndex + endStr.length);
}

fs.writeFileSync('src/services/geminiService.ts', code);
