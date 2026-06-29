export class ErrorHandler {
  static handle(error: any, context: string = 'Unknown'): string {
    const sanitizedError = this.sanitizeError(error);
    console.error(`[${context}]`, sanitizedError);
    return this.getUserFriendlyMessage(error);
  }

  static sanitizeError(error: any): string {
    if (typeof error === 'string') {
      return error.replace(/[\r\n]/g, ' ').substring(0, 200);
    }
    
    if (error instanceof Error) {
      return error.message.replace(/[\r\n]/g, ' ').substring(0, 200);
    }
    
    return String(error).replace(/[\r\n]/g, ' ').substring(0, 200);
  }

  static getUserFriendlyMessage(error: any): string {
    if (typeof error === 'string') {
      if (error.includes('network') || error.includes('fetch')) {
        return 'Network connection error. Please check your internet.';
      }
      if (error.includes('auth') || error.includes('unauthorized')) {
        return 'Authentication error. Please sign in again.';
      }
      return 'Something went wrong. Please try again.';
    }

    if (error instanceof Error) {
      if (error.message.includes('network') || error.message.includes('fetch')) {
        return 'Network connection error. Please check your internet.';
      }
      if (error.message.includes('auth') || error.message.includes('unauthorized')) {
        return 'Authentication error. Please sign in again.';
      }
      return 'Something went wrong. Please try again.';
    }

    return 'An unexpected error occurred. Please try again.';
  }
}