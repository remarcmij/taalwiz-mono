import type { SystemSettingsDoc } from '../models/system-settings.model.js';

export const settingsSeed: Omit<SystemSettingsDoc, '_id'>[] = [
  {
    name: 'custodian_name',
    label: 'Custodian Name',
    valueType: 'string',
    stringVal: 'Jim Cramer',
    sortIndex: 1,
  },
  {
    name: 'customer_service_email',
    label: 'Customer Service Email',
    valueType: 'string',
    stringVal: 'taalwiz@kpnmail.nl',
    sortIndex: 2,
  },
  {
    name: 'email_opt_out',
    label: 'Email Opt-out',
    valueType: 'boolean',
    booleanVal: false,
    sortIndex: 3,
  },
];
