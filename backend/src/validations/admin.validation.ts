import Joi from 'joi';
import { objectId, password } from './custom.validation.js';

const pagination = {
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
};

const storeRole = Joi.string().valid('owner', 'manager', 'staff');

const medicineUnit = Joi.object().keys({
  name: Joi.string().required().max(50),
  conversionRate: Joi.number().positive().required(),
  isBaseUnit: Joi.boolean().required(),
});

const getContext = {};
const getDashboard = {};

const getStores = {
  query: Joi.object().keys({
    search: Joi.string().allow(''),
    ...pagination,
  }),
};

const createStore = {
  body: Joi.object().keys({
    name: Joi.string().required().max(255),
    address: Joi.string().allow('', null),
    phone: Joi.string().allow('', null).max(20),
    owner: Joi.object()
      .keys({
        name: Joi.string().required().max(255),
        phone: Joi.string().allow('', null).max(20),
        email: Joi.string().required().email().max(255),
        password: Joi.string().required().custom(password),
      })
      .optional(),
  }),
};

const updateStore = {
  params: Joi.object().keys({
    storeId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      name: Joi.string().max(255),
      address: Joi.string().allow('', null),
      phone: Joi.string().allow('', null).max(20),
      isActive: Joi.boolean(),
    })
    .min(1),
};

const getUsers = {
  query: Joi.object().keys({
    storeId: Joi.string().custom(objectId),
    search: Joi.string().allow(''),
    ...pagination,
  }),
};

const createUser = {
  body: Joi.object().keys({
    storeId: Joi.string().required().custom(objectId),
    storeRole: storeRole.required(),
    name: Joi.string().required().max(255),
    phone: Joi.string().allow('', null).max(20),
    email: Joi.string().required().email().max(255),
    password: Joi.string().required().custom(password),
  }),
};

const updateUser = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      storeId: Joi.string().custom(objectId),
      storeRole,
      name: Joi.string().max(255),
      phone: Joi.string().allow('', null).max(20),
      email: Joi.string().email().max(255),
      password: Joi.string().custom(password),
      isActive: Joi.boolean(),
    })
    .min(1),
};

const resetPassword = {
  params: Joi.object().keys({
    userId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object().keys({
    storeId: Joi.string().required().custom(objectId),
    password: Joi.string().required().custom(password),
  }),
};

const getMedicines = {
  query: Joi.object().keys({
    search: Joi.string().allow(''),
    ...pagination,
  }),
};

const createMedicine = {
  body: Joi.object().keys({
    name: Joi.string().required().max(255),
    baseUnitName: Joi.string().required().max(50),
    barcode: Joi.string().allow('', null).max(100),
    registrationNumber: Joi.string().allow('', null).max(100),
    category: Joi.string().allow('', null).max(100),
    activeIngredient: Joi.string().allow('', null).max(255),
    strength: Joi.string().allow('', null).max(100),
    dosageForm: Joi.string().allow('', null).max(100),
    manufacturer: Joi.string().allow('', null).max(255),
    requiresPrescription: Joi.boolean(),
    description: Joi.string().allow('', null),
    units: Joi.array().items(medicineUnit).min(1),
  }),
};

const updateMedicine = {
  params: Joi.object().keys({
    medicineId: Joi.string().required().custom(objectId),
  }),
  body: createMedicine.body.keys({
    isActive: Joi.boolean(),
  }),
};

const getReceipts = {
  query: Joi.object().keys({
    storeId: Joi.string().custom(objectId),
    from: Joi.date().iso(),
    to: Joi.date().iso(),
    ...pagination,
  }),
};

const getSales = getReceipts;

const getProfitReport = {
  query: Joi.object().keys({
    storeId: Joi.string().custom(objectId),
    from: Joi.date().iso(),
    to: Joi.date().iso(),
  }),
};

export {
  createMedicine,
  createStore,
  createUser,
  getContext,
  getDashboard,
  getMedicines,
  getProfitReport,
  getReceipts,
  getSales,
  getStores,
  getUsers,
  resetPassword,
  updateMedicine,
  updateStore,
  updateUser,
};
