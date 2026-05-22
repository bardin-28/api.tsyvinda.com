import { Router } from 'express';
import confirmEmailRouter from './routes/confirm-email';
import loginRouter from './routes/login';
import logoutRouter from './routes/logout';
import meRouter from './routes/me';
import refreshRouter from './routes/refresh';
import registerRouter from './routes/register';

const router = Router();

router.use('/register', registerRouter);
router.use('/confirm-email', confirmEmailRouter);
router.use('/login', loginRouter);
router.use('/refresh', refreshRouter);
router.use('/logout', logoutRouter);
router.use('/me', meRouter);

export default router;
