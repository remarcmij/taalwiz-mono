import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { AdminSetPasswordDto } from './dto/admin-set-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ContactRequestDto } from './dto/contact-request.dto.js';
import { EmailLangDto } from './dto/email-lang.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { SetSuspendedDto } from './dto/set-suspended.dto.js';
import { UpdateLangDto } from './dto/update-lang.dto.js';
import type { Language } from './models/user.model.js';
import { UsersService } from './users.service.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles('admin')
  @Get()
  async getUsers() {
    const users = await this.usersService.getUsers();
    return users
      .filter((u) => u.email)
      .map((u) => ({ ...u, id: u._id.toString(), groups: u.groups ?? [] }));
  }

  @Roles('admin')
  @Patch(':id/groups')
  async updateUserGroups(@Param('id') id: string, @Body('groups') groups: string[]) {
    return await this.usersService.updateUserGroups(id, groups);
  }

  @Roles('admin')
  @Patch(':id/suspended')
  @HttpCode(204)
  async setUserSuspended(
    @Param('id') id: string,
    @Body() dto: SetSuspendedDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    if (id === currentUser.sub) {
      throw new ForbiddenException('Cannot suspend your own account');
    }
    await this.usersService.setUserSuspended(id, dto.isSuspended);
  }

  @Roles('admin')
  @Patch(':id/password')
  @HttpCode(204)
  async adminSetPassword(
    @Param('id') id: string,
    @Body() dto: AdminSetPasswordDto,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<void> {
    if (id === currentUser.sub) {
      throw new ForbiddenException('Use the change-password flow to update your own password');
    }
    await this.usersService.adminSetPassword(id, dto.newPassword);
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

  @Patch('me/lang')
  @HttpCode(204)
  async updateMyLang(
    @CurrentUser() currentUser: JwtPayload,
    @Body() dto: UpdateLangDto,
  ): Promise<void> {
    await this.usersService.updateUserLang(currentUser.sub, dto.lang as Language);
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
