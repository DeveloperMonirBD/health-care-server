import { prisma } from "../../shared/prisma";
import { createPatientInput } from "./user.interface";
import bcrypt from 'bcryptjs';

const createPatient = async (payload: createPatientInput) => {
    const hasPassword = await bcrypt.hash(payload.password, 10);

    const result = await prisma.$transaction(async (tnx) => {
        await tnx.user.create({
            data: {
                email: payload.email,
                password: hasPassword
            }
        })

        return await tnx.patient.create({
            data: {
                name: payload.name,
                email: payload.email
            }
        })
    })
    
    return result
}

export const UserService = {
    createPatient
}