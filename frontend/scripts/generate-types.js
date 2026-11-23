import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import openapiTS, { astToString } from 'openapi-typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const contractsDir = path.resolve(__dirname, '../../contracts');
const outputDir = path.resolve(__dirname, '../src/types/api');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const services = [
  { name: 'identity', file: 'identity.yaml' },
  { name: 'offers', file: 'offers.yaml' },
  { name: 'applications', file: 'applications.yaml' },
  { name: 'internships', file: 'internships.yaml' },
  { name: 'notifications', file: 'notifications.yaml' },
];

async function generate() {
  console.log('Generating TypeScript types from OpenAPI contracts...');
  for (const s of services) {
    const inputPath = path.join(contractsDir, s.file);
    const outputPath = path.join(outputDir, `${s.name}.ts`);
    console.log(`- ${s.file} -> src/types/api/${s.name}.ts`);
    const ast = await openapiTS(inputPath);
    const ts = astToString(ast);
    fs.writeFileSync(outputPath, ts, 'utf-8');
  }
  console.log('OpenAPI type generation complete!');
}

generate().catch((err) => {
  console.error('Type generation failed:', err);
  process.exit(1);
});
