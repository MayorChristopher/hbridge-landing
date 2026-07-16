import { Share } from 'react-native';

const APP_URL = 'https://hbridge.ng';
const TAGLINE = 'Healthcare for All';

export function shareApp() {
  Share.share({
    message:
      `Hbridge — ${TAGLINE} 🏥\n` +
      `Book verified Nigerian doctors, manage your health records and more.\n\n` +
      `Get the app: ${APP_URL}`,
    url: APP_URL,
  });
}

export function shareDoctor(doctor: {
  full_name?: string;
  title?: string;
  specialization?: string;
  id?: string;
}) {
  const title = doctor.title || 'Dr.';
  const name  = doctor.full_name || 'a Doctor';
  const formatted = /^(dr\.?|prof\.?)\s/i.test(name.trim())
    ? name.trim()
    : `${title.endsWith('.') ? title : title + '.'} ${name}`.trim();
  const spec = doctor.specialization ? ` · ${doctor.specialization}` : '';

  Share.share({
    message:
      `Connect with ${formatted}${spec} on Hbridge — ${TAGLINE}.\n\n` +
      `Book a consultation directly on the app.\n` +
      `Get Hbridge: ${APP_URL}`,
    url: APP_URL,
  });
}

export function sharePatientInvite(name?: string) {
  const first = (name || '').split(' ')[0] || 'a friend';
  Share.share({
    message:
      `${first} is on Hbridge — ${TAGLINE} 🏥\n` +
      `Manage your health records, book doctors and more.\n\n` +
      `Download the app: ${APP_URL}`,
    url: APP_URL,
  });
}
