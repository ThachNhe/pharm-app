import Joi from 'joi';
import { password } from './custom.validation.js';

const register = {
  body: Joi.object().keys({
    email: Joi.string().required().email(),
    password: Joi.string().required().custom(password),
    name: Joi.string().required(),
  }),
};

const login = {
  body: Joi.object().keys({
    email: Joi.string().required(),
    password: Joi.string().required(),
  }),
};

const verifyLoginOtp = {
  body: Joi.object().keys({
    challengeId: Joi.string().guid({ version: 'uuidv4' }).required(),
    code: Joi.string()
      .pattern(/^\d{6}$/)
      .required(),
  }),
};

const logout = {
  body: Joi.object().max(0),
};

const refreshTokens = {
  body: Joi.object().max(0),
};

export { register, login, verifyLoginOtp, logout, refreshTokens };
