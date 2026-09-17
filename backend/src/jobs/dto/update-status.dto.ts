import { IsEnum } from 'class-validator';
import { JobStatus } from '../entities/job.entity';

export class UpdateStatusDto {
  @IsEnum(JobStatus, {
    message: 'status must be one of: pending, running, completed, failed',
  })
  status: JobStatus;
}