import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job, JobStatus } from './entities/job.entity';
import { AuditService } from './audit.service';

const ALLOWED_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.RUNNING],
  [JobStatus.RUNNING]: [JobStatus.COMPLETED, JobStatus.FAILED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.FAILED]: [],
};

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job)
    private readonly jobsRepo: Repository<Job>,
    private readonly auditService: AuditService,
  ) {}

  create(title: string, type: string): Promise<Job> {
    const job = this.jobsRepo.create({ title, type, status: JobStatus.PENDING });
    return this.jobsRepo.save(job);
  }

  findAll(status?: JobStatus): Promise<Job[]> {
    return this.jobsRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async remove(id: string): Promise<void> {
    const result = await this.jobsRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Job ${id} not found`);
    }
  }

  async updateStatus(id: string, to: JobStatus): Promise<Job> {
    // Which "from" statuses are allowed to become "to"?
    const validFromStatuses = (Object.keys(ALLOWED_TRANSITIONS) as JobStatus[])
      .filter((from) => ALLOWED_TRANSITIONS[from].includes(to));

    if (validFromStatuses.length === 0) {
      throw new ConflictException(`"${to}" is not a valid target status`);
    }

    // Snapshot the "from" status before the atomic update, for the audit log.
    const existingBefore = await this.jobsRepo.findOne({ where: { id } });

    // One atomic UPDATE with the current status in the WHERE clause,
    // instead of "read job, check status in JS, then save".
    // Postgres only lets ONE concurrent request match this WHERE
    // clause and actually change the row — the row itself is the lock.
    const result = await this.jobsRepo
      .createQueryBuilder()
      .update(Job)
      .set({ status: to })
      .where('id = :id', { id })
      .andWhere('status IN (:...from)', { from: validFromStatuses })
      .returning('*')
      .execute();

    if (result.affected && result.affected > 0) {
      const updated = await this.jobsRepo.findOneByOrFail({ id });
      this.auditService.recordTransition(
        id,
        updated.title,
        existingBefore?.status ?? 'unknown',
        to,
      );
      return updated;
    }

    // Nothing matched — was it a missing job, or a lost race /
    // invalid transition? Check, so the error message is accurate.
    const existing = await this.jobsRepo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException(`Job ${id} not found`);

    this.auditService.recordRejectedTransition(id, existing.title, to);

    throw new ConflictException(
      `Cannot move job from "${existing.status}" to "${to}". It may have already been updated by another request.`,
    );
  }
  async recheckJob(id: string) {
  const job = await this.jobsRepo.findOne({ where: { id } });
  if (!job) throw new NotFoundException(`Job ${id} not found`);
  return this.auditService.recheckJob(id, job.title);
}

  getFlaggedAuditEvents() {
    return this.auditService.getFlaggedEvents();
  }
}