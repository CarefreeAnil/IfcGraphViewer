import * as fs from 'fs';
import * as path from 'path';

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

interface TimingPoint {
  name: string;
  time: number;
}

const timings: TimingPoint[] = [];

function recordTiming(name: string) {
  timings.push({
    name,
    time: performance.now(),
  });
}

function printTimings() {
  console.log('\n=== PERFORMANCE PROFILE ===\n');
  
  for (let i = 1; i < timings.length; i++) {
    const prev = timings[i - 1];
    const curr = timings[i];
    const duration = (curr.time - prev.time).toFixed(2);
    console.log(`${prev.name} → ${curr.name}: ${duration}ms`);
  }
  
  if (timings.length > 1) {
    const total = (timings[timings.length - 1].time - timings[0].time).toFixed(2);
    console.log(`\nTotal: ${total}ms`);
  }
}

async function profileFile(filePath: string) {
  const filename = path.basename(filePath);
  const fileSize = fs.statSync(filePath).size;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`File: ${filename}`);
  console.log(`Size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`${'='.repeat(60)}\n`);
  
  timings.length = 0;
  
  recordTiming('START');
  
  // Read file
  const fileContent = fs.readFileSync(filePath);
  recordTiming('File read');
  
  // Extract header
  const fileText = fileContent.toString();
  const headerMatch = fileText.match(/HEADER;([\s\S]*?)ENDSEC;/i);
  recordTiming('Header extraction');
  
  // Extract DATA section
  const dataMatch = fileText.match(/DATA;\s*([\s\S]*?)\s*ENDSEC;/i);
  recordTiming('DATA section extraction');
  
  if (dataMatch) {
    const dataContent = dataMatch[1];
    
    // Count entities
    const entityMatches = dataContent.match(/#\d+=/g);
    const entityCount = entityMatches?.length || 0;
    console.log(`Entities found: ${entityCount}`);
    
    // Time STEP line extraction - current approach
    console.log('\nTiming STEP line extraction:');
    recordTiming('START extraction');
    
    const lines = dataContent.split('\n');
    const stepLineMap = new Map<number, string>();
    let currentLine = '';
    let currentId: number | null = null;
    
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
    
    recordTiming('END extraction (string concat approach)');
    
    // Alternative: regex-based extraction
    console.log('\nTiming REGEX-based extraction:');
    recordTiming('START regex extraction');
    
    const regexMap = new Map<number, string>();
    const regex = /#(\d+)\s*=\s*([^;]+);/g;
    let match;
    while ((match = regex.exec(dataContent)) !== null) {
      const id = parseInt(match[1], 10);
      const content = match[2].trim();
      regexMap.set(id, `#${id}= ${content};`);
    }
    
    recordTiming('END regex extraction');
    
    console.log(`\nSTEP lines extracted (string concat): ${stepLineMap.size}`);
    console.log(`STEP lines extracted (regex): ${regexMap.size}`);
  }
  
  printTimings();
}

async function main() {
  console.log('\nIFC Parser Performance Profiling\n');
  
  for (const file of testFiles) {
    const filePath = path.join(testFilesDir, file);
    if (fs.existsSync(filePath)) {
      await profileFile(filePath);
    } else {
      console.log(`File not found: ${filePath}`);
    }
  }
}

main().catch(console.error);
