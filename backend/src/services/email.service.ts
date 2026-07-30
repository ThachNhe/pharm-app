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
  const subject = 'Thiết lập tài khoản Pharm App';
  const setupPasswordUrl = `${config.frontendUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const text = `Xin chào ${name},

Tài khoản Pharm App của bạn đã được tạo cho quầy "${storeName}" với vai trò ${role}.

Vui lòng thiết lập mật khẩu tại liên kết sau: ${setupPasswordUrl}

Liên kết này sẽ hết hạn sau ${config.jwt.resetPasswordExpirationMinutes} phút. Nếu bạn không mong đợi email này, vui lòng bỏ qua.`;
  await sendEmail(to, subject, text);
};

const sendStoreAssignmentEmail = async ({
  to,
  name,
  storeName,
  role,
}: {
  to: string;
  name: string;
  storeName: string;
  role: string;
}) => {
  const subject = 'Bạn đã được thêm vào một quầy thuốc';
  const loginUrl = `${config.frontendUrl}/login`;
  const text = `Xin chào ${name},

Tài khoản Pharm App hiện tại của bạn đã được thêm vào quầy "${storeName}" với vai trò ${role}.

Bạn có thể đăng nhập bằng mật khẩu hiện tại tại: ${loginUrl}

Nếu bạn không mong đợi email này, vui lòng liên hệ quản trị hệ thống.`;
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

const sendLoginOtpEmail = async (to: string, code: string, expiresMinutes: number) => {
  const subject = 'Mã xác minh đăng nhập';
  const text = `Mã xác minh đăng nhập của bạn là: ${code}. Mã có hiệu lực trong ${expiresMinutes} phút.`;

  await transport.sendMail({ from: config.email.from, to, subject, text });
};

export {
  transport,
  sendEmail,
  sendResetPasswordEmail,
  sendStaffInvitationEmail,
  sendStoreAssignmentEmail,
  sendVerificationEmail,
  sendLoginOtpEmail,
};
