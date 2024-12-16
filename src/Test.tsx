import { useState, type FC } from "react";
import { useLocalStorage } from "./useLocalStorage";

export const Test: FC = () => {
  const [x, setX] = useState(false);
  const [y, setY] = useState<boolean>(false);
  const [z, setZ] = useState<false>(false);

  const [experimentPrefs, setExperimentPrefs] = useLocalStorage({
    key: "experiment-preferences",
    syncFallbackOnMount: true,
    fallbackValue: {},
  });

  return null;
};

function identity<T>(value: T): T {
  return value;
}

const x = identity(false);

type Blah = string | number;
type Blah2 = {
  [El in `${Blah}-x`]: Blah;
};
