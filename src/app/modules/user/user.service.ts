import bcrypt from 'bcryptjs';
import config from '../../../config';
import { prisma } from '../../shared/prisma';
import { Request } from 'express';
import { fileUploader } from '../../helper/fileUploder';

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
        const uploadResult = await fileUploader.uploadToCloudinary(req.file)
        patient.profilePhoto = uploadResult?.secure_url
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

export const UserService = {
    createPatient
};
