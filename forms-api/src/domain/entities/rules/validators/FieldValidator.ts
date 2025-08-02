/* eslint-disable indent */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { Field } from "../../Form";
import { ValidatorStrategy } from "./Validator";

export class FieldValidator implements ValidatorStrategy {
  async validate(value: any, field: Field): Promise<void> {
    switch (field.tipo) {
      case "text":
        await this.validateText(value, field);
        break;
      case "number":
        await this.validateNumber(value, field);
        break;
      case "boolean":
        await this.validateBoolean(value, field);
        break;
      case "date":
        await this.validateDate(value, field);
        break;
      case "select":
        await this.validateSelect(value, field);
        break;
      case "calculated":
        await this.validateCalculated(value, field);
        break;
      default:
        throw new Error(`Unsupported field type: ${field.tipo}`);
    }
  }

  private async validateText(value: any, field: Field): Promise<void> {
    let schema: z.ZodString = z.string();

    const minLengthValidation = field.validacoes?.find(
      (v: { tipo: string }) => v.tipo === "tamanho_minimo"
    );
    if (minLengthValidation) {
      schema = schema.min(minLengthValidation.valor, {
        message:
          minLengthValidation.mensagem ||
          `Tamanho mínimo é ${minLengthValidation.valor}`,
      });
    }

    if (field.obrigatorio) {
      schema = schema.min(1, { message: "Campo obrigatório" });
    }

    const regexValidation = field.validacoes?.find(
      (v: { tipo: string }) => v.tipo === "regex"
    );
    if (regexValidation) {
      const regex = new RegExp(regexValidation.valor);
      schema = schema.regex(regex, {
        message: regexValidation.mensagem || "Formato inválido",
      });
    }

    await schema.parseAsync(value);
  }

  private async validateNumber(value: any, field: Field): Promise<void> {
    let schema: z.ZodNumber =
      field.formato === "inteiro" ? z.number().int() : z.number();

    if (field.obrigatorio) {
      schema = schema.min(0, { message: "Campo obrigatório" });
    }

    if (field.validacoes) {
      for (const v of field.validacoes) {
        if (v.tipo === "minimo") {
          schema = schema.min(v.valor, {
            message: v.mensagem || `Valor mínimo é ${v.valor}`,
          });
        }
        if (v.tipo === "maximo") {
          schema = schema.max(v.valor, {
            message: v.mensagem || `Valor máximo é ${v.valor}`,
          });
        }
      }
    }

    await schema.parseAsync(value);
  }

  private async validateBoolean(value: any, field: Field): Promise<void> {
    const schema = field.obrigatorio
      ? z.boolean({ required_error: "Campo obrigatório" })
      : z.boolean().optional();
    await schema.parseAsync(value);
  }

  private async validateDate(value: any, field: Field): Promise<void> {
    const baseSchema = z.string().refine(
      (val) => {
        if (!val) return !field.obrigatorio;
        return !isNaN(Date.parse(val));
      },
      { message: "Data inválida" }
    );

    const schema = field.obrigatorio ? baseSchema : baseSchema.optional();

    const withMin = field.minima
      ? schema.refine(
          (val) => !val || new Date(val) >= new Date(field.minima!),
          { message: `Data deve ser após ${field.minima}` }
        )
      : schema;

    const withMax = field.maxima
      ? withMin.refine(
          (val) => !val || new Date(val) <= new Date(field.maxima!),
          { message: `Data deve ser antes ${field.maxima}` }
        )
      : withMin;

    await withMax.parseAsync(value);
  }

  private async validateSelect(value: any, field: Field): Promise<void> {
    const options = field.opcoes?.map((opt: { value: any }) => opt.value) || [];

    const baseSchema = field.multipla
      ? z
          .array(z.string())
          .refine((vals) => vals.every((val) => options.includes(val)), {
            message: "Opção inválida",
          })
      : z.string().refine((val) => options.includes(val), {
          message: "Opção inválida",
        });

    const schema = field.obrigatorio ? baseSchema : baseSchema.optional();

    await schema.parseAsync(value);
  }

  private async validateCalculated(value: any, field: Field): Promise<void> {
    if (value !== undefined) {
      throw new Error(
        "Campos calculados não podem ter valores inseridos manualmente"
      );
    }
    if (!field.formula || !field.dependencias) {
      throw new Error("campo calculado deve ter formula e dependencias");
    }
  }
}
