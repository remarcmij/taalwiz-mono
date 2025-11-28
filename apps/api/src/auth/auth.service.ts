import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsersService } from '../users/users.service.js';
import { EnvDto } from '../util/env.dto.js';
import { UserSeedDto } from './dto/user-seed.dto.js';
import { seedUsers } from './seed/users.seed.js';
import { JwtPayload } from './types/jwtpayload.interface.js';

const env = EnvDto.getInstance();

// const ACCESS_TOKEN_EXPIRATION = 60 * 60; // 1 hour
// TODO revert to 1 hour expiration after testing
const ACCESS_TOKEN_EXPIRATION = 60 * 60 * 24; // 1 day

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {
    void (async () => {
      for (const seedUser of plainToInstance(UserSeedDto, seedUsers)) {
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
    })();
  }

  async signIn(email: string, password: string): Promise<any> {
    const user = await this.usersService.findOne(email);

    if (!user) {
      this.logger.error(`User ${email} not found`);
      throw new UnauthorizedException();
    }

    if (!(await bcrypt.compare(password, user.password))) {
      this.logger.error(`Invalid password for user ${email}`);
      throw new UnauthorizedException();
    }

    this.logger.debug(`User ${email} signed in successfully`);

    const { token, exp } = await this.usersService.generateRefreshToken(user);

    return {
      id: user._id!.toString(),
      email: user.email,
      name: user.name,
      lang: user.lang,
      roles: user.roles,
      refreshToken: token,
      refreshExp: exp,
    };
  }

  async refreshToken(refreshToken: string): Promise<any> {
    let decoded: JwtPayload;
    try {
      decoded = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: env.jwtRefreshSecret,
      });
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

    await this.usersService.updateLastAccessed(decoded.sub);

    const payload: JwtPayload = {
      sub: user._id!.toString(),
      email: user.email,
      roles: user.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRATION,
      secret: env.jwtSecret,
    });

    const expirationDate = new Date(Date.now() + ACCESS_TOKEN_EXPIRATION * 1000);
    this.logger.debug(`Refreshed access token for user ${user.email}`);

    return { token: accessToken, exp: expirationDate.getTime() };
  }

  async validateRegToken(email: string, token: string): Promise<void> {
    let decoded: JwtPayload;

    try {
      decoded = this.jwtService.verify<JwtPayload>(token, { secret: env.jwtSecret });
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
