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

/**
 * Send an email
 * @param {string} to
 * @param {string} subject
 * @param {string} text
 * @returns {Promise}
 */
const sendEmail = async (to: string, subject: string, text: string) => {
  const msg = { from: config.email.from, to, subject, text };
  await transport.sendMail(msg);
};

/**
 * Send reset password email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendResetPasswordEmail = async (to: string, token: string) => {
  const subject = 'Reset password';
  const resetPasswordUrl = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const text = `Dear user,
To reset your password, click on this link: ${resetPasswordUrl}
If you did not request any password resets, then ignore this email.`;
  await sendEmail(to, subject, text);
};

const sendStaffInvitationEmail = async ({
  to,
  name,
  storeName,
  role,
  token,
}: {
  to: string;
  name: string;
  storeName: string;
  role: string;
  token: string;
}) => {
  const subject = 'Set up your Pharm App account';
  const setupPasswordUrl = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const text = `Xin chao ${name},

Tai khoan Pharm App cua ban da duoc tao cho quay "${storeName}" voi vai tro ${role}.

Vui long thiet lap mat khau tai lien ket sau: ${setupPasswordUrl}

Lien ket nay se het han sau ${config.jwt.resetPasswordExpirationMinutes} phut. Neu ban khong mong doi email nay, vui long bo qua.`;
  await sendEmail(to, subject, text);
};

/**
 * Send verification email
 * @param {string} to
 * @param {string} token
 * @returns {Promise}
 */
const sendVerificationEmail = async (to: string, token: string) => {
  const subject = 'Email Verification';
  // replace this url with the link to the email verification page of your front-end app
  const verificationEmailUrl = `http://link-to-app/verify-email?token=${token}`;
  const text = `Dear user,
To verify your email, click on this link: ${verificationEmailUrl}
If you did not create an account, then ignore this email.`;
  await sendEmail(to, subject, text);
};

export { transport, sendEmail, sendResetPasswordEmail, sendStaffInvitationEmail, sendVerificationEmail };
