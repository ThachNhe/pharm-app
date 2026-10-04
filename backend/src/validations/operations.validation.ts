import Joi from 'joi';
import { objectId } from './custom.validation.js';

const pagination = {
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(100),
};

const storeParams = {
  storeId: Joi.string().required().custom(objectId),
};

const dateQuery = {
  from: Joi.date().iso(),
  to: Joi.date().iso().min(Joi.ref('from')),
};

const getContext = {};

const getDashboard = {
  params: Joi.object().keys(storeParams),
};

const getSuppliers = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    search: Joi.string().allow('').max(255),
    ...pagination,
  }),
};

const supplierBody = {
  code: Joi.string().allow('', null).max(50),
  name: Joi.string().trim().required().max(255),
  phone: Joi.string().allow('', null).max(20),
  email: Joi.string().allow('', null).email().max(255),
  address: Joi.string().allow('', null).max(1000),
  taxCode: Joi.string().allow('', null).max(50),
  isActive: Joi.boolean(),
};

const createSupplier = {
  params: Joi.object().keys(storeParams),
  body: Joi.object().keys(supplierBody),
};

const updateSupplier = {
  params: Joi.object().keys({
    ...storeParams,
    supplierId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      ...supplierBody,
      name: Joi.string().trim().max(255),
    })
    .min(1),
};

const getProductCategories = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    search: Joi.string().trim().allow('').max(100),
    active: Joi.boolean(),
    ...pagination,
  }),
};

const productCategoryBody = {
  name: Joi.string().trim().required().max(100),
  description: Joi.string().allow('', null).max(1000),
  isActive: Joi.boolean(),
};

const createProductCategory = {
  params: Joi.object().keys(storeParams),
  body: Joi.object().keys(productCategoryBody),
};

const updateProductCategory = {
  params: Joi.object().keys({
    ...storeParams,
    categoryId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      ...productCategoryBody,
      name: Joi.string().trim().max(100),
    })
    .min(1),
};

const getMedicines = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    search: Joi.string().allow('').max(255),
    alert: Joi.string().valid('low', 'expiring'),
    active: Joi.boolean(),
    ...pagination,
  }),
};

const getReferenceProducts = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    search: Joi.string().trim().allow('').max(255),
    ...pagination,
  }),
};

const medicineUnit = Joi.object().keys({
  name: Joi.string().trim().required().max(50),
  conversionRate: Joi.number().integer().positive().required(),
  isBaseUnit: Joi.boolean().required(),
});

const medicineBody = {
  categoryId: Joi.string().required().custom(objectId),
  code: Joi.string().trim().required().max(50),
  positionName: Joi.string().allow('', null).max(255),
  name: Joi.string().trim().required().max(255),
  baseUnitName: Joi.string().trim().required().max(50),
  barcode: Joi.string().allow('', null).max(100),
  secondaryBarcode: Joi.string().allow('', null).max(100),
  registrationNumber: Joi.string().allow('', null).max(100),
  category: Joi.string().allow('', null).max(100),
  activeIngredient: Joi.string().allow('', null).max(255),
  strength: Joi.string().allow('', null).max(100),
  dosageForm: Joi.string().allow('', null).max(100),
  manufacturer: Joi.string().allow('', null).max(255),
  countryOfOrigin: Joi.string().allow('', null).max(100),
  importerName: Joi.string().allow('', null).max(255),
  specification: Joi.string().allow('', null).max(2000),
  usageInstructions: Joi.string().allow('', null).max(2000),
  requiresPrescription: Joi.boolean(),
  description: Joi.string().allow('', null).max(2000),
  sellingPrice: Joi.number().min(0).required(),
  minStock: Joi.number().min(0),
  isActive: Joi.boolean(),
  units: Joi.array().items(medicineUnit).min(1).max(10),
};

const createMedicine = {
  params: Joi.object().keys(storeParams),
  body: Joi.object().keys({
    ...medicineBody,
    code: Joi.string().trim().max(50),
    referenceProductId: Joi.string().allow(null).custom(objectId),
    initialImport: Joi.object().keys({
      quantity: Joi.number().positive().precision(2).required(),
      importPrice: Joi.number().min(0).required(),
      batchNumber: Joi.string().trim().required().max(100),
      expiryDate: Joi.date().iso().required(),
    }),
  }),
};

const generateMedicineCode = {
  params: Joi.object().keys(storeParams),
};

const updateMedicine = {
  params: Joi.object().keys({
    ...storeParams,
    medicineId: Joi.string().required().custom(objectId),
  }),
  body: Joi.object()
    .keys({
      ...medicineBody,
      name: Joi.string().trim().max(255),
      baseUnitName: Joi.string().trim().max(50),
      categoryId: Joi.string().custom(objectId),
      code: Joi.string().trim().min(1).max(50),
      sellingPrice: Joi.number().min(0),
    })
    .min(1),
};

const importItem = Joi.object().keys({
  medicineId: Joi.string().required().custom(objectId),
  batchNumber: Joi.string().trim().required().max(100),
  quantity: Joi.number().positive().required(),
  importPrice: Joi.number().min(0).required(),
  expiryDate: Joi.date().iso().required(),
  unitId: Joi.string().custom(objectId),
});

const getImportReceipts = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    status: Joi.string().valid('draft', 'completed', 'cancelled'),
    ...dateQuery,
    ...pagination,
  }),
};

const createImportReceipt = {
  params: Joi.object().keys(storeParams),
  body: Joi.object().keys({
    supplierId: Joi.string().allow(null).custom(objectId),
    importedAt: Joi.date().iso(),
    note: Joi.string().allow('', null).max(2000),
    items: Joi.array().items(importItem).min(1).max(100).required(),
  }),
};

const receiptParams = {
  params: Joi.object().keys({
    ...storeParams,
    receiptId: Joi.string().required().custom(objectId),
  }),
};

const getInventory = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    search: Joi.string().allow('').max(255),
    alert: Joi.string().valid('low', 'expiring'),
    ...pagination,
  }),
};

const getInventoryMovements = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    ...dateQuery,
    ...pagination,
  }),
};

const getSales = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys({
    ...dateQuery,
    ...pagination,
  }),
};

const saleItem = Joi.object().keys({
  medicineId: Joi.string().required().custom(objectId),
  quantity: Joi.number().positive().required(),
  unitId: Joi.string().custom(objectId),
});

const createSale = {
  params: Joi.object().keys(storeParams),
  body: Joi.object().keys({
    paymentMethod: Joi.string().valid('cash', 'bank_transfer', 'card', 'e_wallet', 'other').required(),
    discountAmount: Joi.number().min(0),
    note: Joi.string().allow('', null).max(2000),
    items: Joi.array().items(saleItem).min(1).max(100).required(),
  }),
};

const saleParams = {
  params: Joi.object().keys({
    ...storeParams,
    saleId: Joi.string().required().custom(objectId),
  }),
};

const getProfitReport = {
  params: Joi.object().keys(storeParams),
  query: Joi.object().keys(dateQuery),
};

export {
  createImportReceipt,
  createMedicine,
  createProductCategory,
  createSale,
  createSupplier,
  getContext,
  getDashboard,
  getImportReceipts,
  getInventory,
  getInventoryMovements,
  getMedicines,
  generateMedicineCode,
  getProductCategories,
  getProfitReport,
  getReferenceProducts,
  getSales,
  getSuppliers,
  receiptParams,
  saleParams,
  updateMedicine,
  updateProductCategory,
  updateSupplier,
};
