/* eslint-disable @typescript-eslint/no-explicit-any */
import { evaluate } from "mathjs";
import { Field } from "../../Form";

export class Calculator {
  async calculate(field: Field, values: Record<string, any>): Promise<any> {
    if (!field.formula || !field.dependencias)
      throw new Error("campo calculado invalido");

    const scope = field.dependencias.reduce((acc, dep) => {
      acc[dep] = values[dep];
      return acc;
    }, {} as Record<string, any>);

    try {
      const result = evaluate(field.formula, scope);
      if (field.precisao !== undefined && typeof result === "number") {
        return Number(result.toFixed(field.precisao));
      }
      return result;
    } catch (error) {
      throw new Error(`avaliação de formula falhou: ${field.formula}`);
    }
  }
}
