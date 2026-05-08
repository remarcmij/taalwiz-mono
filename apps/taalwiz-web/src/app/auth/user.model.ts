export type Role = 'user' | 'admin' | 'demo';
export class User {
  constructor(
    public id: string,
    public email: string,
    public name: string,
    public lang: string,
    public roles: Role[] = ['user'],
    public refreshToken: string,
    public refreshExp: number,
    public created?: Date,
    public lastAccessed?: Date
  ) {}
}
