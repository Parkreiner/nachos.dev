import type { FC } from "react";
import { useLocalStorage } from "./useLocalStorage";

export const Test: FC = () => {
  const [neat, setNeat] = useLocalStorage({
    key: "neat",
    syncFallbackOnMount: true,
    fallbackValue: {
      blah: true,
    },
  });
};
