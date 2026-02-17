const fs = require('fs');
const path = require('path');

/**
 * Performance profiling script for IFC parser
 * Measures parsing time for different files and identifies bottlenecks
 */

const testFilesDir = path.join(process.cwd(), 'public/testFiles');
const testFiles = [
  'wall-with-opening-and-window.ifc',
  'FZK Haus.ifc',
  'Solibri Building.ifc',
];

function profileFile(filePath) {
  const filename = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`File: ${filename}`);
  console.log(`Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`${'='.repeat(60)}\n`);
  
  const startTotal = performance.now();
  
  // Read file
  const readStart = performance.now();
  const fileContent = fs.readFileSync(filePath);
  const readTime = performance.now() - readStart;
  console.log(`File read: ${readTime.toFixed(2)}ms`);
  
  // Extract header
  const headerStart = performance.now();
  const fileText = fileContent.toString();
  const headerMatch = fileText.match(/HEADER;([\s\S]*?)ENDSEC;/i);
  const headerTime = performance.now() - headerStart;
  console.log(`Header extraction: ${headerTime.toFixed(2)}ms`);
  
  // Extract DATA section
  const dataStart = performance.now();
  const dataMatch = fileText.match(/DATA;\s*([\s\S]*?)\s*ENDSEC;/i);
  const dataTime = performance.now() - dataStart;
  console.log(`DATA section extraction: ${dataTime.toFixed(2)}ms`);
  
  if (dataMatch) {
    const dataContent = dataMatch[1];
    
    // Count entities
    const entityMatches = dataContent.match(/#\d+=/g);
    const entityCount = entityMatches?.length || 0;
    console.log(`Entities found: ${entityCount}`);
    
    // Time STEP line extraction - current approach (string concat)
    console.log('\n--- STEP Line Extraction (String Concat) ---');
    const stringStart = performance.now();
    
    const lines = dataContent.split('\n');
    const stepLineMap = new Map();
    let currentLine = '';
    let currentId = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;
      
      const idMatch = line.match(/^#(\d+)\s*=/);
      
      if (idMatch) {
        if (currentId !== null && currentLine) {
          stepLineMap.set(currentId, currentLine);
        }
        
        currentId = parseInt(idMatch[1], 10);
        currentLine = line;
      } else {
        if (currentId !== null) {
          currentLine += ' ' + line;
        }
      }
    }
    
    if (currentId !== null && currentLine) {
      stepLineMap.set(currentId, currentLine);
    }
    
    const stringTime = performance.now() - stringStart;
    console.log(`Time: ${stringTime.toFixed(2)}ms`);
    console.log(`STEP lines extracted: ${stepLineMap.size}`);
    
    // Alternative: regex-based extraction
    console.log('\n--- STEP Line Extraction (Regex) ---');
    const regexStart = performance.now();
    
    const regexMap = new Map();
    const regex = /#(\d+)\s*=\s*([^;]+);/g;
    let match;
    while ((match = regex.exec(dataContent)) !== null) {
      const id = parseInt(match[1], 10);
      const content = match[2].trim();
      regexMap.set(id, `#${id}= ${content};`);
    }
    
    const regexTime = performance.now() - regexStart;
    console.log(`Time: ${regexTime.toFixed(2)}ms`);
    console.log(`STEP lines extracted: ${regexMap.size}`);
    
    // Alternative: optimized line-by-line with early termination for geometry
    console.log('\n--- STEP Line Extraction (Optimized with limit) ---');
    const optimizedStart = performance.now();
    
    const optimizedMap = new Map();
    let count = 0;
    const maxLines = dataContent.length > 10_000_000 ? 10_000 : Infinity;
    
    const optimLines = dataContent.split('\n');
    let optimCurrent = '';
    let optimId = null;
    
    for (let i = 0; i < optimLines.length && count < maxLines; i++) {
      const line = optimLines[i].trim();
      
      if (!line) continue;
      
      const idMatch = line.match(/^#(\d+)\s*=/);
      
      if (idMatch) {
        if (optimId !== null && optimCurrent) {
          optimizedMap.set(optimId, optimCurrent);
          count++;
        }
        
        optimId = parseInt(idMatch[1], 10);
        optimCurrent = line;
      } else {
        if (optimId !== null) {
          optimCurrent += ' ' + line;
        }
      }
    }
    
    if (optimId !== null && optimCurrent && count < maxLines) {
      optimizedMap.set(optimId, optimCurrent);
    }
    
    const optimizedTime = performance.now() - optimizedStart;
    console.log(`Time: ${optimizedTime.toFixed(2)}ms`);
    console.log(`STEP lines extracted: ${optimizedMap.size}`);
    
    console.log('\n--- Summary ---');
    console.log(`String concat: ${stringTime.toFixed(2)}ms (baseline)`);
    console.log(`Regex:         ${regexTime.toFixed(2)}ms (${((regexTime / stringTime - 1) * 100).toFixed(1)}% faster/slower)`);
    console.log(`Optimized:     ${optimizedTime.toFixed(2)}ms (${((optimizedTime / stringTime - 1) * 100).toFixed(1)}% faster/slower)`);
  }
  
  const totalTime = performance.now() - startTotal;
  console.log(`\nTotal profile time: ${totalTime.toFixed(2)}ms\n`);
}

function main() {
  console.log('\nIFC Parser Performance Profiling\n');
  
  for (const file of testFiles) {
    const filePath = path.join(testFilesDir, file);
    if (fs.existsSync(filePath)) {
      try {
        profileFile(filePath);
      } catch (err) {
        console.error(`Error profiling ${file}:`, err.message);
      }
    } else {
      console.log(`File not found: ${filePath}`);
    }
  }
}

main();
