import process from 'node:process';
import {confirm, input, select} from '@inquirer/prompts';
import {loadCommands, saveCommands} from './config.js';
import type {CommandEntry} from './types.js';

type BackgroundChoice = 'auto' | 'true' | 'false';
type DuplicateChoice = 'overwrite' | 'new';

export async function runCommandCreator(configPath: string): Promise<void> {
  const commands = await loadCommands(configPath);
  const title = await promptForUniqueTitle(commands);
  const existingIndex = commands.findIndex((command) => command.title === title);
  const command = await input({
    message: 'Command',
    required: true,
    validate: (value) => value.trim().length > 0 || 'Enter a command to run.'
  });
  const cwd = await input({
    message: 'Working directory (blank = launch directory)',
    default: ''
  });
  const background = await select<BackgroundChoice>({
    message: 'Background behavior',
    choices: [
      {name: 'Auto-detect after ~2s', value: 'auto'},
      {name: 'Always background', value: 'true'},
      {name: 'Always foreground', value: 'false'}
    ]
  });

  const nextCommand: CommandEntry = {
    title,
    command: command.trim()
  };

  if (cwd.trim()) {
    nextCommand.cwd = cwd.trim();
  }

  if (background !== 'auto') {
    nextCommand.background = background === 'true';
  }

  if (existingIndex >= 0) {
    commands[existingIndex] = nextCommand;
  } else {
    commands.push(nextCommand);
  }

  await saveCommands(commands, configPath);
  console.log(`Saved "${title}" to ${configPath}`);
}

async function promptForUniqueTitle(commands: CommandEntry[]): Promise<string> {
  while (true) {
    const title = await input({
      message: 'Name',
      required: true,
      validate: (value) => value.trim().length > 0 || 'Enter a command name.'
    });
    const normalizedTitle = title.trim();
    const duplicate = commands.find((command) => command.title === normalizedTitle);

    if (!duplicate) {
      return normalizedTitle;
    }

    console.log(`"${normalizedTitle}" already exists.`);

    const duplicateChoice = await select<DuplicateChoice>({
      message: 'What do you want to do?',
      choices: [
        {name: 'Overwrite existing command', value: 'overwrite'},
        {name: 'Enter a different name', value: 'new'}
      ]
    });

    if (duplicateChoice === 'overwrite') {
      const shouldOverwrite = await confirm({
        message: `Overwrite "${normalizedTitle}"?`,
        default: false
      });

      if (shouldOverwrite) {
        return normalizedTitle;
      }
    }
  }
}

export function printCommandCreatorHelp(): void {
  console.log(`Usage:
  menu          Open the launcher
  menu cmd      Add or overwrite a command in the config
  menu config   Open the raw config file in $VISUAL, $EDITOR, or vi

Environment:
  MENU_CONFIG=/path/to/commands.json menu
  MENU_CONFIG=/path/to/commands.json menu cmd
  MENU_CONFIG=/path/to/commands.json menu config`);
}

export function isCommandCreatorRequest(argv = process.argv): boolean {
  return argv[2] === 'cmd';
}
