import { useRef, type MutableRefObject } from "react";

export function useLatestRef<T>(value: T): MutableRefObject<T> {
  const valueRef = useRef(value);
  valueRef.current = value;
  return valueRef;
}