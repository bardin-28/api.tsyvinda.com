import { Router } from 'express';
import confirmEmailRouter from './confirm-email/confirm-email.routes';
import loginRouter from './login/login.routes';
import logoutRouter from './logout/logout.routes';
import meRouter from './me/me.routes';
import refreshRouter from './refresh/refresh.routes';
import registerRouter from './register/register.routes';

const router = Router();

router.use('/register', registerRouter);
router.use('/confirm-email', confirmEmailRouter);
router.use('/login', loginRouter);
router.use('/refresh', refreshRouter);
router.use('/logout', logoutRouter);
router.use('/me', meRouter);

export default router;
