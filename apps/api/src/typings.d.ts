type roleType = 'admin' | 'user' | 'demo';

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Express {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  export interface User {
    _id?: any;
    email: string;
    role: roleType;
  }
}
