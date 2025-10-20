import express from 'express';
import { userRoutes } from '../modules/user/user.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { ScheduleRoutes } from '../modules/schedule/schedule.route';
import { doctorScheduleRoutes } from '../modules/doctorSchedule/doctorSchedule.routes';
import { SpecialtiesRoutes } from '../modules/specialties/specialties.routes';
import { DoctorRoutes } from '../modules/dooctor/doctor.routes';


const router = express.Router();

const moduleRoutes = [
    {
        path: '/user',
        route: userRoutes
    },
    {
        path: '/doctor',
        route: DoctorRoutes
    },
    {
        path: '/auth',
        route: authRoutes
    },
    {
        path: '/schedule',
        route: ScheduleRoutes
    },
    {
        path: '/doctor-schedule',
        route: doctorScheduleRoutes
    },
    {
        path: '/specialties',
        route: SpecialtiesRoutes
    }
];

moduleRoutes.forEach(route => router.use(route.path, route.route))

export default router;