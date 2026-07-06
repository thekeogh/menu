export interface CommandEntry {
  title: string;
  command: string;
  cwd?: string;
  background?: boolean;
}

export type TaskStatus =
  | {state: 'running'}
  | {state: 'stopped'}
  | {state: 'exited'; code: number | null; signal?: number | null};

export interface TerminalRun {
  id: number;
  title: string;
  command: string;
  cwd: string;
  output: string;
  status: TaskStatus;
  background: boolean;
  pendingAutoBackground: boolean;
}

export type FocusPane = 'commands' | 'output' | 'tasks';
