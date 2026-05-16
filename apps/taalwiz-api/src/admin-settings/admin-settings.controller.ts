import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminSettingsService } from './admin-settings.service.js';
import { SystemSettingsDoc } from './models/system-settings.model.js';

@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  @Roles('admin')
  findAll() {
    return this.adminSettingsService.findAll();
  }

  @Patch()
  @Roles('admin')
  update(@Body() body: { settings: (SystemSettingsDoc & { _id: string })[] }) {
    return this.adminSettingsService.updateMany(body.settings);
  }
}
