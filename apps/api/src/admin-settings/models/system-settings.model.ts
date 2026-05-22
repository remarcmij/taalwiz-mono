import { InferSchemaType, model, Schema, Types } from 'mongoose';

const SystemSettingsSchema = new Schema({
  name: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  valueType: { type: String, required: true, enum: ['string', 'number', 'date', 'boolean'] },
  stringVal: { type: String },
  numberVal: { type: Number },
  dateVal: { type: Date },
  booleanVal: { type: Boolean },
  sortIndex: { type: Number, default: 0 },
});

export type SystemSettingsDoc = InferSchemaType<typeof SystemSettingsSchema> & {
  _id?: Types.ObjectId;
};

const SystemSettings = model('SystemSettings', SystemSettingsSchema);
export default SystemSettings;
