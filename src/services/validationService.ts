// Simple validation without zod dependency
export class ValidationService {
  static sanitizeInput(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  static validateChatInput(input: any) {
    const message = this.sanitizeInput(input.message || '');
    
    if (!message || message.length === 0) {
      throw new Error('Message cannot be empty');
    }
    
    if (message.length > 1000) {
      throw new Error('Message too long');
    }
    
    return { message, language: input.language };
  }

  static validateUserProfile(input: any) {
    if (!input.full_name || input.full_name.length < 2) {
      throw new Error('Full name is required');
    }
    
    if (!input.email || !input.email.includes('@')) {
      throw new Error('Valid email is required');
    }
    
    return input;
  }

  static validateFileUpload(file: { size: number; type: string }) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    
    if (file.size > maxSize) {
      throw new Error('File too large (max 5MB)');
    }
    
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, and WebP images allowed');
    }
    
    return file;
  }

  static isEmergencyKeyword(message: string): boolean {
    const emergencyKeywords = [
      'emergency', 'urgent', 'help', 'dying', 'bleeding', 'unconscious',
      'chest pain', 'heart attack', 'stroke', 'choking', 'poisoned',
      'accident', 'severe pain', 'can\'t breathe', 'overdose'
    ];
    
    const lowerMessage = message.toLowerCase();
    return emergencyKeywords.some(keyword => lowerMessage.includes(keyword));
  }
}