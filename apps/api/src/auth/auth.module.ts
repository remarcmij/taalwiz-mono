import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core/constants.js';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './guards/auth.guard.js';
import { RolesGuard } from './guards/role.guard.js';
import { EnvDto } from '../util/env.dto.js';

const env = EnvDto.getInstance();

@Module({
  imports: [
    UsersModule,
    JwtModule.register({
      global: true,
      secret: env.jwtSecret,
    }),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    AuthService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
