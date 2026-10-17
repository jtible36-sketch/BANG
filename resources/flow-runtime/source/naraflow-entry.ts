import { LocalCore, shapes } from './src/core.js';
import { PORT, startServer } from './src/server.js';
import { HOME_DIR, getFlowPage } from './src/chrome.js';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

// Naraflow starts the HTTP owner directly, without the MCP stdio process or an external Studio launcher.
mkdirSync(HOME_DIR, { recursive: true });
const lock = join(HOME_DIR, 'owner.lock');
if (existsSync(lock)) {
  const owner = JSON.parse(readFileSync(lock, 'utf8')) as { pid?: number };
  if (!Number.isInteger(owner.pid) || owner.pid! <= 0) throw new Error('Flow owner lock is invalid.');
  let active = false;
  try { process.kill(owner.pid!, 0); active = true; } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  if (active) throw new Error('The Naraflow Flow profile already has an active owner. Use its original port or reopen Naraflow after it finishes.');
  unlinkSync(lock);
}
const fd = openSync(lock, 'wx');
writeFileSync(fd, JSON.stringify({ pid: process.pid, port: PORT })); closeSync(fd);
process.on('exit', () => {
  try { if (JSON.parse(readFileSync(lock, 'utf8')).pid === process.pid) unlinkSync(lock); } catch { /* A crashed owner remains recoverable. */ }
});
const core = new LocalCore();
let leasedUntil = 0;
(shapes as any).lease = {};
(core as any).lease = async () => { leasedUntil = Date.now() + 12000; return { alive: true }; };
(shapes as any).prepare = { inspect: z.boolean().default(true), type: z.enum(['video', 'image']).default('video') };
(core as any).prepare = async () => {
  if (core.activeJobs()) throw new Error('Flow is generating. Wait for the current shot before preparing the browser.');
  await getFlowPage();
  return core.status({ detailed: false });
};
const role = await startServer(core);
if (role !== 'owner') process.exit(0);
writeFileSync(join(HOME_DIR, 'owner.json'), JSON.stringify({ pid: process.pid, port: PORT }));
console.log(`Naraflow Flow engine ready on ${PORT}`);

// Keep paid work running if Naraflow closes; finish the queue before stopping the owner.
// IPC disconnect reliably identifies the parent exit, without trusting a recycled Windows PID.
let parentGone = false;
process.on('disconnect', () => { parentGone = true; });
process.on('message', message => { if ((message as { type?: string })?.type === 'detach') parentGone = true; });
setInterval(() => { if (parentGone && core.activeJobs() === 0 && Date.now() > leasedUntil) process.exit(0); }, 1000);
