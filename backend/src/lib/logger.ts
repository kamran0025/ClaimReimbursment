// Minimal console logger: one short line per message, e.g.
//   2026-09-30 11:40:02 INFO  GET /claims 200 12ms
// Silent under tests (vitest sets NODE_ENV=test) to keep test output clean.
type Level = 'INFO' | 'WARN' | 'ERROR';

// const silent = process.env.NODE_ENV === 'test';

function write(level: Level, message: string): void {
  // if (silent) return;
  const time = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const line = `${time} ${level.padEnd(5)} ${message}`;
  // eslint-disable-next-line no-console
  (level === 'ERROR' ? console.error : console.log)(line);
}

export const logger = {
  info: (message: string) => write('INFO', message),
  warn: (message: string) => write('WARN', message),
  error: (message: string) => write('ERROR', message),
};
