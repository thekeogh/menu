#!/usr/bin/env node
import process from 'node:process';
import React from 'react';
import {render} from 'ink';
import {ConfigError, defaultConfigPath, loadCommands} from './config.js';
import {isCommandCreatorRequest, printCommandCreatorHelp, runCommandCreator} from './cmdPrompt.js';
import {isConfigEditorRequest, openConfig} from './configEditor.js';
import {ProcessManager} from './processManager.js';
import {App} from './ui/App.js';

const launchCwd = process.cwd();
const configPath = process.env.MENU_CONFIG || defaultConfigPath;
const processManager = new ProcessManager();
const [, , command] = process.argv;

installCleanup(processManager);

try {
  if (command === '--help' || command === '-h') {
    printCommandCreatorHelp();
    process.exit(0);
  }

  if (isCommandCreatorRequest()) {
    await runCommandCreator(configPath);
    process.exit(0);
  }

  if (isConfigEditorRequest()) {
    await openConfig(configPath);
    process.exit(0);
  }

  if (command) {
    console.error(`Unknown command: ${command}`);
    printCommandCreatorHelp();
    process.exit(1);
  }

  const commands = await loadCommands(configPath);
  render(
    <App
      initialCommands={commands}
      launchCwd={launchCwd}
      configPath={configPath}
      processManager={processManager}
    />,
    {exitOnCtrlC: false}
  );
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}

function installCleanup(manager: ProcessManager): void {
  let cleaned = false;

  const cleanup = () => {
    if (!cleaned) {
      cleaned = true;
      manager.killAll();
    }
  };

  process.once('SIGINT', () => {
    cleanup();
    process.exit(130);
  });

  process.once('SIGTERM', () => {
    cleanup();
    process.exit(143);
  });

  process.once('exit', cleanup);
}
