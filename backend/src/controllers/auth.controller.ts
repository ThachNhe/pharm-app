import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { authService, userService, tokenService, loginOtpService } from '../services/index.js';
import { clearRefreshTokenCookie, getRefreshTokenFromRequest, setRefreshTokenCookie } from '../utils/cookies.js';

const register = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  res.status(httpStatus.CREATED).send({
    user,
    message: 'Đăng ký thành công. Hãy đăng nhập và xác minh OTP để tiếp tục.',
  });
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

export { register, login, verifyLoginOtp, logout, refreshTokens };
