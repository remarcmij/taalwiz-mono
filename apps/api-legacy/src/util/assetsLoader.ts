import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const populateTemplate = (template: string, params: any) => {
  let result = template;

  Object.keys(params).forEach((key) => {
    result = result.replaceAll('{{' + key + '}}', params[key]);
  });

  return result;
};

const getTemplateDir = () => {
  if (process.env.NODE_ENV === 'production') {
    return path.join(__dirname, '../../dist/assets');
  }
  return path.join(__dirname, '../../src/assets');
};

export const loadAsset = async (filename: string, params?: any) => {
  const filePath = path.resolve(getTemplateDir(), filename);
  const data = await fs.readFile(filePath, 'utf8');
  if (filename.endsWith('.json')) {
    return JSON.parse(data);
  }
  if (filename.endsWith('.html')) {
    return populateTemplate(data, params);
  }
  return data;
};
