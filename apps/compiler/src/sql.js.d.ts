declare module 'sql.js' {
  export interface Database {
    run(sql: string, params?: any[]): any;
    exec(sql: string, params?: any[]): Array<{
      columns: string[];
      values: any[][];
    }>;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer) => Database;
  }

  function initSqlJs(config?: any): Promise<SqlJsStatic>;
  export default initSqlJs;
}
