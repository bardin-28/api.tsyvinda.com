import { Router } from 'express';
import confirmEmailRouter from './routes/confirm-email';
import forgotPasswordRouter from './routes/forgot-password';
import loginRouter from './routes/login';
import logoutRouter from './routes/logout';
import refreshRouter from './routes/refresh';
import registerRouter from './routes/register';
import resetPasswordRouter from './routes/reset-password';

const router = Router();

router.use('/register', registerRouter);
router.use('/confirm-email', confirmEmailRouter);
router.use('/forgot-password', forgotPasswordRouter);
router.use('/reset-password', resetPasswordRouter);
router.use('/login', loginRouter);
router.use('/refresh', refreshRouter);
router.use('/logout', logoutRouter);

export default router;
