export class User {
  constructor(
    public _id: string,
    public email: string,
    public name: string,
    public lang: string,
    public role: 'user' | 'admin' | 'demo' = 'user',
    public refreshToken: string,
    public refreshExp: number,
    public created?: Date,
    public lastAccessed?: Date,
  ) {}
}
