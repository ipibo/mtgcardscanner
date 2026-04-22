"use client";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface QuantityControlProps {
  id: string;
  quantity: number;
  onUpdate: (id: string, qty: number) => Promise<void>;
}

export function QuantityControl({ id, quantity, onUpdate }: QuantityControlProps) {
  const [pending, setPending] = useState(false);

  const change = async (delta: number) => {
    setPending(true);
    await onUpdate(id, quantity + delta);
    setPending(false);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7 text-base"
        disabled={pending}
        onClick={() => change(-1)}
        aria-label="Remove one"
      >
        −
      </Button>
      <span className="w-6 text-center text-sm font-medium tabular-nums">
        {quantity}
      </span>
      <Button
        size="icon"
        variant="outline"
        className="h-7 w-7 text-base"
        disabled={pending}
        onClick={() => change(1)}
        aria-label="Add one"
      >
        +
      </Button>
    </div>
  );
}
