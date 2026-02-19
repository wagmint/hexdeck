"use client";

import { createContext, useContext, useMemo } from "react";
import type { Operator } from "../types";

interface OperatorContextValue {
  operators: Operator[];
  getOperator: (operatorId: string) => Operator | undefined;
  isMultiOperator: boolean;
}

const OperatorContext = createContext<OperatorContextValue>({
  operators: [],
  getOperator: () => undefined,
  isMultiOperator: false,
});

export function OperatorProvider({
  operators,
  children,
}: {
  operators: Operator[];
  children: React.ReactNode;
}) {
  const value = useMemo<OperatorContextValue>(() => {
    const map = new Map(operators.map((op) => [op.id, op]));
    return {
      operators,
      getOperator: (id: string) => map.get(id),
      isMultiOperator: operators.length > 1,
    };
  }, [operators]);

  return (
    <OperatorContext.Provider value={value}>
      {children}
    </OperatorContext.Provider>
  );
}

export function useOperators() {
  return useContext(OperatorContext);
}
