import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

interface TransitionRecord {
  status: string;
  timestamp: number;
}

export interface AuditEvent {
  timestamp: string;
  jobId: string;
  jobTitle: string;
  from: string;
  to: string;
  flagged: boolean;
  reasons: string[];
  summary: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly logPath = path.join(process.cwd(), 'audit.log');
  private history = new Map<string, TransitionRecord[]>();
  private illegalAttempts = new Map<string, number[]>();
  private flaggedEvents: AuditEvent[] = [];

  private readonly MAX_FLAGGED = 100;
  private readonly FLAP_WINDOW_MS = 5000;
  private readonly FLAP_THRESHOLD = 2;
  private readonly FAST_TRANSITION_MS = 1000;

  constructor(private readonly config: ConfigService) {}

  async recordTransition(jobId: string, jobTitle: string, from: string, to: string) {
    const now = Date.now();
    const reasons: string[] = [];
    const recent = (this.history.get(jobId) ?? []).filter(
      (r) => now - r.timestamp < this.FLAP_WINDOW_MS,
    );

    if (recent.length >= this.FLAP_THRESHOLD) {
      reasons.push(`rapid_flapping: ${recent.length + 1} transitions within ${this.FLAP_WINDOW_MS}ms`);
    }

    const last = recent[recent.length - 1];
    if (last && now - last.timestamp < this.FAST_TRANSITION_MS) {
      reasons.push(`unusual_timing: ${now - last.timestamp}ms after previous change`);
    }

    recent.push({ status: to, timestamp: now });
    this.history.set(jobId, recent.slice(-10));

    await this.writeEvent({
      timestamp: new Date(now).toISOString(),
      jobId,
      jobTitle,
      from,
      to,
      flagged: reasons.length > 0,
      reasons,
      summary: '',
    });
  }

  async recordRejectedTransition(jobId: string, jobTitle: string, attemptedTo: string) {
    const now = Date.now();
    const attempts = (this.illegalAttempts.get(jobId) ?? []).filter(
      (t) => now - t < this.FLAP_WINDOW_MS,
    );
    attempts.push(now);
    this.illegalAttempts.set(jobId, attempts);

    if (attempts.length >= 3) {
      await this.writeEvent({
        timestamp: new Date(now).toISOString(),
        jobId,
        jobTitle,
        from: 'n/a',
        to: attemptedTo,
        flagged: true,
        reasons: [`repeated_illegal_attempts: ${attempts.length} rejected transitions within ${this.FLAP_WINDOW_MS}ms`],
        summary: '',
      });
    }
  }

  async recheckJob(jobId: string, jobTitle: string): Promise<AuditEvent> {
    const now = Date.now();
    const recent = (this.history.get(jobId) ?? []).filter(
      (r) => now - r.timestamp < this.FLAP_WINDOW_MS,
    );
    const reasons: string[] = [];

    if (recent.length >= this.FLAP_THRESHOLD) {
      reasons.push(`rapid_flapping: ${recent.length} transitions within ${this.FLAP_WINDOW_MS}ms`);
    }
    const last = recent[recent.length - 1];
    if (last && now - last.timestamp < this.FAST_TRANSITION_MS) {
      reasons.push(`unusual_timing: ${now - last.timestamp}ms since previous change`);
    }

    const event: AuditEvent = {
      timestamp: new Date(now).toISOString(),
      jobId,
      jobTitle,
      from: 'manual_recheck',
      to: last?.status ?? 'unknown',
      flagged: reasons.length > 0,
      reasons,
      summary: '',
    };
    await this.writeEvent(event);
    return event;
  }

  getFlaggedEvents(): AuditEvent[] {
    return this.flaggedEvents;
  }

  private async writeEvent(event: AuditEvent) {
    try {
      if (event.flagged) {
        event.summary = await this.narrate(event);
        this.flaggedEvents.unshift(event);
        this.flaggedEvents = this.flaggedEvents.slice(0, this.MAX_FLAGGED);
      }
      fs.appendFile(this.logPath, JSON.stringify(event) + '\n', (err) => {
        if (err) this.logger.warn(`audit log write failed: ${err}`);
      });
    } catch (err) {
      this.logger.warn(`writeEvent failed (non-fatal): ${err}`);
    }
  }

  /**
   * Turns raw rule-engine reason codes into one plain-English sentence.
   * Uses Groq's gpt-oss-120b — a reasoning model, so it needs enough
   * max_tokens to cover both its internal reasoning AND the visible
   * answer, plus reasoning_effort:'low' so it doesn't burn the whole
   * budget thinking and return an empty string. Falls back to the raw
   * facts on ANY failure (missing key, non-200, network error, empty
   * response) — this must never throw or block the caller.
   */
  private async narrate(event: AuditEvent): Promise<string> {
    const rawFacts = `Job "${event.jobTitle}" (${event.jobId}): ${event.from} -> ${event.to}. Flags: ${event.reasons.join('; ')}`;
    const apiKey = this.config.get<string>('GROQ_API_KEY');

    if (!apiKey) {
      this.logger.warn('GROQ_API_KEY is not set — using raw facts instead of an LLM summary');
      return rawFacts;
    }

    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: this.config.get('GROQ_MODEL') ?? 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content:
                'You are a terse ops auditor for a job queue system. Given raw anomaly facts, write ONE short sentence (max 25 words) explaining it plainly to an on-call engineer. No preamble, no markdown, no quotation marks.',
            },
            { role: 'user', content: rawFacts },
          ],
          max_tokens: 200,
          temperature: 0.3,
          reasoning_effort: 'low',
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        this.logger.warn(`Groq returned ${res.status}: ${body}`);
        return rawFacts;
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim();

      if (!text) {
        this.logger.warn(`Groq returned an empty completion, full response: ${JSON.stringify(data)}`);
        return rawFacts;
      }

      this.logger.log(`Groq succeeded: "${text}"`);
      return text;
    } catch (err) {
      this.logger.warn(`Groq call threw: ${err}`);
      return rawFacts;
    }
  }
}