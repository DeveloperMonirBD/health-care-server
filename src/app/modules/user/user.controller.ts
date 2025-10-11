import { Request, Response } from 'express';
import pick from '../../helper/pick';
import catchAsync from '../../shared/catchAsync';
import sendResponse from '../../shared/sendResponse';
import { userFilterableFields } from './user.constant';
import { UserService } from './user.service';

// crate patient
const createPatient = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createPatient(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: 'Patient created successfully!',
        data: result
    });
});


// create admin
const createAdmin = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createAdmin(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: 'Admin Created successfuly!',
        data: result
    });
});

// create doctor
const createDoctor = catchAsync(async (req: Request, res: Response) => {
    const result = await UserService.createDoctor(req);
    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: 'Doctor Created successfuly!',
        data: result
    });
});

// get all users
const getAllFromDB = catchAsync(async (req: Request, res: Response) => {

  
    const filters = pick(req.query, userFilterableFields);
    const options = pick(req.query, ['page', 'limit', 'sortBy', 'sortOrder'])

    const result = await UserService.getAllFromDB(filters, options);
    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'User retrieve successfully!',
        meta: result.meta,
        data: result.data
    });
});

export const UserController = {
    createPatient,
    createAdmin,
    createDoctor,
    getAllFromDB
};
