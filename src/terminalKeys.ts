import type {Key} from 'ink';

export function keyToPtyInput(input: string, key: Key): string | undefined {
  if (key.ctrl && input === 'c') {
    return '\x03';
  }

  if (key.return) {
    return '\r';
  }

  if (key.tab) {
    return '\t';
  }

  if (key.backspace || key.delete) {
    return '\x7f';
  }

  if (key.escape) {
    return '\x1b';
  }

  if (key.upArrow) {
    return '\x1b[A';
  }

  if (key.downArrow) {
    return '\x1b[B';
  }

  if (key.rightArrow) {
    return '\x1b[C';
  }

  if (key.leftArrow) {
    return '\x1b[D';
  }

  return input.length > 0 ? input : undefined;
}

export function trimTerminalOutput(output: string, maxLines: number): string {
  const normalized = output.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n');
}
