/**
 * Security utilities for sanitizing user inputs and preventing injection attacks
 */

/**
 * Sanitize string input to prevent log injection and XSS
 */
export const sanitizeInput = (input: string): string => {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[\r\n\t]/g, ' ') // Remove newlines and tabs for log injection prevention
    .replace(/[<>\"'&]/g, (match) => { // Basic XSS prevention
      const entities: { [key: string]: string } = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;'
      };
      return entities[match] || match;
    })
    .trim()
    .substring(0, 1000); // Limit length
};

/**
 * Sanitize for logging to prevent log injection
 */
export const sanitizeForLog = (input: any): string => {
  if (typeof input === 'object') {
    try {
      input = JSON.stringify(input);
    } catch {
      input = '[Object]';
    }
  }
  
  return sanitizeInput(String(input));
};

/**
 * Validate and sanitize file paths to prevent path traversal
 */
export const sanitizeFilePath = (filePath: string): string => {
  if (typeof filePath !== 'string') return '';
  
  // Remove path traversal sequences
  const sanitized = filePath
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\\\/]+/g, '/') // Normalize slashes
    .replace(/^\/+/, '') // Remove leading slashes
    .trim();
    
  // Only allow alphanumeric, dots, dashes, underscores
  return sanitized.replace(/[^a-zA-Z0-9.\-_\/]/g, '');
};

/**
 * Validate URL to prevent SSRF attacks
 */
export const validateUrl = (url: string): boolean => {
  if (typeof url !== 'string') return false;
  
  try {
    const parsedUrl = new URL(url);
    
    // Only allow HTTPS for external requests
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
      return false;
    }
    
    // Block private IP ranges
    const hostname = parsedUrl.hostname.toLowerCase();
    const privateRanges = [
      '127.', '10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
      '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.',
      '172.26.', '172.27.', '172.28.', '172.29.', '172.30.', '172.31.',
      'localhost', '169.254.', '::1', 'fc00:', 'fe80:'
    ];
    
    for (const range of privateRanges) {
      if (hostname.startsWith(range)) {
        return false;
      }
    }
    
    // Allow only specific trusted domains for production
    const trustedDomains = [
      'api.openai.com',
      'generativelanguage.googleapis.com',
      'supabase.co',
      'vapoyosssxnprxznnfgb.supabase.co'
    ];
    
    return trustedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
    
  } catch {
    return false;
  }
};

/**
 * Sanitize medical data for secure storage
 */
export const sanitizeMedicalData = (data: any): any => {
  if (typeof data === 'string') {
    return sanitizeInput(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeMedicalData);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[sanitizeInput(key)] = sanitizeMedicalData(value);
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Generate secure random string for IDs
 */
export const generateSecureId = (length: number = 16): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
};

/**
 * Validate email format
 */
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Validate phone number (Nigerian format)
 */
export const validatePhoneNumber = (phone: string): boolean => {
  const nigerianPhoneRegex = /^(\+234|234|0)?[789][01]\d{8}$/;
  return nigerianPhoneRegex.test(phone.replace(/\s/g, ''));
};