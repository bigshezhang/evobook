import { lazy, ComponentType } from 'react';

/**
 * Lazy import with preload support.
 * Wraps React.lazy and attaches a `.preload()` method so the chunk
 * can be fetched ahead of time (e.g. on hover / route prefetch).
 */
export function lazyWithPreload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
) {
  const Component = lazy(factory) as ReturnType<typeof lazy> & {
    preload: typeof factory;
  };
  Component.preload = factory;
  return Component;
}
