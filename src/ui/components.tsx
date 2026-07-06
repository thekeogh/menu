import React from 'react';
import {Box, Text} from 'ink';
import type {CommandEntry, FocusPane, TerminalRun} from '../types.js';
import {trimTerminalOutput} from '../terminalKeys.js';

export function Pane({
  title,
  focused,
  children,
  width
}: {
  title: string;
  focused: boolean;
  children: React.ReactNode;
  width: string | number;
}) {
  return (
    <Box
      borderStyle="single"
      borderColor={focused ? 'cyan' : 'gray'}
      flexDirection="column"
      width={width}
      height="100%"
      paddingX={1}
    >
      <Text color={focused ? 'cyan' : 'white'} bold>
        {title}
      </Text>
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  );
}

export function CommandList({
  commands,
  selectedIndex,
  query,
  focus
}: {
  commands: CommandEntry[];
  selectedIndex: number;
  query: string;
  focus: FocusPane;
}) {
  return (
    <Box flexDirection="column">
      <Text>
        <Text color="gray">Search: </Text>
        <Text color={focus === 'commands' ? 'cyan' : 'white'}>{query || ' '}</Text>
      </Text>
      <Box marginTop={1} flexDirection="column">
        {commands.length === 0 ? (
          <Text color="yellow">No commands match.</Text>
        ) : (
          commands.slice(0, 24).map((command, index) => (
            <Text key={`${command.title}-${command.command}`} color={index === selectedIndex ? 'cyan' : undefined}>
              {index === selectedIndex ? '>' : ' '} {command.title}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
}

export function OutputPane({run}: {run: TerminalRun | undefined}) {
  if (!run) {
    return <Text color="gray">Run a command to see output here.</Text>;
  }

  const status = statusText(run);
  const output = trimTerminalOutput(run.output, 28);

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="cyan">{run.title}</Text> <Text color="gray">({status})</Text>
      </Text>
      <Text color="gray">{run.command}</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>{output || ' '}</Text>
      </Box>
    </Box>
  );
}

export function TaskAccordion({
  runs,
  selectedIndex,
  expandedTaskId,
  paneFocused,
  maxRows
}: {
  runs: TerminalRun[];
  selectedIndex: number;
  expandedTaskId: number | undefined;
  paneFocused: boolean;
  maxRows: number;
}) {
  if (runs.length === 0) {
    return (
      <Box borderStyle="single" borderColor="gray" paddingX={1} height={4} flexDirection="column">
        <Text color="gray" italic>
          No tasks.
        </Text>
      </Box>
    );
  }

  const collapsedRows = 4;
  const openRows = Math.max(5, maxRows - (runs.length - 1) * collapsedRows);

  return (
    <Box flexDirection="column">
      {runs.map((run, index) => {
        const selected = paneFocused && index === selectedIndex;
        const expanded = run.id === expandedTaskId;
        const outputRows = Math.max(1, openRows - 5);

        return (
          <Box
            key={run.id}
            borderStyle="single"
            borderColor={selected ? 'magentaBright' : 'magenta'}
            height={expanded ? openRows : collapsedRows}
            flexDirection="column"
            paddingX={1}
          >
            <Text color={selected ? 'magentaBright' : 'white'} bold={selected} wrap="truncate">
              {expanded ? 'v' : '>'} {run.title}
            </Text>
            <Text color={statusColor(run)} wrap="truncate">
              {statusText(run)}
            </Text>
            {expanded ? (
              <Box flexDirection="column">
                <Text color="gray" wrap="truncate">
                  {run.command}
                </Text>
                <Text wrap="truncate">{trimTerminalOutput(run.output, outputRows) || ' '}</Text>
              </Box>
            ) : null}
          </Box>
        );
      })}
    </Box>
  );
}

export function StatusBar({
  focus,
  message
}: {
  focus: FocusPane;
  message: string | undefined;
}) {
  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text>
        <Text color="cyan">{focus}</Text>
        {'  '}
        <Text color="gray">type search | enter run | tab/shift-tab focus | arrows/ctrl-n/ctrl-p move | ctrl-r reload | ctrl-c quit/input</Text>
        {message ? <Text color="yellow">  {message}</Text> : null}
      </Text>
    </Box>
  );
}

function statusText(run: TerminalRun): string {
  if (run.pendingAutoBackground) {
    return 'detecting';
  }

  if (run.status.state === 'running') {
    return 'running';
  }

  if (run.status.state === 'stopped') {
    return 'stopped';
  }

  return `exited ${run.status.code ?? 'signal'}`;
}

function statusColor(run: TerminalRun): 'green' | 'yellow' | 'red' | 'gray' {
  if (run.pendingAutoBackground) {
    return 'yellow';
  }

  if (run.status.state === 'running') {
    return 'green';
  }

  if (run.status.state === 'stopped') {
    return 'red';
  }

  return 'gray';
}
