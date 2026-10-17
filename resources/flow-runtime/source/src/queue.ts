import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync, statSync, realpathSync } from 'node:fs';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';

export type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

export interface SceneParams {
  prompt: string;
  type: "video" | "image";
  max_credits: number;
  duration?: 4 | 6 | 8 | 10;
  resolution?: "360p" | "720p";
  model?: string;
  aspect_ratio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  variants?: number;
  first_frame?: string;
  last_frame?: string;
  reference_images?: string[];
  chain_from?: string;
  reference_from?: string;
  edit_asset?: string;
  agent_scenes?: string[];
  continue_from?: string;
  attach?: string[];
  continue_mode?: "exact" | "likeness";
  retries?: number;
  download_quality?: "original" | "upscaled";
  output_dir: string;
  file_stem: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  params: SceneParams;
  files: string[];
  attempts: number;
  credits?: number;
  submitted?: boolean;
  failureKind?: 'not_submitted' | 'interrupted';
  persist?: () => void;
  progress?: string;
  note?: string;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

export type JobRunner = (job: Job) => Promise<string[]>;

// Flow is driven like a careful person would: one generation at a time, with a
// randomised pause between them.
const PAUSE_MIN_MS = Number(process.env.FLOW_MCP_PAUSE_MIN_S ?? 25) * 1000;
const PAUSE_MAX_MS = Number(process.env.FLOW_MCP_PAUSE_MAX_S ?? 70) * 1000;

export class JobQueue {
  private jobs = new Map<string, Job>();
  private working = false;
  private lastFinished = 0;
  pausedReason: string | null = null;

  constructor(private runner: JobRunner, private journal?: string, private outputRoot?: string) {
    if (!journal || !existsSync(journal)) return;
    const saved = JSON.parse(readFileSync(journal, 'utf8')) as Job[];
    if (!Array.isArray(saved) || saved.length > 2000) throw new Error('Flow journal is invalid.');
    const inside = (file: string) => {
      if (!outputRoot) return false;
      const rel = relative(resolve(outputRoot), resolve(file));
      if (!rel || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) return false;
      if (existsSync(file) && existsSync(outputRoot)) {
        const real = relative(realpathSync(outputRoot), realpathSync(file));
        if (!real || real === '..' || real.startsWith('..' + sep) || isAbsolute(real)) return false;
      }
      return true;
    };
    for (const job of saved) {
      if (!/^[a-z0-9-]{1,160}$/i.test(job.id) || !job.params || !['image', 'video'].includes(job.params.type) || !/^scene-\d+$/.test(job.params.file_stem) || !inside(job.params.output_dir)) continue;
      job.files = (job.files || []).filter(file => inside(file) && existsSync(file) && statSync(file).isFile() && statSync(file).size > 0);
      if (job.status === 'queued' || job.status === 'running') {
        const matches = (job.params.type === 'video' ? ['.mp4', '.webm', '.mov'] : ['.png', '.jpg', '.jpeg', '.webp'])
          .map(ext => join(job.params.output_dir, job.params.file_stem + ext)).filter(file => inside(file) && existsSync(file) && statSync(file).isFile() && statSync(file).size > 0);
        if (matches.length) { job.files = matches; job.status = 'done'; job.error = undefined; }
        else {
          job.status = 'failed'; job.failureKind = job.submitted ? 'interrupted' : 'not_submitted';
          job.error = job.submitted ? 'Interrupted after submission. Recover the existing result from Flow; do not regenerate.' : 'Interrupted before submission. Nothing was generated.';
        }
      }
      job.persist = () => this.save(); this.jobs.set(job.id, job);
    }
    this.save();
  }

  private save(): void {
    if (!this.journal) return;
    mkdirSync(dirname(this.journal), { recursive: true });
    const temp = this.journal + '.tmp';
    writeFileSync(temp, JSON.stringify(this.list().slice(-2000))); renameSync(temp, this.journal);
  }

  add(params: SceneParams): Job {
    const job: Job = {
      id: randomUUID().slice(0, 8),
      status: "queued",
      params,
      files: [],
      attempts: 0,
      createdAt: new Date().toISOString(),
    };
    job.persist = () => this.save(); this.jobs.set(job.id, job);
    try { this.save(); } catch (error) { this.jobs.delete(job.id); throw error; }
    void this.work();
    return job;
  }

  get busy(): boolean {
    return this.list().some((j) => j.status === "running");
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(): Job[] {
    return [...this.jobs.values()];
  }

  // Puts a failed or cancelled job back in line with the same settings and file name.
  retry(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (job && (job.status === "failed" || job.status === "cancelled")) {
      job.status = "queued";
      job.error = undefined;
      job.failureKind = undefined;
      job.submitted = false;
      job.finishedAt = undefined;
      this.save();
      void this.work();
    }
    return job;
  }

  cancel(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (job && job.status === "queued") {
      job.status = "cancelled";
      job.finishedAt = new Date().toISOString();
      this.save();
    }
    return job;
  }

  private async work(): Promise<void> {
    if (this.working) return;
    this.working = true;
    try {
      for (;;) {
        const job = this.list().find((j) => j.status === "queued");
        if (!job) return;
        if (this.lastFinished) {
          const pause = PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS);
          const remaining = this.lastFinished + pause - Date.now();
          if (remaining > 0) {
            this.pausedReason = `pacing: next generation in ${Math.ceil(remaining / 1000)}s`;
            await new Promise((r) => setTimeout(r, remaining));
            this.pausedReason = null;
          }
        }
        if (job.status !== "queued") continue;
        job.status = "running";
        job.attempts++;
        this.save();
        try {
          job.files = await this.runner(job);
          job.status = "done";
          job.error = undefined;
        } catch (err) {
          job.error = err instanceof Error ? err.message : String(err);
          // Failed tiles are already retried inside Flow (its own Retry button); only an agent that produced nothing
          // is re-queued here. Timeouts are never retried automatically: they may still have spent credits.
          const retryable = /agent finished without creating/i.test(job.error);
          job.status = retryable && job.attempts <= (job.params.retries ?? 1) ? "queued" : "failed";
          if (job.status === 'failed') job.failureKind = job.submitted ? 'interrupted' : 'not_submitted';
        }
        job.finishedAt = new Date().toISOString();
        this.save();
        this.lastFinished = Date.now();
      }
    } finally {
      this.working = false;
    }
  }
}
