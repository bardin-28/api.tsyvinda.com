import type { Request, Response } from 'express';
import { authService } from '../auth.service';
import type { RegisterBody } from './register.schema';

export async function registerController(req: Request, res: Response): Promise<void> {
  const body = req.body as RegisterBody;
  await authService.register({
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    password: body.password,
  });
  res.status(201).json({ message: 'Verification email sent. Please check your inbox.' });
}
