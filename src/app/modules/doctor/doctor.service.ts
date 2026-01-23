import { Specialties } from '@prisma/client';
import { DoctorSpecialties } from './../../../../node_modules/.prisma/client/index.d';
import { Doctor, Prisma, UserStatus } from '@prisma/client';
import { IOptions, paginationHelper } from '../../helper/paginationHelper';
import { doctorSearchableFields } from './doctor.constant';
import { prisma } from '../../shared/prisma';
import { IDoctorUpdateInput } from './doctor.interface';
import ApiError from '../../errors/ApiError';
import httpStatus from 'http-status';
import { openai } from '../../helper/open-router';
import { extractJsonFromMessage } from '../../helper/extractJsonFromMessage';
import { includes } from 'zod';

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

    // doctor > doctorSpecialties > specialties > title
    // Handle multiple specialties: ?specialties=Cardiology&specialties=Neurology
    if (specialties && specialties.length > 0) {
        //Convert to array if single string
        const specialtiesArray = Array.isArray(specialties) ? specialties : [specialties];

        andConditions.push({
            doctorSpecialties: {
                some: {
                    specialities: {
                        title: {
                            in: specialtiesArray,
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

    andConditions.push({
        isDeleted: false
    });

    const whereConditions: Prisma.DoctorWhereInput = andConditions.length > 0 ? { AND: andConditions } : {};

    const result = await prisma.doctor.findMany({
        where: whereConditions,
        skip,
        take: limit,
        orderBy: options.sortBy && options.sortOrder ? { [options.sortBy]: options.sortOrder } : { averageRating: 'desc' },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: {
                        select: {
                            title: true
                        }
                    }
                }
            },
            reviews: {
                select: {
                    rating: true
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

const updateIntoDB = async (id: string, payload: Partial<IDoctorUpdateInput>) => {
    const { specialties, removeSpecialties, ...doctorData } = payload;

    const doctorInfo = await prisma.doctor.findUniqueOrThrow({
        where: {
            id,
            isDeleted: false
        }
    });

    return await prisma.$transaction(async transactionClient => {
        // step 1: Update doctor basic data
        if (Object.keys(doctorData).length > 0) {
            await transactionClient.doctor.update({
                where: {
                    id
                },
                data: doctorData
            });
        }

        // step: 2 Remove specialties if provided
        if (removeSpecialties && Array.isArray(removeSpecialties) && removeSpecialties.length > 0) {
            // Validate that specialties to remove exist for this doctor
            const existingDoctorSpecialties = await transactionClient.doctorSpecialties.findMany({
                where: {
                    doctorId: doctorInfo.id,
                    specialitiesId: {
                        in: removeSpecialties
                    }
                }
            });

            if (existingDoctorSpecialties.length !== removeSpecialties.length) {
                const foundIds = existingDoctorSpecialties.map(ds => ds.specialitiesId);

                const notFound = removeSpecialties.filter(id => !foundIds.includes(id));

                throw new Error(`Cannot remove non-existent specialties: ${notFound.join(', ')}`);
            }

            // Delete the specialties
            await transactionClient.doctorSpecialties.deleteMany({
                where: {
                    doctorId: doctorInfo.id,
                    specialitiesId: {
                        in: removeSpecialties
                    }
                }
            });
        }

        // step 3: Add new specialties if provided
        if (specialties && Array.isArray(specialties) && specialties.length > 0) {
            // Verify all specialties exist ub Specialties table
            const existingSpecialties = await transactionClient.specialties.findMany({
                where: {
                    id: {
                        in: specialties
                    }
                },
                select: {
                    id: true
                }
            });

            const existingSpecialityIds = existingSpecialties.map(s => s.id);
            const invalidSpecialties = specialties.filter(id => !existingSpecialityIds.includes(id));

            if (invalidSpecialties.length > 0) {
                throw new Error(`Invalid specialty IDs: ${invalidSpecialties.join(', ')}`);
            }

            // check for duplicates - don't specialties that already exist
            const currentDoctorSpecialties = await transactionClient.doctorSpecialties.findMany({
                where: {
                    doctorId: doctorInfo.id,
                    specialitiesId: {
                        in: specialties
                    }
                },
                select: {
                    specialitiesId: true
                }
            });

            const currentSpecialityIds = currentDoctorSpecialties.map(ds => ds.specialitiesId);
            const newSpecialties = specialties.filter(id => !currentSpecialityIds.includes(id));

            // Only create new specialties that don't already exist
            if (newSpecialties.length > 0) {
                const DoctorSpecialtiesData = newSpecialties.map(specialtyId => ({
                    doctorId: doctorInfo.id,
                    specialitiesId: specialtyId
                }));

                await transactionClient.doctorSpecialties.createMany({
                    data: DoctorSpecialtiesData
                });
            }
        }
    });

    // Step 4: Return updated doctor with specialties
    const result = await prisma.doctor.findUnique({
        where: {
            id: doctorInfo.id
        },
        include: {
            doctorSpecialties: {
                include: {
                    specialities: true
                }
            }
        }
    });

    return result;
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
            },
            reviews: true
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
};

export const DoctorService = {
    getAllFromDB,
    updateIntoDB,
    getByIdFromDB,
    deleteFromDB,
    softDelete,
    getAISuggestions
};
