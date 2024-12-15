import { useCallback, useLayoutEffect, useRef } from "react";

export function useEffectEvent<TArgs extends unknown[], TReturn = unknown>(
  callback: (...args: TArgs) => TReturn,
) {
  const callbackRef = useRef(callback);

  // useLayoutEffect should be overkill here 99% of the time, but if this were
  // defined as a regular effect, useEffectEvent would not be able to work with
  // any layout effects at all; the callback sync here would fire *after* the
  // layout effect that needs the useEffectEvent function
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: TArgs): TReturn => {
    return callbackRef.current(...args);
  }, []);
}
