/**
 * Telegram-style spring transitions for @react-navigation/stack
 *
 * Incoming screen:  fades in (0→1) + scales up (0.96→1.0) + drifts up 8px
 * Outgoing screen:  dims slightly under a dark overlay (no movement)
 * Physics:          spring — overshoots microscopically, settles naturally
 */

export function telegramTransition({ current, next }: any) {
  const progress = current.progress;

  return {
    cardStyle: {
      opacity: progress.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0, 0.8, 1],
        extrapolate: 'clamp',
      }),
      transform: [
        {
          scale: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0.96, 1],
            extrapolate: 'clamp',
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    },
    overlayStyle: {
      opacity: next
        ? next.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 0.1],
            extrapolate: 'clamp',
          })
        : 0,
    },
  };
}

// Open: fast settle, no overshoot
export const springOpen = {
  animation: 'spring' as const,
  config: {
    stiffness: 380,
    damping: 38,
    mass: 0.7,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

// Close: instant snap back
export const springClose = {
  animation: 'spring' as const,
  config: {
    stiffness: 440,
    damping: 42,
    mass: 0.65,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};
