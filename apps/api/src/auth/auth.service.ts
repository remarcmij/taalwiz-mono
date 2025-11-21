import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UsersService } from '../users/users.service.js';
import { UserDto } from './dto/user.dto.js';
import { seedUsers } from './seed/users.seed.js';
import { JwtPayload } from './types/jwtpayload.interface.js';

const REFRESH_TOKEN_EXPIRATION = 60 * 60 * 24 * 365; // 1 year
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
      for (const seedUser of plainToInstance(UserDto, seedUsers)) {
        const errors = await validate(seedUser);
        if (errors.length > 0) {
          this.logger.error(
            `Invalid seed user data: ${JSON.stringify(errors)}`,
          );
          continue;
        }
        const user = await this.usersService.findOne(seedUser.email);
        if (!user) {
          try {
            await this.usersService.createUser({
              name: seedUser.name,
              email: seedUser.email,
              password: bcrypt.hashSync(seedUser.password, 10),
              roles: seedUser.roles,
              lang: seedUser.lang,
            });
            this.logger.log(`Seeded user: ${seedUser.email}`);
          } catch (err) {
            this.logger.error(
              `Error seeding user ${seedUser.email}: ${(err as Error).message}`,
            );
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

    const payload: JwtPayload = {
      sub: user._id!.toString(),
      email: user.email,
      roles: user.roles,
    };

    const refreshToken = await this.jwtService.signAsync(payload, {
      expiresIn: REFRESH_TOKEN_EXPIRATION,
      secret: process.env.JWT_REFRESH_SECRET,
    });

    const expirationDate = new Date(
      Date.now() + REFRESH_TOKEN_EXPIRATION * 1000,
    );

    return {
      id: user._id!.toString(),
      email: user.email,
      name: user.name,
      lang: user.lang,
      roles: user.roles,
      refreshToken: refreshToken,
      refreshExp: expirationDate.getTime(),
    };
  }

  async refreshToken(refreshToken: string): Promise<any> {
    let decoded: JwtPayload;
    try {
      decoded = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (err) {
      this.logger.error(`Verification error: ${(err as Error).message}`);
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
      secret: process.env.JWT_SECRET,
    });

    const expirationDate = new Date(
      Date.now() + ACCESS_TOKEN_EXPIRATION * 1000,
    );
    this.logger.debug(`Refreshed access token for user ${user.email}`);

    return { token: accessToken, exp: expirationDate.getTime() };
  }
}
