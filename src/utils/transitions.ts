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

// Open: springy with slight overshoot — feels alive
export const springOpen = {
  animation: 'spring' as const,
  config: {
    stiffness: 260,
    damping: 24,
    mass: 0.9,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

// Close: slightly stiffer so it snaps back cleanly
export const springClose = {
  animation: 'spring' as const,
  config: {
    stiffness: 340,
    damping: 30,
    mass: 0.75,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};
