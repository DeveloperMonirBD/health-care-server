import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import cron from 'node-cron';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import notFound from './app/middlewares/notFound';
import { PaymentController } from './app/modules/payment/payment.controller';
import router from './app/routes';
import config from './config';
import { AppointmentService } from './app/modules/appointment/appointment.service';

const app: Application = express();

app.post('/webhook', express.raw({ type: 'application/json' }), PaymentController.handleStripeWebhookEvent);

app.use(
    cors({
        origin: 'http://localhost:3000',
        credentials: true
    })
);

//parser
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

cron.schedule('* * * * *', () => {
    try {
        console.log("Node Crown called at", new Date())
        AppointmentService.cancelUnpaidAppointments();
    } catch (error) {
        console.error(error)
    }
});

app.use('/api/v1', router);

app.get('/', (req: Request, res: Response) => {
    res.send({
        message: 'Server is running..',
        environment: config.node_env,
        uptime: process.uptime().toFixed(2) + ' sec',
        timeStamp: new Date().toISOString()
    });
});

app.use(globalErrorHandler);

app.use(notFound);

export default app;
