/* eslint-disable @typescript-eslint/no-explicit-any */
import { evaluate } from "mathjs";
import { Field } from "../../domain/entities/Form";

export class Calculator {
  async calculate(field: Field, values: Record<string, any>): Promise<any> {
    if (!field.formula || !field.dependencias) {
      throw new Error(
        `Campo calculado '${field.id}' requer fórmula e dependências`
      );
    }
    const missingDeps = field.dependencias.filter((dep) => !(dep in values));
    if (missingDeps.length > 0) {
      throw new Error(
        `Dependências ausentes para ${field.id}: ${missingDeps.join(", ")}`
      );
    }
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
      throw new Error(`avaliação da formula falhou: ${field.formula}`);
    }
  }
}
