/**
 * Smooth iOS-style slide transitions for @react-navigation/stack
 *
 * Incoming screen:  slides from right + subtle scale-up + quick fade-in
 * Outgoing screen:  slides left slightly + dims under a translucent overlay
 * Physics:          spring — fast, natural settle with no overshoot
 */

export function slideTransition({ current, next, layouts }: any) {
  const screenW = layouts?.screen?.width ?? 420;

  const translateX = current.progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [screenW, 0],
    extrapolate: 'clamp',
  });

  const scale = current.progress.interpolate({
    inputRange:  [0, 1],
    outputRange: [0.97, 1],
    extrapolate: 'clamp',
  });

  const opacity = current.progress.interpolate({
    inputRange:  [0, 0.15, 1],
    outputRange: [0, 1, 1],
    extrapolate: 'clamp',
  });

  // Previous screen shifts slightly left as next screen arrives
  const prevTranslateX = next
    ? next.progress.interpolate({
        inputRange:  [0, 1],
        outputRange: [0, -screenW * 0.22],
        extrapolate: 'clamp',
      })
    : 0;

  return {
    cardStyle: {
      opacity,
      transform: [{ translateX }, { scale }],
    },
    overlayStyle: {
      opacity: next
        ? next.progress.interpolate({
            inputRange:  [0, 1],
            outputRange: [0, 0.12],
            extrapolate: 'clamp',
          })
        : 0,
    },
  };
}

// Alias kept for backward compat
export const telegramTransition = slideTransition;

// Open: crisp spring, no bounce
export const springOpen = {
  animation: 'spring' as const,
  config: {
    stiffness: 420,
    damping: 42,
    mass: 0.72,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

// Close: slightly snappier
export const springClose = {
  animation: 'spring' as const,
  config: {
    stiffness: 500,
    damping: 50,
    mass: 0.68,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};
