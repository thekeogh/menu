import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
import {z} from 'zod';
import type {CommandEntry} from './types.js';

export const defaultConfigPath = path.join(homedir(), '.config', 'menu', 'commands.json');

const commandEntrySchema = z.object({
  title: z.string().min(1, 'title must not be empty'),
  command: z.string().min(1, 'command must not be empty'),
  cwd: z.string().min(1, 'cwd must not be empty').optional(),
  background: z.boolean().optional()
}).strict();

const commandsSchema = z.array(commandEntrySchema);

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export async function loadCommands(configPath = defaultConfigPath): Promise<CommandEntry[]> {
  let raw: string;

  try {
    raw = await readFile(configPath, 'utf8');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      await createEmptyConfig(configPath);
      return [];
    }

    throw new ConfigError(`Could not read config file ${configPath}: ${String(error)}`);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new ConfigError(`Config file is not valid JSON: ${String(error)}`);
  }

  const result = commandsSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const location = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `${location}: ${issue.message}`;
      })
      .join('\n');

    throw new ConfigError(`Config file has invalid command entries:\n${issues}`);
  }

  return result.data;
}

export async function ensureConfigFile(configPath = defaultConfigPath): Promise<void> {
  try {
    await readFile(configPath, 'utf8');
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === 'ENOENT') {
      await createEmptyConfig(configPath);
      return;
    }

    throw new ConfigError(`Could not read config file ${configPath}: ${String(error)}`);
  }
}

export async function saveCommands(commands: CommandEntry[], configPath = defaultConfigPath): Promise<void> {
  const result = commandsSchema.safeParse(commands);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const location = issue.path.length > 0 ? issue.path.join('.') : 'root';
        return `${location}: ${issue.message}`;
      })
      .join('\n');

    throw new ConfigError(`Refusing to save invalid commands:\n${issues}`);
  }

  try {
    await mkdir(path.dirname(configPath), {recursive: true});
    await writeFile(configPath, `${JSON.stringify(result.data, null, 2)}\n`, 'utf8');
  } catch (error) {
    throw new ConfigError(`Could not write config file ${configPath}: ${String(error)}`);
  }
}

async function createEmptyConfig(configPath: string): Promise<void> {
  try {
    await mkdir(path.dirname(configPath), {recursive: true});
    await writeFile(configPath, '[]\n', {encoding: 'utf8', flag: 'wx'});
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code !== 'EEXIST') {
      throw new ConfigError(`Could not create config file ${configPath}: ${String(error)}`);
    }
  }
}
