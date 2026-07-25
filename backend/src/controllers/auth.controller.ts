import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { authService, userService, tokenService, emailService, loginOtpService } from '../services/index.js';
import { clearRefreshTokenCookie, getRefreshTokenFromRequest, setRefreshTokenCookie } from '../utils/cookies.js';

const register = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  const tokens = await tokenService.generateAuthTokens(user);
  setRefreshTokenCookie(res, tokens.refresh.token, tokens.refresh.expires);
  res.status(httpStatus.CREATED).send({ user, tokens: { access: tokens.access } });
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const challenge = await authService.loginUserWithEmailAndPassword(email, password);
  res.send(challenge);
});

const verifyLoginOtp = catchAsync(async (req, res) => {
  const { challengeId, code } = req.body;
  const user = await loginOtpService.verifyLoginOtp(challengeId, code);
  const tokens = await tokenService.generateAuthTokens(user);
  setRefreshTokenCookie(res, tokens.refresh.token, tokens.refresh.expires);
  res.send({ user, tokens: { access: tokens.access } });
});

const logout = catchAsync(async (req, res) => {
  await authService.logout(getRefreshTokenFromRequest(req));
  clearRefreshTokenCookie(res);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const result = await authService.refreshAuth(getRefreshTokenFromRequest(req));
  res.send({ user: result.user, tokens: { access: result.tokens.access } });
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetPasswordToken = await tokenService.generateResetPasswordToken(req.body.email);
  await emailService.sendResetPasswordEmail(req.body.email, resetPasswordToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authService.resetPassword(req.query.token as string, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const sendVerificationEmail = catchAsync(async (req, res) => {
  const verifyEmailToken = await tokenService.generateVerifyEmailToken(req.user);
  await emailService.sendVerificationEmail(req.user.email, verifyEmailToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const verifyEmail = catchAsync(async (req, res) => {
  await authService.verifyEmail(req.query.token as string);
  res.status(httpStatus.NO_CONTENT).send();
});

export {
  register,
  login,
  verifyLoginOtp,
  logout,
  refreshTokens,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
};
