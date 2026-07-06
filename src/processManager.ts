import {EventEmitter} from 'node:events';
import {homedir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import pty from 'node-pty';
import type {CommandEntry, TerminalRun} from './types.js';

interface ManagedRun extends TerminalRun {
  ptyProcess: pty.IPty;
  autoBackgroundTimer?: NodeJS.Timeout;
  interruptTimer?: NodeJS.Timeout;
}

export class ProcessManager extends EventEmitter {
  private nextId = 1;
  private readonly runs = new Map<number, ManagedRun>();
  private readonly duplicateCounts = new Map<string, number>();
  foregroundRunId?: number;

  run(command: CommandEntry, launchCwd: string): TerminalRun {
    const cwd = command.cwd ? resolveCwd(command.cwd, launchCwd) : launchCwd;
    const id = this.nextId++;
    const title = this.titleFor(command.title);
    const explicitBackground = command.background;
    const startsAsBackground = explicitBackground === true;
    const shell = process.env.SHELL || '/bin/zsh';

    const ptyProcess = pty.spawn(shell, ['-lc', command.command], {
      name: 'xterm-256color',
      cols: Math.max(80, process.stdout.columns || 120),
      rows: Math.max(24, process.stdout.rows || 40),
      cwd,
      env: cleanEnv()
    });

    const run: ManagedRun = {
      id,
      title,
      command: command.command,
      cwd,
      output: '',
      status: {state: 'running'},
      background: startsAsBackground,
      pendingAutoBackground: explicitBackground === undefined,
      ptyProcess
    };

    this.runs.set(id, run);

    if (!startsAsBackground) {
      this.foregroundRunId = id;
    }

    ptyProcess.onData((data) => {
      run.output = appendOutput(run.output, data);
      this.emitChange();
    });

    ptyProcess.onExit(({exitCode, signal}) => {
      if (run.autoBackgroundTimer) {
        clearTimeout(run.autoBackgroundTimer);
      }
      if (run.interruptTimer) {
        clearTimeout(run.interruptTimer);
      }

      run.pendingAutoBackground = false;
      run.status = {state: 'exited', code: exitCode, signal};
      if (run.background) {
        this.runs.delete(id);
      }
      this.emitChange();
    });

    if (explicitBackground === undefined) {
      run.autoBackgroundTimer = setTimeout(() => {
        if (run.status.state === 'running') {
          run.background = true;
          run.pendingAutoBackground = false;
          if (this.foregroundRunId === id) {
            this.foregroundRunId = undefined;
          }
          this.emitChange();
        }
      }, 2000);
    }

    this.emitChange();
    return this.clone(run);
  }

  getForegroundRun(): TerminalRun | undefined {
    if (!this.foregroundRunId) {
      return undefined;
    }

    const run = this.runs.get(this.foregroundRunId);
    return run ? this.clone(run) : undefined;
  }

  getBackgroundRuns(): TerminalRun[] {
    return [...this.runs.values()]
      .filter((run) => run.background)
      .map((run) => this.clone(run));
  }

  writeToRun(id: number | undefined, input: string): void {
    if (!id) {
      return;
    }

    const run = this.runs.get(id);
    if (run?.status.state === 'running') {
      run.ptyProcess.write(input);
    }
  }

  interruptRun(id: number | undefined, graceMs = 1000): void {
    if (!id) {
      return;
    }

    const run = this.runs.get(id);
    if (run?.status.state !== 'running') {
      return;
    }

    run.ptyProcess.write('\x03');

    if (run.interruptTimer) {
      clearTimeout(run.interruptTimer);
    }

    run.interruptTimer = setTimeout(() => {
      const currentRun = this.runs.get(id);
      if (!currentRun || currentRun.status.state !== 'running') {
        return;
      }

      currentRun.status = {state: 'stopped'};
      try {
        currentRun.ptyProcess.kill();
      } catch {
        // Already gone.
      }

      if (currentRun.background) {
        this.runs.delete(id);
      }

      this.emitChange();
    }, graceMs);
  }

  resize(cols: number, rows: number): void {
    for (const run of this.runs.values()) {
      try {
        run.ptyProcess.resize(Math.max(20, cols), Math.max(5, rows));
      } catch {
        // Some PTYs reject resize shortly after exit.
      }
    }
  }

  killAll(): void {
    for (const run of this.runs.values()) {
      if (run.autoBackgroundTimer) {
        clearTimeout(run.autoBackgroundTimer);
      }
      if (run.interruptTimer) {
        clearTimeout(run.interruptTimer);
      }

      if (run.status.state === 'running') {
        run.status = {state: 'stopped'};
        try {
          run.ptyProcess.kill();
        } catch {
          // Already gone.
        }
      }
    }
  }

  private titleFor(title: string): string {
    const count = (this.duplicateCounts.get(title) || 0) + 1;
    this.duplicateCounts.set(title, count);
    return count === 1 ? title : `${title} ${count}`;
  }

  private clone(run: ManagedRun): TerminalRun {
    return {
      id: run.id,
      title: run.title,
      command: run.command,
      cwd: run.cwd,
      output: run.output,
      status: run.status,
      background: run.background,
      pendingAutoBackground: run.pendingAutoBackground
    };
  }

  private emitChange(): void {
    this.emit('change');
  }
}

function appendOutput(current: string, next: string): string {
  const output = current + next;
  const maxLength = 200_000;

  return output.length > maxLength ? output.slice(output.length - maxLength) : output;
}

function resolveCwd(cwd: string, launchCwd: string): string {
  if (cwd === '~') {
    return homedir();
  }

  if (cwd.startsWith('~/')) {
    return path.join(homedir(), cwd.slice(2));
  }

  return path.resolve(launchCwd, cwd);
}

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  env.TERM = env.TERM || 'xterm-256color';
  return env;
}
