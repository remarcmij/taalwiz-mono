import { Controller, Get } from '@nestjs/common';
import mongoose from 'mongoose';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: mongoose.connection.readyState === 1 ? 'up' : 'down',
    };
  }
}
