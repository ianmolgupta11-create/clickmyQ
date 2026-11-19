export interface Patient {
  id: string;
  hospitalId: string;
  patientId: string;
  name: string;
  email?: string | null;
  phone: string;
  whatsapp?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  age?: number | null;
  bloodGroup?: string | null;
  address?: string | null;
  documents?: string | null;
  patientType?: string | null;
  allergies?: string | null;
  emergencyName?: string | null;
  emergencyRelation?: string | null;
  emergencyPhone?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hospital?: {
    id: string;
    name: string;
    logo?: string | null;
    bookingSlug?: string | null;
  } | null;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  departmentId: string;
  appointmentDate: string;
  timeSlot: string;
  type: string;
  status: string;
  consultationFee: number;
  tokenNumber: string;
  createdAt: string;
  doctorName?: string | null;
  departmentName?: string | null;
  feeAmount?: number | null;
  isFeePaid?: boolean | null;
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  checkedIn?: boolean | null;
}

export interface Prescription {
  id: string;
  patientId: string;
  appointmentId: string;
  prescriptionNo?: string | null;
  diagnosis?: string | null;
  medicines?: string | null;
  doctorName?: string | null;
  createdAt: string;
  date?: string | null;
}

export interface BillItem {
  id: string;
  name: string;
  amount: number;
}

export interface Bill {
  id: string;
  patientId: string;
  title: string;
  billNo?: string | null;
  billDate?: string | null;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  items?: BillItem[];
  paymentMethod?: string | null;
  createdAt: string;
}

export interface QueueAppointment {
  id?: string;
  appointmentId?: string;
  status: string;
  tokenNumber?: string | null;
  doctorName?: string | null;
  doctorSpecialization?: string | null;
  departmentName?: string | null;
  timeSlot?: string | null;
  checkedIn?: boolean | null;
}

export interface QueueStatus {
  patientsAhead: number;
  estimatedWaitMin: number;
  nowServingToken?: string | null;
  myPosition?: number | null;
  appointment?: QueueAppointment | null;
  doctorInterruption?: {
    status: string;
    statusStartedAt: string | null;
    expectedReturnAt: string | null;
    actualReturnAt: string | null;
  } | null;
}

export type AuthState = {
  isAuthenticated: boolean;
  patient: Patient | null;
  loading: boolean;
};
