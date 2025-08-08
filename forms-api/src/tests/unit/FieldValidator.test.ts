/* eslint-disable @typescript-eslint/no-explicit-any */
import { Field } from "../../core/domain/entities/Form";
import { FieldValidator } from "../../core/domain/ports/FieldValidator";

describe("FieldValidator", () => {
  const validator = new FieldValidator();

  it("deve validar campo de texto com obrigatoriedade e regex", async () => {
    const field: Field = {
      id: "name",
      label: "Name",
      tipo: "text",
      obrigatorio: true,
      validacoes: [
        {
          tipo: "tamanho_minimo",
          valor: 5,
          mensagem: "Nome deve ter pelo menos 5 caracteres",
        },
        {
          tipo: "regex",
          valor: /^[A-Z].*/,
          mensagem: "Deve começar com letra maiúscula",
        },
      ],
    };

    await expect(
      validator.validate("John Doe", field)
    ).resolves.toBeUndefined();
    await expect(validator.validate("john", field)).rejects.toThrow(
      "Nome deve ter pelo menos 5 caracteres"
    );
    await expect(validator.validate("12345", field)).rejects.toThrow(
      "Deve começar com letra maiúscula"
    );
    await expect(validator.validate(undefined, field)).rejects.toThrow(
      "Campo obrigatório"
    );
  });

  it("deve validar campo de texto opcional", async () => {
    const field: Field = {
      id: "name",
      label: "Name",
      tipo: "text",
      obrigatorio: false,
      validacoes: [
        {
          tipo: "tamanho_minimo",
          valor: 5,
          mensagem: "Nome deve ter pelo menos 5 caracteres",
        },
      ],
    };

    await expect(validator.validate(undefined, field)).resolves.toBeUndefined();
    await expect(
      validator.validate("John Doe", field)
    ).resolves.toBeUndefined();
    await expect(validator.validate("John", field)).rejects.toThrow(
      "Nome deve ter pelo menos 5 caracteres"
    );
  });

  it("deve validar campo numérico", async () => {
    const field: Field = {
      id: "age",
      label: "Age",
      tipo: "number",
      formato: "inteiro",
      obrigatorio: true,
      validacoes: [
        { tipo: "minimo", valor: 18, mensagem: "Idade mínima é 18" },
        { tipo: "maximo", valor: 65, mensagem: "Idade máxima é 65" },
      ],
    };

    await expect(validator.validate(30, field)).resolves.toBeUndefined();
    await expect(validator.validate(17, field)).rejects.toThrow(
      "Idade mínima é 18"
    );
    await expect(validator.validate(66, field)).rejects.toThrow(
      "Idade máxima é 65"
    );
    await expect(validator.validate(30.5, field)).rejects.toThrow(
      "Esperado um número inteiro"
    );
  });

  it("deve validar campo booleano", async () => {
    const field: Field = {
      id: "active",
      label: "Active",
      tipo: "boolean",
      obrigatorio: true,
    };

    await expect(validator.validate(true, field)).resolves.toBeUndefined();
    await expect(validator.validate(undefined, field)).rejects.toThrow(
      "Campo obrigatório"
    );
  });

  it("deve validar campo de data com intervalo", async () => {
    const field: Field = {
      id: "birthdate",
      label: "Birthdate",
      tipo: "date",
      obrigatorio: true,
      minima: "2000-01-01T00:00:00.000Z",
      maxima: "2025-12-31T23:59:59.000Z",
    };

    await expect(
      validator.validate("2020-01-01T00:00:00.000Z", field)
    ).resolves.toBeUndefined();
    await expect(
      validator.validate("1999-12-31T23:59:59.000Z", field)
    ).rejects.toThrow("Data deve ser após 2000-01-01T00:00:00.000Z");
    await expect(
      validator.validate("2026-01-01T00:00:00.000Z", field)
    ).rejects.toThrow("Data deve ser antes 2025-12-31T23:59:59.000Z");
  });

  it("deve validar campo de data opcional", async () => {
    const field: Field = {
      id: "birthdate",
      label: "Birthdate",
      tipo: "date",
      obrigatorio: false,
      minima: "2000-01-01T00:00:00.000Z",
    };

    await expect(validator.validate(undefined, field)).resolves.toBeUndefined();
    await expect(
      validator.validate("2020-01-01T00:00:00.000Z", field)
    ).resolves.toBeUndefined();
    await expect(
      validator.validate("1999-12-31T23:59:59.000Z", field)
    ).rejects.toThrow("Data deve ser após 2000-01-01T00:00:00.000Z");
  });

  it("deve validar campo de seleção única", async () => {
    const field: Field = {
      id: "sexo",
      label: "Sexo",
      tipo: "select",
      obrigatorio: true,
      opcoes: [
        { label: "Masculino", value: "masculino" },
        { label: "Feminino", value: "feminino" },
      ],
    };

    await expect(
      validator.validate("masculino", field)
    ).resolves.toBeUndefined();
    await expect(validator.validate("outro", field)).rejects.toThrow(
      "Opção inválida"
    );
    await expect(validator.validate(undefined, field)).rejects.toThrow(
      "Esperado string, recebido indefinido"
    );
  });

  it("deve validar campo de seleção múltipla", async () => {
    const field: Field = {
      id: "hobbies",
      label: "Hobbies",
      tipo: "select",
      multipla: true,
      obrigatorio: true,
      opcoes: [
        { label: "Reading", value: "reading" },
        { label: "Sports", value: "sports" },
      ],
    };

    await expect(
      validator.validate(["reading", "sports"], field)
    ).resolves.toBeUndefined();
    await expect(
      validator.validate(["reading", "invalid"], field)
    ).rejects.toThrow("Opção inválida");

    await expect(validator.validate([], field)).rejects.toThrow(
      "Array deve conter pelo menos 1 elemento(s)"
    );
  });

  it("deve validar campo calculado", async () => {
    const field: Field = {
      id: "imc",
      label: "IMC",
      tipo: "calculated",
      formula: "peso / (altura/100)^2",
      dependencias: ["peso", "altura"],
    };

    await expect(validator.validate(undefined, field)).resolves.toBeUndefined();
    await expect(validator.validate(24.5, field)).rejects.toThrow(
      "Campos calculados não podem ter valores inseridos manualmente"
    );
    const invalidField: Field = {
      id: "imc",
      label: "IMC",
      tipo: "calculated",
    };
    await expect(validator.validate(undefined, invalidField)).rejects.toThrow(
      "Campo calculado deve ter formula e dependencias"
    );
  });

  it("deve lançar erro para tipo de campo não suportado", async () => {
    const field: Field = {
      id: "invalid",
      label: "Invalid",
      tipo: "invalid" as any,
    };
    await expect(validator.validate("value", field)).rejects.toThrow(
      "Unsupported field type: invalid"
    );
  });
});
