import { Injectable, Logger, OnApplicationBootstrap, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ACCOUNT_SUSPENDED, AUTH_FAILED } from '@repo/shared';
import type { Language, Role } from '../users/models/user.model.js';
import { UsersService } from '../users/users.service.js';
import { EnvDto } from '../util/env.dto.js';
import { UserSeedDto } from './dto/user-seed.dto.js';
import { getSeedUsers } from './seed/users.seed.js';
import type {
  AuthResponse,
  RefreshTokenResponse,
} from './types/auth-response.interface.js';
import {
  JwtPayload,
  JwtPayloadSchema,
  RegTokenPayload,
  RegTokenSchema,
} from './types/jwtpayload.interface.js';

const ACCESS_TOKEN_EXPIRATION = 60 * 60; // 1 hour

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvDto, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    for (const seedUser of plainToInstance(UserSeedDto, getSeedUsers(this.config))) {
      const errors = await validate(seedUser);
      if (errors.length > 0) {
        this.logger.error(`Invalid seed user data: ${JSON.stringify(errors)}`);
        continue;
      }
      const user = await this.usersService.findOne(seedUser.email);
      if (!user) {
        try {
          await this.usersService.createUser({
            name: seedUser.name,
            email: seedUser.email,
            password: await this.usersService.encryptPassword(seedUser.password),
            roles: seedUser.roles,
            lang: seedUser.lang,
          });
          this.logger.log(`Seeded user: ${seedUser.email}`);
        } catch (err) {
          if (err instanceof Error) {
            this.logger.error(`Error seeding user ${seedUser.email}: ${err.message}`);
          }
        }
      }
    }
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const user = await this.usersService.findOne(email);

    if (!user) {
      this.logger.error(`User ${email} not found`);
      throw new UnauthorizedException(AUTH_FAILED);
    }

    if (!(await bcrypt.compare(password, user.password))) {
      this.logger.error(`Invalid password for user ${email}`);
      throw new UnauthorizedException(AUTH_FAILED);
    }

    if (user.isSuspended) {
      this.logger.error(`User ${email} account is suspended`);
      throw new UnauthorizedException(ACCOUNT_SUSPENDED);
    }

    this.logger.debug(`User ${email} signed in successfully`);

    const { token, exp } = await this.usersService.generateRefreshToken(user);

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      lang: user.lang as Language,
      roles: user.roles as Role[],
      groups: user.groups as string[],
      refreshToken: token,
      refreshExp: exp,
    };
  }

  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    let decoded: JwtPayload;
    try {
      decoded = JwtPayloadSchema.parse(
        await this.jwtService.verifyAsync(refreshToken, {
          secret: this.config.get('JWT_REFRESH_SECRET'),
        }),
      );
    } catch (err) {
      if (err instanceof Error) {
        this.logger.error(`Verification error: ${err.message}`);
      }
      throw new UnauthorizedException();
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user) {
      this.logger.error(`Invalid refresh token for user ${decoded.email}`);
      throw new UnauthorizedException();
    }

    if (user.isSuspended) {
      this.logger.error(`Refresh token rejected: user ${decoded.email} account is suspended`);
      throw new UnauthorizedException();
    }

    await this.usersService.updateLastAccessed(decoded.sub);

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      roles: user.roles,
      groups: user.groups as string[],
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRATION,
      secret: this.config.get('JWT_SECRET'),
    });

    const expirationDate = new Date(Date.now() + ACCESS_TOKEN_EXPIRATION * 1000);
    this.logger.debug(`Refreshed access token for user ${user.email}`);

    return { token: accessToken, exp: expirationDate.getTime() };
  }

  async validateRegToken(email: string, token: string): Promise<void> {
    let decoded: RegTokenPayload;

    try {
      decoded = RegTokenSchema.parse(
        this.jwtService.verify(token, { secret: this.config.get('JWT_SECRET') }),
      );
    } catch (_) {
      this.logger.error('Invalid registration token');
      throw new UnauthorizedException();
    }
    if (decoded.email !== email) {
      this.logger.error("Email in token doesn't match provided email");
      throw new UnauthorizedException();
    }
  }
}
