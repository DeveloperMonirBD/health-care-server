import { Doctor, Prisma } from '@prisma/client';
import httpStatus from 'http-status';
import ApiError from '../../errors/ApiError';
import { openai } from '../../helper/open-router';
import { IOptions, paginationHelper } from '../../helper/paginationHelper';
import { prisma } from '../../shared/prisma';
import { doctorSearchableFields } from './doctor.constant';
import { IDoctorUpdateInput } from './doctor.interface';
import { extractJsonFromMessage } from '../../helper/extractJsonFromMessage';

const getAllFromDB = async (filters: any, options: IOptions) => {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelper.calculatePagination(options);
    const { searchTerm, specialties, ...filterData } = filters;

    const andConditions: Prisma.DoctorWhereInput[] = [];

    if (searchTerm) {
        andConditions.push({
            OR: doctorSearchableFields.map(field => ({
                [field]: {
                    contains: searchTerm,
                    mode: 'insensitive'
                }
            }))
        });
    }

    if (specialties && specialties.length > 0) {
        andConditions.push({
            doctorSpecialties: {
                some: {
                    specialities: {
                        title: {
                            contains: specialties,
                            mode: 'insensitive'
                        }
                    }
                }
            }
        });
    }

    if (Object.keys(filterData).length > 0) {
        const filterConditions = Object.keys(filterData).map(key => ({
            [key]: {
                equals: (filterData as any)[key]
            }
        }));

        andConditions.push(...filterConditions);
    }

    const whereConditions: Prisma.DoctorWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.doctor.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: {
            [sortBy]: sortOrder
        },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: true
                }
            }
        }
    });

    const total = await prisma.doctor.count({
        where: whereConditions
    });

    return {
        meta: {
            total,
            page,
            limit
        },
        data: result
    };
};

const updateInputDB = async (id: string, payload: Partial<IDoctorUpdateInput>) => {
    const doctorInfo = await prisma.doctor.findUniqueOrThrow({
        where: {
            id
        }
    });

    const { specialties, ...doctorData } = payload;

    return await prisma.$transaction(async tnx => {
        if (specialties && specialties.length > 0) {
            const deleteSpecialtyIDS = specialties.filter(specialty => specialty.isDeleted);

            for (const specialty of deleteSpecialtyIDS) {
                await tnx.doctorSpecialties.deleteMany({
                    where: {
                        doctorId: id,
                        specialitiesId: specialty.specialtyId
                    }
                });
            }

            const createSpecialtyIds = specialties.filter(specialty => !specialty.isDeleted);

            for (const specialty of createSpecialtyIds) {
                await tnx.doctorSpecialties.create({
                    data: {
                        doctorId: id,
                        specialitiesId: specialty.specialtyId
                    }
                });
            }
        }

        const updatedData = await tnx.doctor.update({
            where: {
                id: doctorInfo.id
            },
            data: doctorData,
            include: {
                doctorSpecialties: {
                    include: {
                        specialities: true
                    }
                }
            }

            //* doctor - doctorSpecialities - specialities
        });

        return updatedData;
    });
};

const getByIdFromDB = async (id: string): Promise<Doctor | null> => {
    const result = await prisma.doctor.findUnique({
        where: {
            id,
            isDeleted: false
        },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: true
                }
            },
            doctorSchedules: {
                include: {
                    schedule: true
                }
            }
        }
    });
    return result;
};

const deleteFromDB = async (id: string): Promise<Doctor> => {
    return await prisma.$transaction(async transactionClient => {
        const deleteDoctor = await transactionClient.doctor.delete({
            where: {
                id
            }
        });

        await transactionClient.user.delete({
            where: {
                email: deleteDoctor.email
            }
        });

        return deleteDoctor;
    });
};

const softDelete = async (id: string): Promise<Doctor> => {
    return await prisma.$transaction(async transactionClient => {
        const deleteDoctor = await transactionClient.doctor.update({
            where: { id },
            data: {
                isDeleted: true
            }
        });

        await transactionClient.user.update({
            where: {
                email: deleteDoctor.email
            },
            data: {
                status: UserStatus.DELETED
            }
        });

        return deleteDoctor;
    });
};

const getAISuggestions = async (payload: { symptoms: string }) => {
    if (!(payload && payload.symptoms)) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'symptoms is required!');
    }

    const doctors = await prisma.doctor.findMany({
        where: { isDeleted: false },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: true
                }
            }
        }
    });

    console.log('doctors data loaded.......\n');

    const prompt = `
You are a medical assistant AI. Based on the patient's symptoms, suggest the top 3 most suitable doctors.
Each doctor has specialties and years of experience.
Only suggest doctors who are relevant to the given symptoms.

Symptoms: ${payload.symptoms}

Here is the doctor list (in JSON):
${JSON.stringify(doctors, null, 2)}

Return your response in JSON format with full individual doctor data. 
`;

    console.log('analyzing......\n');

    const completion = await openai.chat.completions.create({
        model: 'z-ai/glm-4.5-air:free',
        messages: [
            {
                role: 'system',
                content: 'You are a helpful AI medical assistant that provides doctor suggestions.'
            },
            {
                role: 'user',
                content: prompt
            }
        ]
    });

    const result = await extractJsonFromMessage(completion.choices[0].message);
    return result;
    
    // async function extractJsonFromMessage(message: any): Promise<any> {
    //     const content = message && (message.content ?? message);
    //     const text = typeof content === 'string' ? content : JSON.stringify(content);

    //     // Attempt to extract JSON substring (object or array)
    //     const firstBrace = text.indexOf('{');
    //     const lastBrace = text.lastIndexOf('}');
    //     const firstBracket = text.indexOf('[');
    //     const lastBracket = text.lastIndexOf(']');

    //     let jsonText = text;
    //     if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    //         jsonText = text.substring(firstBrace, lastBrace + 1);
    //     } else if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
    //         jsonText = text.substring(firstBracket, lastBracket + 1);
    //     }

    //     try {
    //         return JSON.parse(jsonText);
    //     } catch (err) {
    //         throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to parse JSON from AI response');
    //     }
    // }
};

export const DoctorService = {
    getAllFromDB,
    updateInputDB,
    getByIdFromDB,
    deleteFromDB,
    softDelete,
    getAISuggestions
};
