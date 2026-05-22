import { Router } from 'express';
import createRouter from './routes/create';
import deleteRouter from './routes/delete';
import getRouter from './routes/get';
import listRouter from './routes/list';
import updateRouter from './routes/update';

const router = Router();

router.use('/', listRouter);
router.use('/', createRouter);
router.use('/', getRouter);
router.use('/', updateRouter);
router.use('/', deleteRouter);

export default router;
