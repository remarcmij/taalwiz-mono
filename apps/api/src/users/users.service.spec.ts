import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import User from './models/user.model.js';
import { UsersService } from './users.service.js';

vi.mock('./models/user.model.js', () => ({
  default: {
    findByIdAndUpdate: vi.fn(),
  },
}));

describe('UsersService.updateUserLang', () => {
  let service: UsersService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: ConfigService, useValue: { get: vi.fn() } },
        { provide: JwtService, useValue: { sign: vi.fn(), verify: vi.fn() } },
        { provide: MailerService, useValue: { sendMail: vi.fn() } },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  it('updates the user lang when the user exists', async () => {
    vi.mocked(User.findByIdAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue({ _id: 'abc' }),
    } as never);

    await service.updateUserLang('abc', 'en');

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('abc', { lang: 'en' });
  });

  it('throws NotFoundException when the user does not exist', async () => {
    vi.mocked(User.findByIdAndUpdate).mockReturnValue({
      exec: vi.fn().mockResolvedValue(null),
    } as never);

    await expect(service.updateUserLang('missing', 'nl')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
