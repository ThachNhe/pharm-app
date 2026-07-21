import httpStatus from 'http-status';
import catchAsync from '../utils/catchAsync.js';
import { adminService } from '../services/index.js';

const getContext = catchAsync(async (req, res) => {
  const result = await adminService.getAdminContext(req.user);
  res.send(result);
});

const getDashboard = catchAsync(async (req, res) => {
  const result = await adminService.getDashboard(req.user);
  res.send(result);
});

const getStores = catchAsync(async (req, res) => {
  const result = await adminService.queryStores(req.user, req.query);
  res.send(result);
});

const createStore = catchAsync(async (req, res) => {
  const result = await adminService.createStore(req.user, req.body);
  res.status(httpStatus.CREATED).send(result);
});

const updateStore = catchAsync(async (req, res) => {
  const result = await adminService.updateStore(req.user, req.params.storeId as string, req.body);
  res.send(result);
});

const getUsers = catchAsync(async (req, res) => {
  const result = await adminService.queryAdminUsers(req.user, req.query);
  res.send(result);
});

const createUser = catchAsync(async (req, res) => {
  const result = await adminService.createAdminUser(req.user, req.body);
  res.status(httpStatus.CREATED).send(result);
});

const updateUser = catchAsync(async (req, res) => {
  const result = await adminService.updateAdminUser(req.user, req.params.userId as string, req.body);
  res.send(result);
});

const resetPassword = catchAsync(async (req, res) => {
  const result = await adminService.resetUserPassword(req.user, req.params.userId as string, req.body);
  res.send(result);
});

const getMedicines = catchAsync(async (req, res) => {
  const result = await adminService.queryMedicines(req.query);
  res.send(result);
});

const createMedicine = catchAsync(async (req, res) => {
  const result = await adminService.createMedicine(req.user, req.body);
  res.status(httpStatus.CREATED).send(result);
});

const updateMedicine = catchAsync(async (req, res) => {
  const result = await adminService.updateMedicine(req.user, req.params.medicineId as string, req.body);
  res.send(result);
});

const getImportReceipts = catchAsync(async (req, res) => {
  const result = await adminService.queryImportReceipts(req.user, req.query);
  res.send(result);
});

const getSales = catchAsync(async (req, res) => {
  const result = await adminService.querySales(req.user, req.query);
  res.send(result);
});

const getProfitReport = catchAsync(async (req, res) => {
  const result = await adminService.getProfitReport(req.user, req.query);
  res.send(result);
});

export {
  createMedicine,
  createStore,
  createUser,
  getContext,
  getDashboard,
  getImportReceipts,
  getMedicines,
  getProfitReport,
  getSales,
  getStores,
  getUsers,
  resetPassword,
  updateMedicine,
  updateStore,
  updateUser,
};
