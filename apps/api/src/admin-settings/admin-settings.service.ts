import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import SystemSettings, { SystemSettingsDoc } from './models/system-settings.model.js';
import { settingsSeed } from './seeds/settings.seed.js';

@Injectable()
export class AdminSettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSettingsService.name);

  async onApplicationBootstrap(): Promise<void> {
    const exists = await SystemSettings.findOne({}).exec();
    if (exists) return;

    await SystemSettings.insertMany(settingsSeed);
    this.logger.log('Seeded system settings');
  }

  findAll() {
    return SystemSettings.find().sort({ sortIndex: 1 }).exec();
  }

  async updateMany(settings: (SystemSettingsDoc & { _id: string })[]) {
    for (const setting of settings) {
      const { _id, ...rest } = setting;
      await SystemSettings.findByIdAndUpdate(_id, { $set: rest }).exec();
    }
    return this.findAll();
  }
}
