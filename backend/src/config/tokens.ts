const tokenTypes = {
  ACCESS: 'access',
  REFRESH: 'refresh',
} as const;

type TokenTypeValue = (typeof tokenTypes)[keyof typeof tokenTypes];

export { tokenTypes };
export type { TokenTypeValue };
