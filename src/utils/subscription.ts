interface SubscriptionFields {
  subscription_status?: string | null;
  subscription_expires_at?: string | null;
}

export function isSubscriptionActive(profile: SubscriptionFields | null | undefined): boolean {
  if (!profile || profile.subscription_status !== 'active') return false;
  if (!profile.subscription_expires_at) return false;
  return new Date(profile.subscription_expires_at) > new Date();
}
