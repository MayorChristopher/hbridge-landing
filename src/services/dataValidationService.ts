import { sanitizeInput, validateEmail, validatePhoneNumber } from '../utils/security';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedData?: any;
}

export class DataValidationService {
  private static instance: DataValidationService;
  
  static getInstance(): DataValidationService {
    if (!DataValidationService.instance) {
      DataValidationService.instance = new DataValidationService();
    }
    return DataValidationService.instance;
  }

  /**
   * Validate user registration data
   */
  validateRegistration(data: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    userType: string;
  }): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    // Email validation
    if (!data.email || !validateEmail(data.email)) {
      errors.push('Please enter a valid email address');
    } else {
      sanitizedData.email = sanitizeInput(data.email.toLowerCase());
    }

    // Password validation
    if (!data.password || data.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)/.test(data.password)) {
      errors.push('Password must contain at least one uppercase letter, one lowercase letter, and one number');
    } else {
      sanitizedData.password = data.password; // Don't sanitize passwords
    }

    // Full name validation
    if (!data.fullName || data.fullName.trim().length < 2) {
      errors.push('Please enter your full name (at least 2 characters)');
    } else if (data.fullName.length > 100) {
      errors.push('Full name must be less than 100 characters');
    } else {
      sanitizedData.fullName = sanitizeInput(data.fullName);
    }

    // Phone number validation (optional)
    if (data.phoneNumber) {
      if (!validatePhoneNumber(data.phoneNumber)) {
        errors.push('Please enter a valid Nigerian phone number');
      } else {
        sanitizedData.phoneNumber = sanitizeInput(data.phoneNumber);
      }
    }

    // User type validation
    const validUserTypes = ['patient', 'doctor', 'hospital_admin'];
    if (!data.userType || !validUserTypes.includes(data.userType)) {
      errors.push('Please select a valid user type');
    } else {
      sanitizedData.userType = data.userType;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate medical record data
   */
  validateMedicalRecord(data: {
    title: string;
    description?: string;
    recordType: string;
    patientId: string;
  }): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    // Title validation
    if (!data.title || data.title.trim().length < 3) {
      errors.push('Record title must be at least 3 characters long');
    } else if (data.title.length > 200) {
      errors.push('Record title must be less than 200 characters');
    } else {
      sanitizedData.title = sanitizeInput(data.title);
    }

    // Description validation (optional)
    if (data.description) {
      if (data.description.length > 2000) {
        errors.push('Description must be less than 2000 characters');
      } else {
        sanitizedData.description = sanitizeInput(data.description);
      }
    }

    // Record type validation
    const validRecordTypes = ['lab_result', 'prescription', 'vital_signs', 'imaging', 'consultation', 'diagnosis'];
    if (!data.recordType || !validRecordTypes.includes(data.recordType)) {
      errors.push('Please select a valid record type');
    } else {
      sanitizedData.recordType = data.recordType;
    }

    // Patient ID validation
    if (!data.patientId || !/^[a-zA-Z0-9-_]{10,50}$/.test(data.patientId)) {
      errors.push('Invalid patient ID format');
    } else {
      sanitizedData.patientId = data.patientId;
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate doctor profile data
   */
  validateDoctorProfile(data: {
    fullName: string;
    specialization: string;
    licenseNumber: string;
    yearsOfExperience: number;
    hospitalAffiliation?: string;
    bio?: string;
  }): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    // Full name validation
    if (!data.fullName || data.fullName.trim().length < 2) {
      errors.push('Please enter your full name');
    } else {
      sanitizedData.fullName = sanitizeInput(data.fullName);
    }

    // Specialization validation
    if (!data.specialization || data.specialization.trim().length < 2) {
      errors.push('Please enter your medical specialization');
    } else {
      sanitizedData.specialization = sanitizeInput(data.specialization);
    }

    // License number validation
    if (!data.licenseNumber || data.licenseNumber.trim().length < 5) {
      errors.push('Please enter a valid medical license number');
    } else {
      sanitizedData.licenseNumber = sanitizeInput(data.licenseNumber);
    }

    // Years of experience validation
    if (typeof data.yearsOfExperience !== 'number' || data.yearsOfExperience < 0 || data.yearsOfExperience > 60) {
      errors.push('Please enter valid years of experience (0-60)');
    } else {
      sanitizedData.yearsOfExperience = data.yearsOfExperience;
    }

    // Hospital affiliation (optional)
    if (data.hospitalAffiliation) {
      sanitizedData.hospitalAffiliation = sanitizeInput(data.hospitalAffiliation);
    }

    // Bio (optional)
    if (data.bio) {
      if (data.bio.length > 1000) {
        errors.push('Bio must be less than 1000 characters');
      } else {
        sanitizedData.bio = sanitizeInput(data.bio);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate hospital profile data
   */
  validateHospitalProfile(data: {
    name: string;
    type: string;
    address: string;
    phoneNumber: string;
    email: string;
    services: string[];
    description?: string;
  }): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    // Name validation
    if (!data.name || data.name.trim().length < 3) {
      errors.push('Hospital name must be at least 3 characters long');
    } else {
      sanitizedData.name = sanitizeInput(data.name);
    }

    // Type validation
    const validTypes = ['General Hospital', 'Specialist Hospital', 'Teaching Hospital', 'Private Clinic', 'Medical Center'];
    if (!data.type || !validTypes.includes(data.type)) {
      errors.push('Please select a valid hospital type');
    } else {
      sanitizedData.type = data.type;
    }

    // Address validation
    if (!data.address || data.address.trim().length < 10) {
      errors.push('Please enter a complete address');
    } else {
      sanitizedData.address = sanitizeInput(data.address);
    }

    // Phone number validation
    if (!validatePhoneNumber(data.phoneNumber)) {
      errors.push('Please enter a valid Nigerian phone number');
    } else {
      sanitizedData.phoneNumber = sanitizeInput(data.phoneNumber);
    }

    // Email validation
    if (!validateEmail(data.email)) {
      errors.push('Please enter a valid email address');
    } else {
      sanitizedData.email = sanitizeInput(data.email.toLowerCase());
    }

    // Services validation
    if (!Array.isArray(data.services) || data.services.length === 0) {
      errors.push('Please select at least one service');
    } else {
      sanitizedData.services = data.services.map(service => sanitizeInput(service));
    }

    // Description (optional)
    if (data.description) {
      if (data.description.length > 2000) {
        errors.push('Description must be less than 2000 characters');
      } else {
        sanitizedData.description = sanitizeInput(data.description);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate search query
   */
  validateSearchQuery(query: string): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    if (!query || query.trim().length < 2) {
      errors.push('Search query must be at least 2 characters long');
    } else if (query.length > 100) {
      errors.push('Search query must be less than 100 characters');
    } else {
      sanitizedData.query = sanitizeInput(query);
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }

  /**
   * Validate PIN (4 digits)
   */
  validatePIN(pin: string): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = {};

    if (!pin || !/^\d{4}$/.test(pin)) {
      errors.push('PIN must be exactly 4 digits');
    } else {
      sanitizedData.pin = pin; // Don't sanitize PINs
    }

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined
    };
  }
}