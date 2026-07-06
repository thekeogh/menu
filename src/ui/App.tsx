import React, {useEffect, useMemo, useState} from 'react';
import fuzzysort from 'fuzzysort';
import {Box, Text, useApp, useInput, useStdout} from 'ink';
import type {CommandEntry, FocusPane} from '../types.js';
import {loadCommands} from '../config.js';
import {ProcessManager} from '../processManager.js';
import {keyToPtyInput} from '../terminalKeys.js';
import {CommandList, OutputPane, Pane, StatusBar, TaskAccordion} from './components.js';

const focusOrder: FocusPane[] = ['commands', 'output', 'tasks'];

export function App({
  initialCommands,
  launchCwd,
  configPath,
  processManager
}: {
  initialCommands: CommandEntry[];
  launchCwd: string;
  configPath: string;
  processManager: ProcessManager;
}) {
  const {exit} = useApp();
  const {stdout} = useStdout();
  const [commands, setCommands] = useState(initialCommands);
  const [query, setQuery] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState(0);
  const [expandedTaskId, setExpandedTaskId] = useState<number>();
  const [focus, setFocus] = useState<FocusPane>('commands');
  const [message, setMessage] = useState<string>();
  const [, setTick] = useState(0);

  useEffect(() => {
    const onChange = () => setTick((tick) => tick + 1);
    processManager.on('change', onChange);
    return () => {
      processManager.off('change', onChange);
    };
  }, [processManager]);

  useEffect(() => {
    const cols = stdout.columns || 120;
    const rows = stdout.rows || 40;
    processManager.resize(Math.floor(cols / 3), Math.max(10, rows - 6));
  }, [processManager, stdout.columns, stdout.rows]);

  const filteredCommands = useMemo(() => {
    if (!query) {
      return commands;
    }

    return fuzzysort
      .go(query, commands, {key: 'title', all: false})
      .map((result) => result.obj);
  }, [commands, query]);

  const backgroundRuns = processManager.getBackgroundRuns();
  const foregroundRun = processManager.getForegroundRun();
  const backgroundTaskIds = backgroundRuns.map((run) => run.id).join(':');
  const safeCommandIndex = clamp(selectedCommandIndex, 0, Math.max(0, filteredCommands.length - 1));
  const safeTaskIndex = clamp(selectedTaskIndex, 0, Math.max(0, backgroundRuns.length - 1));

  useEffect(() => {
    setSelectedCommandIndex((index) => clamp(index, 0, Math.max(0, filteredCommands.length - 1)));
  }, [filteredCommands.length]);

  useEffect(() => {
    setSelectedTaskIndex((index) => clamp(index, 0, Math.max(0, backgroundRuns.length - 1)));
    setExpandedTaskId((taskId) => backgroundRuns.some((run) => run.id === taskId) ? taskId : undefined);
  }, [backgroundRuns.length, backgroundTaskIds]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      const ptyInput = keyToPtyInput(input, key);
      const focusedTask = backgroundRuns[safeTaskIndex];
      if (
        focus === 'tasks' &&
        ptyInput &&
        focusedTask?.status.state === 'running' &&
        focusedTask.id === expandedTaskId
      ) {
        processManager.interruptRun(focusedTask.id);
        return;
      }

      if (focus === 'output' && ptyInput && foregroundRun?.status.state === 'running') {
        processManager.writeToRun(foregroundRun?.id, ptyInput);
        return;
      }

      processManager.killAll();
      exit();
      return;
    }

    if (key.ctrl && input === 'r') {
      void reloadConfig();
      return;
    }

    if (key.tab) {
      moveFocus(key.shift ? -1 : 1);
      return;
    }

    if (focus === 'commands') {
      handleCommandInput(input, key);
      return;
    }

    if (focus === 'tasks') {
      const selectedTask = backgroundRuns[safeTaskIndex];

      if (key.upArrow || (key.ctrl && input === 'p')) {
        setSelectedTaskIndex((index) => clamp(index - 1, 0, Math.max(0, backgroundRuns.length - 1)));
        return;
      }

      if (key.downArrow || (key.ctrl && input === 'n')) {
        setSelectedTaskIndex((index) => clamp(index + 1, 0, Math.max(0, backgroundRuns.length - 1)));
        return;
      }

      if (key.return && selectedTask) {
        setExpandedTaskId((taskId) => taskId === selectedTask.id ? undefined : selectedTask.id);
        return;
      }

      const ptyInput = keyToPtyInput(input, key);
      if (ptyInput && selectedTask?.id === expandedTaskId) {
        processManager.writeToRun(selectedTask.id, ptyInput);
      }
      return;
    }

    if (focus === 'output') {
      const ptyInput = keyToPtyInput(input, key);
      if (ptyInput) {
        processManager.writeToRun(foregroundRun?.id, ptyInput);
      }
    }
  });

  function handleCommandInput(input: string, key: Parameters<Parameters<typeof useInput>[0]>[1]): void {
    if (key.return) {
      const command = filteredCommands[safeCommandIndex];
      if (command) {
        processManager.run(command, launchCwd);
        setFocus(command.background ? 'tasks' : 'output');
      }
      return;
    }

    if (key.upArrow || (key.ctrl && input === 'p')) {
      setSelectedCommandIndex((index) => clamp(index - 1, 0, Math.max(0, filteredCommands.length - 1)));
      return;
    }

    if (key.downArrow || (key.ctrl && input === 'n')) {
      setSelectedCommandIndex((index) => clamp(index + 1, 0, Math.max(0, filteredCommands.length - 1)));
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((current) => current.slice(0, -1));
      return;
    }

    if (isPrintableInput(input) && !key.ctrl && !key.meta) {
      setQuery((current) => current + input);
    }
  }

  function moveFocus(delta: number): void {
    const index = focusOrder.indexOf(focus);
    setFocus(focusOrder[(index + delta + focusOrder.length) % focusOrder.length]);
  }

  async function reloadConfig(): Promise<void> {
    try {
      const nextCommands = await loadCommands(configPath);
      setCommands(nextCommands);
      setSelectedCommandIndex(0);
      setMessage(`Reloaded ${nextCommands.length} commands`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <Box flexDirection="column" height={stdout.rows || 40}>
      <Box flexGrow={1}>
        <Pane title="Commands" focused={focus === 'commands'} width="30%">
          <CommandList commands={filteredCommands} selectedIndex={safeCommandIndex} query={query} focus={focus} />
        </Pane>
        <Pane title="Output" focused={focus === 'output'} width="40%">
          <OutputPane run={foregroundRun} />
        </Pane>
        <Pane title="Tasks" focused={focus === 'tasks'} width="30%">
          <TaskAccordion
            runs={backgroundRuns}
            selectedIndex={safeTaskIndex}
            expandedTaskId={expandedTaskId}
            paneFocused={focus === 'tasks'}
            maxRows={Math.max(8, (stdout.rows || 40) - 6)}
          />
        </Pane>
      </Box>
      {commands.length === 0 ? <Text color="yellow">No commands configured in {configPath}</Text> : null}
      <StatusBar focus={focus} message={message} />
    </Box>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isPrintableInput(input: string): boolean {
  return input.length > 0 && !/[\u0000-\u001F\u007F]/.test(input);
}
