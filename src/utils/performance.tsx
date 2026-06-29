import React, { memo, useMemo, useCallback } from 'react';
import { FlatList, FlatListProps } from 'react-native';

// Memoized component wrapper
export const MemoizedComponent = <T extends object>(
  Component: React.ComponentType<T>
): React.ComponentType<T> => {
  return memo(Component);
};

// Optimized FlatList with performance settings
export const OptimizedFlatList = <T,>(props: FlatListProps<T>) => {
  const optimizedProps = useMemo(() => ({
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    updateCellsBatchingPeriod: 50,
    initialNumToRender: 10,
    windowSize: 10,
    getItemLayout: props.getItemLayout,
    keyExtractor: props.keyExtractor || ((item: any, index: number) => 
      item.id?.toString() || index.toString()
    ),
    ...props,
  }), [props]);

  return <FlatList {...optimizedProps} />;
};

// Performance hooks
export const useOptimizedCallback = function<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
};

export const useOptimizedMemo = function<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
};

// Lazy loading wrapper
export const LazyComponent = function(
  importFunc: () => Promise<{ default: React.ComponentType<any> }>
) {
  return React.lazy(importFunc);
};