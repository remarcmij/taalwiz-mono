export type ValueType = 'string' | 'number' | 'date' | 'boolean';

export interface ISystemSettings {
  _id: string;
  name: string;
  label: string;
  valueType: ValueType;
  stringVal?: string;
  numberVal?: number;
  dateVal?: Date;
  booleanVal?: boolean;
  sortIndex: number;
}
