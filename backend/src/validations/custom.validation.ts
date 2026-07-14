import type { CustomHelpers } from 'joi';

const objectId = (value: string, helpers: CustomHelpers) => {
  // UUID v4 validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(value)) {
    return (helpers.message as any)('"{{#label}}" must be a valid UUID');
  }
  return value;
};

const password = (value: string, helpers: CustomHelpers) => {
  if (value.length < 8) {
    return (helpers.message as any)('password must be at least 8 characters');
  }
  if (!value.match(/\d/) || !value.match(/[a-zA-Z]/)) {
    return (helpers.message as any)('password must contain at least 1 letter and 1 number');
  }
  return value;
};

export { objectId, password };
