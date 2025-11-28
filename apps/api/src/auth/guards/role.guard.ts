import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, UserDoc } from '../../users/models/user.model.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    // const { user } = context.switchToHttp().getRequest<Request>();
    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'] as UserDoc;

    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
