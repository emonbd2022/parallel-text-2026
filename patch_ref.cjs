const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const useRefImport = `import React, { useState, useEffect, useRef, useCallback } from 'react';`;
if (code.includes(`import React, { useState, useEffect, useCallback }`)) {
    code = code.replace(`import React, { useState, useEffect, useCallback }`, useRefImport);
}

const refInit = `  const activeKeysRef = useRef<Set<string>>(new Set());\n  const [tick, setTick] = useState(0);`;
code = code.replace(`  const [tick, setTick] = useState(0);`, refInit);

// startBatchProcessing
const startBatch = `const startBatchProcessing = async (batchItems: ProcessingItem[], keyObj: ApiKey) => {
    activeKeysRef.current.add(keyObj.id);`;
code = code.replace(`const startBatchProcessing = async (batchItems: ProcessingItem[], keyObj: ApiKey) => {`, startBatch);

// startCategoryBatchProcessing
const startCatBatch = `const startCategoryBatchProcessing = async (batchItems: ProcessingItem[], keyObj: ApiKey) => {
    activeKeysRef.current.add(keyObj.id);`;
code = code.replace(`const startCategoryBatchProcessing = async (batchItems: ProcessingItem[], keyObj: ApiKey) => {`, startCatBatch);

// in startBatchProcessing finally:
const startBatchFinally = `    } finally {
      activeKeysRef.current.delete(keyObj.id);
      if (activeRequests <= 1) { // Will be 0 after this finishes
        setStatusMsg("Processing complete.");
      }`;
code = code.replace(`    } finally {
      if (activeRequests <= 1) { // Will be 0 after this finishes`, startBatchFinally);
      
// in startCategoryBatchProcessing finally:
const startCatBatchFinally = `    } finally {
      activeKeysRef.current.delete(keyObj.id);
      if (activeRequests <= 1) { // Will be 0 after this finishes
        setStatusMsg("Processing complete.");
      }`;
code = code.replace(`    } finally {
      if (activeRequests <= 1) { // Will be 0 after this finishes`, startCatBatchFinally);

// availableKeys filtering
const availableKeysStart = `    const availableKeys = validKeys.filter(k => 
        !activeKeyIds.has(k.id) && 
        !activeKeysRef.current.has(k.id) &&
        (!k.cooldownUntil || k.cooldownUntil < now)
    );`;
code = code.replace(`    const availableKeys = validKeys.filter(k => 
        !activeKeyIds.has(k.id) && 
        (!k.cooldownUntil || k.cooldownUntil < now)
    );`, availableKeysStart);

fs.writeFileSync('src/App.tsx', code);
