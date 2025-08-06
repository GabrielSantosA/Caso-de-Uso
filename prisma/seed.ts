/* eslint-disable quotes */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  await prisma.form.create({
    data: {
      id: "formulario_001",
      nome: "Ficha de Admissão",
      descricao: "Formulário de onboarding",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [
        {
          id: "nome_completo",
          label: "Nome completo",
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
              valor: "^[A-Z][a-z]+( [A-Z][a-z]+)*$",
              mensagem: "Nome inválido",
            },
          ],
        },
        {
          id: "idade",
          label: "Idade",
          tipo: "number",
          formato: "inteiro",
          obrigatorio: true,
          validacoes: [
            { tipo: "minimo", valor: 18, mensagem: "Idade mínima é 18" },
            { tipo: "maximo", valor: 65, mensagem: "Idade máxima é 65" },
          ],
        },
        {
          id: "peso",
          label: "Peso (kg)",
          tipo: "number",
          formato: "decimal",
          validacoes: [
            { tipo: "minimo", valor: 30, mensagem: "Peso mínimo é 30kg" },
          ],
        },
        {
          id: "altura",
          label: "Altura (cm)",
          tipo: "number",
          formato: "decimal",
          validacoes: [
            { tipo: "minimo", valor: 100, mensagem: "Altura mínima é 100cm" },
          ],
        },
        {
          id: "imc",
          label: "IMC",
          tipo: "calculated",
          formula: "peso / (altura/100)^2",
          dependencias: ["peso", "altura"],
          precisao: 2,
        },
      ],
    },
  });

  await prisma.form.create({
    data: {
      id: "formulario_002",
      nome: "Avaliação de Saúde",
      descricao: "Formulário para triagem médica",
      schema_version: 1,
      is_ativo: true,
      data_criacao: new Date(),
      protegido: false,
      campos: [
        {
          id: "altura",
          label: "Altura (cm)",
          tipo: "number",
          formato: "decimal",
          validacoes: [
            { tipo: "minimo", valor: 100, mensagem: "Altura mínima é 100cm" },
          ],
        },
        {
          id: "peso",
          label: "Peso (kg)",
          tipo: "number",
          formato: "decimal",
          validacoes: [
            { tipo: "minimo", valor: 30, mensagem: "Peso mínimo é 30kg" },
          ],
        },
        {
          id: "sexo",
          label: "Sexo",
          tipo: "select",
          opcoes: [
            { label: "Masculino", value: "masculino" },
            { label: "Feminino", value: "feminino" },
          ],
          obrigatorio: true,
        },
        {
          id: "gravidez",
          label: "Está grávida?",
          tipo: "boolean",
          condicional: "sexo == 'feminino'",
          obrigatorio: true,
        },
        {
          id: "imc",
          label: "IMC",
          tipo: "calculated",
          formula: "peso / (altura/100)^2",
          dependencias: ["peso", "altura"],
          precisao: 2,
        },
        {
          id: "classificacao",
          label: "Classificação de Risco",
          tipo: "calculated",
          formula:
            "if imc > 30 then 'Obesidade' else if imc > 25 then 'Sobrepeso' else 'Normal'",
          dependencias: ["imc"],
        },
      ],
    },
  });
}

seed().finally(() => prisma.$disconnect());
