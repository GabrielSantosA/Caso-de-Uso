/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable indent */
import { z } from "zod";
import { ValidatorStrategy } from "../../infra/adapters/validators/Validator";
import { Field } from "../entities/Form";

export class FieldValidator implements ValidatorStrategy {
  private baseValidators: Record<string, z.ZodTypeAny> = {
    text: z.string(),
    number: z.number(),
    boolean: z.boolean(),
    date: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Data inválida",
    }),
    select: z.string(),
    calculated: z.undefined(),
  };

  async validate(value: any, field: Field): Promise<void> {
    const validator = this.getValidator(field);
    await validator.parseAsync(value);
  }

  private getValidator(field: Field): z.ZodTypeAny {
    let schema = this.baseValidators[field.tipo] || z.any();

    if (!field.obrigatorio) {
      schema = schema.optional();
    }

    switch (field.tipo) {
      case "text":
        return this.applyTextValidations(schema as z.ZodString, field);
      case "number":
        return this.applyNumberValidations(schema as z.ZodNumber, field);
      case "boolean":
        return schema;
      case "date":
        return this.applyDateValidations(schema as z.ZodString, field);
      case "select":
        return this.applySelectValidations(schema as z.ZodString, field);
      case "calculated":
        return this.applyCalculatedValidations(schema as z.ZodUndefined, field);
      default:
        throw new Error(`Unsupported field type: ${field.tipo}`);
    }
  }

  private applyTextValidations(
    schema: z.ZodString,
    field: Field
  ): z.ZodTypeAny {
    const minLength = field.validacoes?.find(
      (v) => v.tipo === "tamanho_minimo"
    );
    if (minLength?.valor && typeof minLength.valor === "number") {
      schema = schema.min(minLength.valor, {
        message: minLength.mensagem || `Tamanho mínimo é ${minLength.valor}`,
      });
    }

    const regex = field.validacoes?.find((v) => v.tipo === "regex");
    if (regex?.valor && regex.valor instanceof RegExp) {
      schema = schema.regex(regex.valor, {
        message: regex.mensagem || "Formato inválido",
      });
    }

    return schema;
  }

  private applyNumberValidations(
    schema: z.ZodNumber,
    field: Field
  ): z.ZodTypeAny {
    if (field.formato === "inteiro") schema = schema.int();
    field.validacoes?.forEach((v) => {
      if (
        v.tipo === "minimo" &&
        v.valor != null &&
        typeof v.valor === "number"
      ) {
        schema = schema.min(v.valor, {
          message: v.mensagem || `Valor mínimo é ${v.valor}`,
        });
      }
      if (
        v.tipo === "maximo" &&
        v.valor != null &&
        typeof v.valor === "number"
      ) {
        schema = schema.max(v.valor, {
          message: v.mensagem || `Valor máximo é ${v.valor}`,
        });
      }
    });
    return schema;
  }

  private applyDateValidations(
    schema: z.ZodTypeAny,
    field: Field
  ): z.ZodTypeAny {
    if (field.minima) {
      schema = (schema as z.ZodString).refine(
        (val) => !val || new Date(val) >= new Date(field.minima!),
        { message: `Data deve ser após ${field.minima}` }
      );
    }
    if (field.maxima) {
      schema = (schema as z.ZodString).refine(
        (val) => !val || new Date(val) <= new Date(field.maxima!),
        { message: `Data deve ser antes ${field.maxima}` }
      );
    }
    return schema;
  }

  private applySelectValidations(
    schema: z.ZodString,
    field: Field
  ): z.ZodTypeAny {
    const options = field.opcoes?.map((opt) => opt.value) || [];
    return field.multipla
      ? z
          .array(z.string())
          .refine((vals) => vals.every((val) => options.includes(val)), {
            message: "Opção inválida",
          })
      : schema.refine((val) => options.includes(val), {
          message: "Opção inválida",
        });
  }

  private applyCalculatedValidations(
    schema: z.ZodUndefined,
    field: Field
  ): z.ZodTypeAny {
    if (!field.formula || !field.dependencias) {
      throw new Error("Campo calculado deve ter formula e dependencias");
    }
    return schema.refine((value) => value === undefined, {
      message: "Campos calculados não podem ter valores inseridos manualmente",
    });
  }
}
