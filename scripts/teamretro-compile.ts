#!/usr/bin/env bun

import { glob } from "glob";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { existsSync } from "node:fs";

// Import pdfjs-dist legacy build for Bun compatibility
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Set worker source to local worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.cwd()}/node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs`;

interface TeamRetroSection {
  [key: string]: string;
}

interface TeamRetroData {
  file: string;
  title: string;
  sections: TeamRetroSection;
}

interface ParsedArgs {
  folder: string;
  nameContains?: string;
  out: string;
  format: 'md' | 'json';
}

// Known TeamRetro sections
const KNOWN_SECTIONS = [
  'Meeting context',
  'Summary',
  'Team actions',
  'Actions from this retrospective',
  'Other open actions',
  'Team agreements',
  'What went well?',
  'What went less well?',
  'What do we want to try next?',
  'What puzzles us?'
];

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: bun run teamretro-compile.ts <folder> [options]

Arguments:
  <folder>              Root folder to scan recursively for PDF files

Options:
  --name-contains TEXT  Only process PDFs whose filename contains this text (case-insensitive)
  --out DIR            Output directory (default: ./compilado)
  --format md|json     Output format (default: md)
  --help               Show this help message
`);
    process.exit(0);
  }

  const folder = args[0];
  if (!folder) {
    console.error('Error: <folder> argument is required');
    process.exit(1);
  }

  let nameContains: string | undefined;
  let out = './compilado';
  let format: 'md' | 'json' = 'md';

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--name-contains':
        nameContains = args[++i];
        if (!nameContains) {
          console.error('Error: --name-contains requires a value');
          process.exit(1);
        }
        break;
      case '--out':
        out = args[++i];
        if (!out) {
          console.error('Error: --out requires a value');
          process.exit(1);
        }
        break;
      case '--format':
        const formatArg = args[++i];
        if (formatArg !== 'md' && formatArg !== 'json') {
          console.error('Error: --format must be "md" or "json"');
          process.exit(1);
        }
        format = formatArg;
        break;
      default:
        console.error(`Error: Unknown option ${args[i]}`);
        process.exit(1);
    }
  }

  return { folder, nameContains, out, format };
}

async function findPDFs(folder: string, nameContains?: string): Promise<string[]> {
  const pattern = join(folder, '**', '*.pdf');
  const files = await glob(pattern, { nodir: true });
  
  if (!nameContains) {
    return files;
  }
  
  return files.filter(file => 
    basename(file).toLowerCase().includes(nameContains.toLowerCase())
  );
}

async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    // Read PDF file as ArrayBuffer and convert to Uint8Array
    const file = Bun.file(filePath);
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Load PDF document with disabled worker
    const pdf = await pdfjsLib.getDocument({ 
      data, 
      useWorker: false,
      isEvalSupported: false,
      useSystemFonts: true 
    }).promise;
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Combine text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (pageText) {
        fullText += pageText + '\n';
      }
    }
    
    return fullText.trim();
  } catch (error) {
    throw new Error(`Failed to extract text from ${filePath}: ${error}`);
  }
}

function parseTeamRetroSections(text: string): { title: string; sections: TeamRetroSection } {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  if (lines.length === 0) {
    return { title: 'Untitled', sections: {} };
  }
  
  const title = lines[0] || 'Untitled';
  const sections: TeamRetroSection = {};
  
  let currentSection: string | null = null;
  let currentContent: string[] = [];
  
  // Check if we have any known sections
  const hasKnownSections = lines.some(line => 
    KNOWN_SECTIONS.some(section => 
      line.toLowerCase().includes(section.toLowerCase())
    )
  );
  
  if (!hasKnownSections) {
    // If no known sections found, put everything under "Full text"
    sections['Full text'] = lines.slice(1).join('\n');
    return { title, sections };
  }
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this line is a section header
    const matchingSection = KNOWN_SECTIONS.find(section => 
      line.toLowerCase().includes(section.toLowerCase())
    );
    
    if (matchingSection) {
      // Save previous section if exists
      if (currentSection && currentContent.length > 0) {
        sections[currentSection] = currentContent.join('\n');
      }
      
      // Start new section
      currentSection = matchingSection;
      currentContent = [];
    } else if (currentSection) {
      // Add content to current section
      currentContent.push(line);
    } else {
      // Content before any section - check if it might be an unrecognized section header
      const words = line.split(/\s+/);
      if (words.length <= 5 && line.endsWith('?') || line.endsWith(':')) {
        // Likely a section header we don't recognize
        if (currentSection && currentContent.length > 0) {
          sections[currentSection] = currentContent.join('\n');
        }
        currentSection = line.replace(/[?:]+$/, '').trim();
        currentContent = [];
      } else if (currentSection) {
        currentContent.push(line);
      }
    }
  }
  
  // Save final section
  if (currentSection && currentContent.length > 0) {
    sections[currentSection] = currentContent.join('\n');
  }
  
  return { title, sections };
}

async function processPDF(filePath: string): Promise<TeamRetroData | null> {
  try {
    console.log(`Processing: ${basename(filePath)}`);
    
    const text = await extractTextFromPDF(filePath);
    const { title, sections } = parseTeamRetroSections(text);
    
    return {
      file: basename(filePath),
      title,
      sections
    };
  } catch (error) {
    console.warn(`Warning: Skipping ${basename(filePath)} - ${error}`);
    return null;
  }
}

function generateMarkdown(data: TeamRetroData[]): string {
  let markdown = '# TeamRetro Compilation\n\n';
  
  // Generate summary table
  markdown += '## Summary Table\n\n';
  markdown += '| File Name | Title | Sections Found |\n';
  markdown += '|-----------|-------|----------------|\n';
  
  for (const item of data) {
    const sectionNames = Object.keys(item.sections).join(', ');
    markdown += `| ${item.file} | ${item.title} | ${sectionNames} |\n`;
  }
  
  markdown += '\n---\n\n';
  
  // Generate detailed content
  for (const item of data) {
    markdown += `## ${item.file}\n\n`;
    markdown += `_Title:_ ${item.title}\n\n`;
    
    for (const [sectionName, sectionContent] of Object.entries(item.sections)) {
      markdown += `### ${sectionName}\n\n`;
      
      // Convert content to bullet points
      const lines = sectionContent.split('\n').filter(line => line.trim().length > 0);
      for (const line of lines) {
        markdown += `* ${line.trim()}\n`;
      }
      markdown += '\n';
    }
    
    markdown += '\n';
  }
  
  return markdown;
}

async function copyPDFs(pdfPaths: string[], outputDir: string): Promise<void> {
  for (const pdfPath of pdfPaths) {
    const fileName = basename(pdfPath);
    const destPath = join(outputDir, fileName);
    await copyFile(pdfPath, destPath);
  }
}

async function main() {
  const args = parseArgs();
  
  console.log(`Scanning for PDFs in: ${args.folder}`);
  if (args.nameContains) {
    console.log(`Filtering by name contains: ${args.nameContains}`);
  }
  
  // Find PDFs
  const pdfFiles = await findPDFs(args.folder, args.nameContains);
  console.log(`Found ${pdfFiles.length} PDF files`);
  
  if (pdfFiles.length === 0) {
    console.log('No PDF files found matching criteria');
    process.exit(0);
  }
  
  // Ensure output directory exists
  await mkdir(args.out, { recursive: true });
  
  // Process PDFs
  const results: TeamRetroData[] = [];
  
  for (const pdfFile of pdfFiles) {
    const result = await processPDF(pdfFile);
    if (result) {
      results.push(result);
    }
  }
  
  console.log(`Successfully processed ${results.length} PDF files`);
  
  if (results.length === 0) {
    console.log('No PDFs were successfully processed');
    process.exit(1);
  }
  
  // Generate output
  if (args.format === 'md') {
    const markdown = generateMarkdown(results);
    const outputPath = join(args.out, 'teamretro-compilation.md');
    await writeFile(outputPath, markdown, 'utf-8');
    console.log(`Markdown compilation written to: ${outputPath}`);
  } else {
    const outputPath = join(args.out, 'teamretro-compilation.json');
    await writeFile(outputPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`JSON compilation written to: ${outputPath}`);
  }
  
  // Copy PDFs to output directory
  await copyPDFs(pdfFiles, args.out);
  console.log(`Copied ${pdfFiles.length} PDF files to: ${args.out}`);
  
  console.log('Compilation complete!');
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});