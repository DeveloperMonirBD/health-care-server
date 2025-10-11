import { email } from "zod";
import { UserStatus } from "@prisma/client";
import bcrypt from 'bcryptjs';
import { prisma } from "../../shared/prisma";
import { loginAuthInput } from "./auth.interface";
import { jwtHelper } from "../../helper/jwtHelper";

const login = async (payload: loginAuthInput) => {
    const user = await prisma.user.findUniqueOrThrow({
        where: {
            email: payload.email,
            status: UserStatus.ACTIVE
        }
    });

    const isCorrectPassword = await bcrypt.compare(payload.password, user.password);
    if (!isCorrectPassword) {
        throw new Error('Password is incorrect!');
    }

    const accessToken = jwtHelper.generateToken({ email: user.email, role: user.role }, "abcd", "1h");

    const refreshToken = jwtHelper.generateToken({ email: user.email, role: user.role }, 'abcdefgh', '90d');

    return {
        accessToken,
        refreshToken,
        needPasswordChange: user.needPasswordChange
    };
};

export const AuthService = {
    login
}