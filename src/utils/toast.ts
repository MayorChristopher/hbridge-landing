// Modern toast notifications - use ToastProvider and useToast hook

export interface ToastOptions {
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  action?: {
    text: string;
    onPress: () => void;
  };
}

// Global toast instance for backward compatibility
let globalToastInstance: any = null;

export function setGlobalToastInstance(instance: any) {
  globalToastInstance = instance;
}

class ToastService {
  private getToastInstance() {
    if (!globalToastInstance) {
      console.warn('Toast not initialized. Use useToast hook instead.');
      return null;
    }
    return globalToastInstance;
  }

  showSuccess(title: string, message?: string, options?: ToastOptions) {
    const toast = this.getToastInstance();
    if (toast) {
      toast.showSuccess(title, message, options?.action);
    }
  }

  showError(title: string, message?: string, options?: ToastOptions) {
    const toast = this.getToastInstance();
    if (toast) {
      toast.showError(title, message, options?.action);
    }
  }

  showWarning(title: string, message?: string, options?: ToastOptions) {
    const toast = this.getToastInstance();
    if (toast) {
      toast.showWarning(title, message, options?.action);
    }
  }

  showInfo(title: string, message?: string, options?: ToastOptions) {
    const toast = this.getToastInstance();
    if (toast) {
      toast.showInfo(title, message, options?.action);
    }
  }

  // Medical specific toasts
  showMedicalSuccess(title: string, message?: string) {
    this.showSuccess('Medical Update', title + (message ? '\n\n' + message : ''));
  }

  showMedicalError(title: string, message?: string) {
    this.showError('Medical Alert', title + (message ? '\n\n' + message : ''));
  }

  showBookingSuccess(doctorName: string, consultationType: string) {
    this.showSuccess(
      'Consultation Booked',
      `Your ${consultationType} consultation with Dr. ${doctorName} has been successfully scheduled.`
    );
  }

  showBookingError(error?: string) {
    this.showError(
      'Booking Failed',
      error || 'Unable to book consultation. Please check your connection and try again.'
    );
  }

  showRatingSuccess(doctorName: string) {
    this.showSuccess(
      'Review Submitted',
      `Thank you for rating Dr. ${doctorName}. Your feedback helps our community.`
    );
  }

  // Connection and API specific toasts
  showConnectionError() {
    this.showError(
      'Connection Error',
      'Please check your internet connection and try again.',
      {
        text: 'Retry',
        onPress: () => window.location.reload()
      }
    );
  }

  showAPIError(service: string = 'service') {
    this.showError(
      'Service Unavailable',
      `${service} is temporarily unavailable. Please try again later.`
    );
  }
}

export const Toast = new ToastService();