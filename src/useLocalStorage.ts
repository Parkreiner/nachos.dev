/**
 * @todo Figure out how to broaden the return type when a fallbackValue is
 * provided (i.e., if the fallback is false, we want the type to be boolean, and
 * not literal false). Especially important for object properties
 *
 * React useState has this behavior, but at least from their index.d.ts files,
 * I have no idea how they're achieving it. Not sure if they just have a magic
 * exception baked in, or what.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useEffectEvent } from "./useEffectEvent";

type JsonObject = Readonly<{ [key: string]: JsonValue }>;
type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | JsonObject;

type ReactSubscriptionCallback = (notifyReact: () => void) => () => void;

type SetLocalStorageValue<T extends JsonValue = JsonValue> = (
  payload: T | null | ((newValue: T | null) => T | null),
) => void;

type BaseUseLocalStorageOptions = Readonly<{
  key: string;

  /**
   * If a null value would be written to localStorage, instead remove the
   * key-value pair entirely.
   */
  removeNullValues?: boolean;

  /**
   * If fallbackValue is provided, and there is no value in localStorage, sync
   * the value to localStorage. Never does anything if fallbackValue is not
   * provided on the first render.
   */
  syncFallbackOnMount?: boolean;
}>;

type UseLocalStorageOptionsWithoutFallback = Readonly<
  BaseUseLocalStorageOptions & {
    fallbackValue?: undefined;
  }
>;

type UseLocalStorageOptionsWithFallback<T extends JsonValue = JsonValue> =
  Readonly<
    BaseUseLocalStorageOptions & {
      fallbackValue: T;
    }
  >;

type UseLocalStorageResult<T extends JsonValue = JsonValue> = readonly [
  value: T,
  setStorageValue: SetLocalStorageValue<T>,
  latestError: Error | undefined,
];

function deepEqual(v1: JsonValue, v2: JsonValue): boolean {
  // Not using Object.is here, because it's not that relevant for JSON, and it
  // also introduces edge cases for positive and negative zero
  if (v1 === v2) {
    return true;
  }

  if (typeof v1 !== "object" || typeof v2 !== "object") {
    return false;
  }

  // Writing condition like this to get better type narrowing. The very first
  // check means that when one is null, the other can't be
  if (v1 === null || v2 === null) {
    return false;
  }

  if (Array.isArray(v1)) {
    if (!Array.isArray(v2)) {
      return false;
    }

    if (v1.length !== v2.length) {
      return false;
    }

    return v1.every((el, i) => deepEqual(el, v2[i] as JsonValue));
  }

  if (Array.isArray(v2)) {
    return false;
  }

  // For some reason, the array logic isn't narrowing properly; have to do type
  // assertions
  const o1 = v1 as JsonObject;
  const o2 = v2 as JsonObject;

  if (Object.keys(o1).length !== Object.keys(o2).length) {
    return false;
  }

  for (const key in o1) {
    const objValue1 = o1[key];
    const objValue2 = o2[key];

    if (objValue1 === undefined || objValue2 === undefined) {
      return false;
    }

    if (!deepEqual(objValue1, objValue2)) {
      return false;
    }
  }

  return true;
}

export function createUseLocalStorage(localStorage: Storage) {
  function useLocalStorage<T extends JsonValue = JsonValue>(
    options: UseLocalStorageOptionsWithFallback<T>,
  ): UseLocalStorageResult<T>;
  function useLocalStorage<T extends JsonValue = JsonValue>(
    options: UseLocalStorageOptionsWithoutFallback,
  ): UseLocalStorageResult<T | null>;
  function useLocalStorage<T extends JsonValue = JsonValue>(
    options:
      | UseLocalStorageOptionsWithoutFallback
      | UseLocalStorageOptionsWithFallback<T>,
  ): UseLocalStorageResult<T | null> {
    const {
      key,
      fallbackValue,
      removeNullValues = true,
      syncFallbackOnMount = false,
    } = options;

    const [latestError, setLatestError] = useState<Error>();

    // We actually need useCallback and not useEffectEvent here, because of how
    // useSyncExternalStore works. Every time useSync gets a new memory
    // reference for its subscription callback, it unsubscribes with the old
    // callback and resubscribes with the new one. We want that behavior every
    // time the storage key changes
    const subscribeToLocalStorage = useCallback<ReactSubscriptionCallback>(
      (notifyReact) => {
        const onStorageUpdate = (event: StorageEvent) => {
          // Browsers don't support granular storage subscriptions; have to
          // subscribe to all events, and then filter
          const canIgnore =
            event.storageArea !== localStorage || event.key !== key;
          if (canIgnore) {
            return;
          }

          // Using slightly wonkier syntax to force type narrowing on the values
          // so that the main check condition doesn't have to deal with nulls
          if (event.oldValue === null || event.newValue === null) {
            if (event.oldValue !== event.newValue) {
              notifyReact();
            }
            return;
          }

          try {
            const oldParsed = JSON.parse(event.oldValue);
            const newParsed = JSON.parse(event.newValue);
            if (!deepEqual(oldParsed, newParsed)) {
              notifyReact();
            }
          } catch (err) {
            setLatestError(err as Error);
          }
        };

        window.addEventListener("storage", onStorageUpdate);
        return () => window.removeEventListener("storage", onStorageUpdate);
      },
      [key, localStorage],
    );

    const readFromLocalStorage = (): T | null => {
      const payload = localStorage.getItem(key);
      if (payload === null) {
        return null;
      }

      try {
        const parsed = JSON.parse(payload) as T;
        return parsed;
      } catch {
        /**
         * @todo Figure out if there's a good way to surface these errors to the
         * rest of the hook. The state getter must be pure, so you can't call
         * state setters from here. Exposing the error as a value might require
         * refactoring all the state to live outside React.
         */
        return null;
      }
    };

    const storageState = useSyncExternalStore(
      subscribeToLocalStorage,
      readFromLocalStorage,
    );

    const hookValue =
      storageState === null && fallbackValue !== undefined
        ? fallbackValue
        : storageState;

    // Using useEffectEvent to make the state setter mirror the behavior from
    // useState's state setter as closely as possible (namely, that the
    // function maintains a stable reference for the entire duration of the
    // component)
    const setLocalStorageValue: SetLocalStorageValue<T | null> = useEffectEvent(
      (payload) => {
        let newValue: T | null;
        if (typeof payload !== "function") {
          newValue = payload;
        } else {
          try {
            newValue = payload(hookValue);
          } catch (err) {
            setLatestError(err as Error);
            return;
          }
        }

        if (newValue === null && removeNullValues) {
          localStorage.removeItem(key);
          return;
        }

        try {
          const string = JSON.stringify(newValue);
          localStorage.setItem(key, string);
        } catch (err) {
          setLatestError(err as Error);
        }
      },
    );

    // It's generally a really bad idea to have an effect that only runs on
    // mount without resolving the reactivity properly, but I didn't want to add
    // the overhead of useEffectEvent for one-time logic
    useEffect(() => {
      const canSyncOnMount =
        syncFallbackOnMount &&
        storageState === null &&
        fallbackValue !== undefined;
      if (!canSyncOnMount) {
        return;
      }

      try {
        const string = JSON.stringify(fallbackValue);
        localStorage.setItem(key, string);
      } catch (err) {
        setLatestError(err as Error);
      }
    }, []);

    return [hookValue, setLocalStorageValue, latestError];
  }

  return useLocalStorage;
}

export const useLocalStorage = createUseLocalStorage(window.localStorage);
