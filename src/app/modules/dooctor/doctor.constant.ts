import { Specialties } from '@prisma/client';
export const doctorFilterableFields = ['email', 'contactNumber', 'gender', 'appointmentFee', 'specialties', 'searchTerm'];

export const doctorSearchableFields =  ["name", "email", "contactNumber"]