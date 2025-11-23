import { Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
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
  @Post('invite/:email/:lang')
  async inviteNewUser(@Param('email') email: string, @Param('lang') lang: string) {
    return await this.usersService.inviteNewUser(email, lang);
  }
}
