export const SUBSCRIPTION_PLANS = {
  patient: {
    free: {
      id: 'patient_free',
      name: 'Free',
      price: 0,
      features: [
        'Pay per consultation',
        'Basic AI chat',
        'Standard booking',
        'Email support'
      ],
      limitations: {
        platformFee: true,
        aiChatLimit: 10,
        consultationsPerMonth: null
      }
    },
    premium: {
      id: 'patient_premium',
      name: 'Premium',
      price: 5000,
      interval: 'monthly',
      features: [
        'Unlimited AI chat',
        '3 free consultations/month',
        'No platform fees',
        'Priority booking',
        '24/7 support',
        'Health records storage'
      ],
      limitations: {
        platformFee: false,
        aiChatLimit: null,
        consultationsPerMonth: 3
      }
    }
  },
  doctor: {
    free: {
      id: 'doctor_free',
      name: 'Free',
      price: 0,
      commission: 5,
      features: [
        '5% platform commission',
        'Basic profile',
        'Standard listing',
        'Email support'
      ]
    },
    pro: {
      id: 'doctor_pro',
      name: 'Pro',
      price: 10000,
      interval: 'monthly',
      commission: 2,
      features: [
        '2% platform commission',
        'Verified badge',
        'Top listing priority',
        'Advanced analytics',
        'Priority support',
        'Custom availability'
      ]
    }
  }
};

export const PLATFORM_FEES = {
  video: 500,
  audio: 200,
  in_person: 0
};
