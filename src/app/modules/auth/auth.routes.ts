import express from 'express';
import { AuthController } from './auth.controler';

const router = express.Router();

router.post(
    '/login',
    AuthController.login
);

export const authRoutes = router;
