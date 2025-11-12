import { model, Schema } from 'mongoose';

export type ValueType = 'string' | 'number' | 'date' | 'boolean';

export interface ISetting {
  _id?: any;
  name: string;
  label: string;
  valueType: ValueType;
  sortOrder: number;
  stringVal?: string;
  numberVal?: number;
  dateVal?: Date;
  booleanVal?: boolean;
}

const SettingsSchema = new Schema<ISetting>({
  name: { type: String, required: true, index: true },
  label: { type: String, required: true },
  valueType: { type: String, required: true },
  sortOrder: { type: Number, default: 0 },
  stringVal: String,
  numberVal: Number,
  dateVal: Date,
  booleanVal: Boolean,
});

const Settings = model<ISetting>('Settings', SettingsSchema);
export default Settings;
