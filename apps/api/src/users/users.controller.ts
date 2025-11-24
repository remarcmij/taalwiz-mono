import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RegisterDto } from '../auth/dto/register.dt.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ContactRequestDto } from './dto/contact-request.dto.js';
import { EmailLangDto } from './dto/email-lang.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin')
  @Get()
  async getUsers() {
    return await this.usersService.getUsers();
  }

  @Roles('admin')
  @Delete(':id')
  async deleteUserById(@Param('id') id: string) {
    const deletedUser = await this.usersService.deleteUserById(id);
    if (!deletedUser) {
      throw new NotFoundException('User not found');
    }
  }

  @Roles('admin')
  @Post('invite')
  async inviteNewUser(@Body() emailLangDto: EmailLangDto) {
    return await this.usersService.inviteNewUser(emailLangDto.email, emailLangDto.lang);
  }

  @Public()
  @Post('request-password-reset')
  async requestPasswordReset(@Body('email') email: string) {
    return await this.usersService.requestPasswordReset(email);
  }

  @Post('register')
  @Public()
  async registerNewUser(@Body() registerDto: RegisterDto) {
    return await this.usersService.registerNewUser(
      registerDto.email,
      registerDto.password,
      registerDto.name,
      registerDto.token,
    );
  }

  @Post('change-password')
  @HttpCode(204)
  async changePassword(@Body() changePasswordDto: ChangePasswordDto) {
    return await this.usersService.changePassword(
      changePasswordDto.email,
      changePasswordDto.password,
      changePasswordDto.newPassword,
    );
  }

  @Post('reset-password')
  @Public()
  @HttpCode(204)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return await this.usersService.resetPassword(
      resetPasswordDto.newPassword,
      resetPasswordDto.token,
    );
  }

  @Post('contact')
  async contactRequest(@Body() contactRequestDto: ContactRequestDto) {
    return await this.usersService.contactRequest(
      contactRequestDto.email,
      contactRequestDto.message,
    );
  }
}
