import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';

assert(process.env.SMTP_HOST, 'SMTP_HOST not set');
assert(process.env.SMTP_PORT, 'SMTP_PORT not set');
assert(process.env.SMTP_USER, 'SMTP_USER not set');
assert(process.env.SMTP_PASSWORD, 'SMTP_PASSWORD not set');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: +process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

export default transporter;
