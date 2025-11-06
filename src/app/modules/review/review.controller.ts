import httpStatus from 'http-status';
import { Request, Response } from "express";
import catchAsync from "../../shared/catchAsync";
import { IJWTPayload } from '../../types/common';
import sendResponse from '../../shared/sendResponse';
import { ReviewService } from './review.service';

const insertIntoDB = catchAsync(async (req: Request & {user?: IJWTPayload}, res: Response) => {
    const user = req.user;
    const result = await ReviewService.insertIntoDB(user, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: 'Review created successfully',
        data: result
    })
});

export const ReviewController = {
    insertIntoDB
};