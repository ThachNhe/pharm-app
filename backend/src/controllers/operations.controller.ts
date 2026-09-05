import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import * as operationsService from '../services/operations.service.js';

const param = (req, key: string) => String(req.params[key]);

const getContext = catchAsync(async (req, res) => {
  res.send(await operationsService.getContext(req.user));
});

const getDashboard = catchAsync(async (req, res) => {
  res.send(await operationsService.getDashboard(req.user, param(req, 'storeId')));
});

const getSuppliers = catchAsync(async (req, res) => {
  res.send(await operationsService.querySuppliers(req.user, param(req, 'storeId'), req.query));
});

const createSupplier = catchAsync(async (req, res) => {
  const result = await operationsService.createSupplier(req.user, param(req, 'storeId'), req.body);
  res.status(httpStatus.CREATED).send(result);
});

const updateSupplier = catchAsync(async (req, res) => {
  res.send(await operationsService.updateSupplier(req.user, param(req, 'storeId'), param(req, 'supplierId'), req.body));
});

const getProductCategories = catchAsync(async (req, res) => {
  res.send(await operationsService.queryProductCategories(req.user, param(req, 'storeId'), req.query));
});

const createProductCategory = catchAsync(async (req, res) => {
  const result = await operationsService.createProductCategory(req.user, param(req, 'storeId'), req.body);
  res.status(httpStatus.CREATED).send(result);
});

const updateProductCategory = catchAsync(async (req, res) => {
  res.send(
    await operationsService.updateProductCategory(req.user, param(req, 'storeId'), param(req, 'categoryId'), req.body),
  );
});

const getMedicines = catchAsync(async (req, res) => {
  res.send(await operationsService.queryMedicines(req.user, param(req, 'storeId'), req.query));
});

const generateMedicineCode = catchAsync(async (req, res) => {
  res.send(await operationsService.generateMedicineCode(req.user, param(req, 'storeId')));
});

const getReferenceProducts = catchAsync(async (req, res) => {
  res.send(await operationsService.queryReferenceProducts(req.user, param(req, 'storeId'), req.query));
});

const createMedicine = catchAsync(async (req, res) => {
  const result = await operationsService.createMedicine(req.user, param(req, 'storeId'), req.body);
  res.status(httpStatus.CREATED).send(result);
});

const updateMedicine = catchAsync(async (req, res) => {
  res.send(await operationsService.updateMedicine(req.user, param(req, 'storeId'), param(req, 'medicineId'), req.body));
});

const getImportReceipts = catchAsync(async (req, res) => {
  res.send(await operationsService.queryImportReceipts(req.user, param(req, 'storeId'), req.query));
});

const getImportReceipt = catchAsync(async (req, res) => {
  res.send(await operationsService.getImportReceipt(req.user, param(req, 'storeId'), param(req, 'receiptId')));
});

const createImportReceipt = catchAsync(async (req, res) => {
  const result = await operationsService.createImportReceipt(req.user, param(req, 'storeId'), req.body);
  res.status(httpStatus.CREATED).send(result);
});

const completeImportReceipt = catchAsync(async (req, res) => {
  res.send(await operationsService.completeImportReceipt(req.user, param(req, 'storeId'), param(req, 'receiptId')));
});

const cancelImportReceipt = catchAsync(async (req, res) => {
  res.send(await operationsService.cancelImportReceipt(req.user, param(req, 'storeId'), param(req, 'receiptId')));
});

const getInventory = catchAsync(async (req, res) => {
  res.send(await operationsService.queryInventory(req.user, param(req, 'storeId'), req.query));
});

const getInventoryMovements = catchAsync(async (req, res) => {
  res.send(await operationsService.queryInventoryMovements(req.user, param(req, 'storeId'), req.query));
});

const getSales = catchAsync(async (req, res) => {
  res.send(await operationsService.querySales(req.user, param(req, 'storeId'), req.query));
});

const getSale = catchAsync(async (req, res) => {
  res.send(await operationsService.getSale(req.user, param(req, 'storeId'), param(req, 'saleId')));
});

const createSale = catchAsync(async (req, res) => {
  const result = await operationsService.createSale(req.user, param(req, 'storeId'), req.body);
  res.status(httpStatus.CREATED).send(result);
});

const getProfitReport = catchAsync(async (req, res) => {
  res.send(await operationsService.getProfitReport(req.user, param(req, 'storeId'), req.query));
});

export {
  cancelImportReceipt,
  completeImportReceipt,
  createImportReceipt,
  createMedicine,
  createProductCategory,
  createSale,
  createSupplier,
  getContext,
  getDashboard,
  getImportReceipt,
  getImportReceipts,
  getInventory,
  getInventoryMovements,
  getMedicines,
  generateMedicineCode,
  getProductCategories,
  getProfitReport,
  getReferenceProducts,
  getSale,
  getSales,
  getSuppliers,
  updateMedicine,
  updateProductCategory,
  updateSupplier,
};
