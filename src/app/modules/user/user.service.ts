import { Admin, Doctor, Prisma, UserRole, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { Request } from 'express';
import { fileUploader } from '../../helper/fileUploder';
import { paginationHelper } from '../../helper/paginationHelper';
import { prisma } from '../../shared/prisma';
import { IJWTPayload } from '../../types/common';
import { userSearchableFields } from './user.constant';

// create Patient
const createPatient = async (req: Request) => {
    // // Enhanced password validation
    // const validatePassword = (password: string) => {
    //     const minLength = 8;
    //     const hasUpperCase = /[A-Z]/.test(password);
    //     const hasLowerCase = /[a-z]/.test(password);
    //     const hasNumbers = /\d/.test(password);
    //     const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    //     if (password.length < minLength) {
    //         throw new Error(`Password must be at least ${minLength} characters long`);
    //     }
    //     if (!hasUpperCase) {
    //         throw new Error('Password must contain at least one uppercase letter');
    //     }
    //     if (!hasLowerCase) {
    //         throw new Error('Password must contain at least one lowercase letter');
    //     }
    //     if (!hasNumbers) {
    //         throw new Error('Password must contain at least one number');
    //     }
    //     if (!hasSpecialChar) {
    //         throw new Error('Password must contain at least one special character');
    //     }
    // };

    const { name, password, patient, ...rest } = req.body;

    if (req.file) {
        const uploadResult = await fileUploader.uploadToCloudinary(req.file);
        patient.profilePhoto = uploadResult?.secure_url;
    }

    // const hashedPassword = password ? await bcryptjs.hash(password as string, parseInt(envVars.BCRYPT_SALT_ROUNDS)) : undefined;
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async tnx => {
        await tnx.user.create({
            data: {
                email: patient.email,
                password: hashedPassword
            }
        });

        return await tnx.patient.create({
            data: patient
        });
    });

    return result;
};

// create admin
const createAdmin = async (req: Request): Promise<Admin> => {
    const file = req.file;

    if (file) {
        const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
        req.body.admin.profilePhoto = uploadToCloudinary?.secure_url;
    }

    const hashedPassword: string = await bcrypt.hash(req.body.password, 10);

    const userData = {
        email: req.body.admin.email,
        password: hashedPassword,
        role: UserRole.ADMIN
    };

    const result = await prisma.$transaction(async transactionClient => {
        await transactionClient.user.create({
            data: userData
        });

        const createdAdminData = await transactionClient.admin.create({
            data: req.body.admin
        });

        return createdAdminData;
    });

    return result;
};

// create doctor
const createDoctor = async (req: Request): Promise<Doctor> => {
    const file = req.file;

    if (file) {
        const uploadToCloudinary = await fileUploader.uploadToCloudinary(file);
        req.body.doctor.profilePhoto = uploadToCloudinary?.secure_url;
    }
    const hashedPassword: string = await bcrypt.hash(req.body.password, 10);

    const userData = {
        email: req.body.doctor.email,
        password: hashedPassword,
        role: UserRole.DOCTOR
    };

    const result = await prisma.$transaction(async transactionClient => {
        await transactionClient.user.create({
            data: userData
        });

        const createdDoctorData = await transactionClient.doctor.create({
            data: req.body.doctor
        });

        return createdDoctorData;
    });

    return result;
};

// get all users
const getAllFromDB = async (params: any, options: any) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm, ...filterData } = params;

    const andConditions: Prisma.UserWhereInput[] = [];

    if (searchTerm) {
        andConditions.push({
            OR: userSearchableFields.map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive'
                }
            }))
        });
    }

    if (Object.keys(filterData).length > 0) {
        andConditions.push({
            AND: Object.keys(filterData).map(key => ({
                [key]: {
                    equals: (filterData as any)[key]
                }
            }))
        });
    }

    const whereConditions: Prisma.UserWhereInput =
        andConditions.length > 0
            ? {
                  AND: andConditions
              }
            : {};

    const result = await prisma.user.findMany({
        skip,
        take: limit,
        where: whereConditions,
        orderBy: {
            [sortBy]: sortOrder
        }
    });

    const total = await prisma.user.count({
        where: whereConditions
    });

    return {
        meta: {
            page,
            limit,
            total
        },
        data: result
    };
};

const getMyProfile = async (user: IJWTPayload) => {
    const userInfo = await prisma.user.findUniqueOrThrow({
        where: {
            email: user.email,
            status: UserStatus.ACTIVE
        },
        select: {
            id: true,
            email: true,
            needPasswordChange: true,
            role: true,
            status: true
        }
    });

    let profileData;

    if (userInfo.role === UserRole.PATIENT) {
        profileData = await prisma.patient.findUnique({
            where: {
                email: userInfo.email
            }
        });
    } else if (userInfo.role === UserRole.DOCTOR) {
        profileData = await prisma.doctor.findUnique({
            where: {
                email: userInfo.email
            }
        });
    } else if (userInfo.role === UserRole.ADMIN) {
        profileData = await prisma.admin.findUnique({
            where: {
                email: userInfo.email
            }
        });
    }

    return {
        ...userInfo,
        ...profileData
    };
};

export const UserService = {
    createPatient,
    createAdmin,
    createDoctor,
    getAllFromDB,
    getMyProfile
};
