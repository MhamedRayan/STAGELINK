// Generates src/api/schema/<service>.d.ts from ../contracts/<service>.yaml
import { execSync } from 'node:child_process';

const services = ['identity', 'offers', 'applications', 'internships', 'notifications'];
for (const name of services) {
  console.log(`> ${name}`);
  execSync(`npx openapi-typescript ../contracts/${name}.yaml -o src/api/schema/${name}.d.ts`, {
    stdio: 'inherit',
  });
}
