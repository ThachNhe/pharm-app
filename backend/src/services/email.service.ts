import nodemailer from 'nodemailer';
import config from '../config/config.js';
import logger from '../config/logger.js';

const transport = nodemailer.createTransport(config.email.smtp);
/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Connected to email server'))
    .catch(() => logger.warn('Unable to connect to email server. Make sure you have configured the SMTP options in .env'));
}

const sendLoginOtpEmail = async (to: string, code: string, expiresMinutes: number) => {
  const subject = 'Mã xác minh đăng nhập';
  const text = `Mã xác minh đăng nhập của bạn là: ${code}. Mã có hiệu lực trong ${expiresMinutes} phút.`;

  await transport.sendMail({ from: config.email.from, to, subject, text });
};

export { transport, sendLoginOtpEmail };
