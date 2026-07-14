const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
  RESET_PASSWORD: 'resetPassword',
  VERIFY_EMAIL: 'verifyEmail',
} as const;

type TokenTypeValue = (typeof tokenTypes)[keyof typeof tokenTypes];

export { tokenTypes };
export type { TokenTypeValue };
