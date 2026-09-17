import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import type { JobStatus } from './entities/job.entity';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.create(dto.title, dto.type);
  }

  @Get()
  findAll(@Query('status') status?: JobStatus) {
    return this.jobsService.findAll(status);
  }

  @Get('audit/flagged')
  getFlaggedEvents() {
    return this.jobsService.getFlaggedAuditEvents();
  }

  @Post(':id/audit/recheck')
recheckJob(@Param('id') id: string) {
  return this.jobsService.recheckJob(id);
}

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.jobsService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.jobsService.remove(id);
  }
}
