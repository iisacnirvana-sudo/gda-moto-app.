import { mkdir, copyFile } from 'node:fs/promises';

await mkdir('www', { recursive: true });
await copyFile('index.html', 'www/index.html');
console.log('GDA Moto web assets prepared in www/.');
