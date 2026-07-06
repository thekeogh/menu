import {spawn} from 'node:child_process';
import process from 'node:process';
import {ensureConfigFile} from './config.js';

export async function openConfig(configPath: string): Promise<void> {
  await ensureConfigFile(configPath);

  const editor = process.env.VISUAL || process.env.EDITOR || 'vi';
  await new Promise<void>((resolve, reject) => {
    const child = spawn(editor, [configPath], {
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${editor} exited with ${signal ? `signal ${signal}` : `code ${code}`}`));
    });
  });
}

export function isConfigEditorRequest(argv = process.argv): boolean {
  return argv[2] === 'config';
}
