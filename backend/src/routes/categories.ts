import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { validateBody } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../services/expenseCategoryService';
import {
  createCategorySchema,
  updateCategorySchema,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '../validation/categoryValidation';
import { ok } from '../types/api';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);

categoriesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(ok(await listCategories()));
  }),
);

categoriesRouter.post(
  '/',
  authorize(Role.FINANCE),
  validateBody(createCategorySchema),
  asyncHandler(async (req, res) => {
    res.status(201).json(ok(await createCategory(req.body as CreateCategoryInput)));
  }),
);

categoriesRouter.patch(
  '/:id',
  authorize(Role.FINANCE),
  validateBody(updateCategorySchema),
  asyncHandler(async (req, res) => {
    res.json(ok(await updateCategory(req.params.id, req.body as UpdateCategoryInput)));
  }),
);

categoriesRouter.delete(
  '/:id',
  authorize(Role.FINANCE),
  asyncHandler(async (req, res) => {
    await deleteCategory(req.params.id);
    res.json(ok({ id: req.params.id }));
  }),
);
