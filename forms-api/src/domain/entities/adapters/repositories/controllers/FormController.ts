/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request, Response } from "express";
import { z } from "zod";
import { FormService } from "../../../app/services/FormService";

export class FormController {
  constructor(private formService: FormService) {}

  async create(req: Request, res: Response) {
    const schema = z.object({
      nome: z.string().max(255),
      descricao: z.string().max(500).optional(),
      campos: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9_]+$/),
            label: z.string(),
            tipo: z.enum([
              "text",
              "number",
              "boolean",
              "select",
              "date",
              "calculated",
            ]),
            obrigatorio: z.boolean().optional(),
            condicional: z.string().optional(),
            validacoes: z
              .array(
                z.object({
                  tipo: z.string(),
                  valor: z.any().optional(),
                  mensagem: z.string().optional(),
                })
              )
              .optional(),
            formula: z.string().optional(),
            dependencias: z.array(z.string()).optional(),
            precisao: z.number().optional(),
            formato: z.enum(["inteiro", "decimal"]).optional(),
            multipla: z.boolean().optional(),
            opcoes: z
              .array(z.object({ label: z.string(), value: z.string() }))
              .optional(),
            minima: z.string().optional(),
            maxima: z.string().optional(),
          })
        )
        .min(1)
        .max(100),
    });

    try {
      const data = await schema.parseAsync(req.body);
      const form = await this.formService.createForm(data as any);
      res.status(201).json({
        id: form.id,
        schema_version: form.schema_version,
        mensagem: "Formulário criado com sucesso",
        criado_em: form.data_criacao.toISOString(),
      });
    } catch (error) {
      let errorMessage = "Erro ao criar formulário";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      res
        .status(400)
        .json({ erro: "payload_invalido", mensagem: errorMessage });
    }
  }

  async list(req: Request, res: Response) {
    const schema = z.object({
      nome: z.string().optional(),
      schema_version: z.number().int().optional(),
      pagina: z.number().int().min(1).default(1),
      tamanho_pagina: z.number().int().min(1).max(100).default(20),
      ordenar_por: z.enum(["nome", "criado_em"]).optional(),
      ordem: z.enum(["asc", "desc"]).default("asc"),
      incluir_inativos: z.enum(["true", "false"]).default("false"),
    });

    try {
      const {
        nome,
        schema_version,
        pagina,
        tamanho_pagina,
        ordenar_por,
        ordem,
        incluir_inativos,
      } = await schema.parseAsync(req.query);

      const forms = await this.formService.listForms({
        nome,
        schema_version,
        page: pagina,
        pageSize: tamanho_pagina,
        incluirInativos: incluir_inativos === "true",
        ordenarPor: ordenar_por,
        ordem,
      });

      const total = forms.length;
      res.status(200).json({
        pagina_atual: pagina,
        total_paginas: Math.ceil(total / tamanho_pagina),
        total_itens: total,
        formularios: forms.map((form) => ({
          id: form.id,
          nome: form.nome,
          schema_version: form.schema_version,
          criado_em: form.data_criacao.toISOString(),
        })),
      });
    } catch (error) {
      let errorMessage = "Parâmetros inválidos";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      res
        .status(400)
        .json({ erro: "parametro_invalido", mensagem: errorMessage });
    }
  }

  async getById(req: Request, res: Response) {
    const schema = z.object({
      id: z.string().regex(/^[a-z0-9_]+$/),
    });

    try {
      const { id } = await schema.parseAsync(req.params);
      const form = await this.formService.getFormById(id);
      if (!form) {
        return res.status(404).json({
          erro: "formulario_nao_encontrado",
          mensagem: `O formulário com id '${id}' não foi localizado ou está inativo.`,
        });
      }
      res.status(200).json({
        id: form.id,
        nome: form.nome,
        descricao: form.descricao,
        schema_version: form.schema_version,
        criado_em: form.data_criacao.toISOString(),
        campos: form.campos,
        is_ativo: form.is_ativo,
        ...(form.is_ativo === false && {
          mensagem: `Este formulário foi removido em ${form.data_remocao?.toISOString()} por ${
            form.usuario_remocao
          }.`,
        }),
      });
    } catch (error) {
      let errorMessage = "ID inválido";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      res.status(422).json({ erro: "id_invalido", mensagem: errorMessage });
    }
  }

  async softDelete(req: Request, res: Response) {
    const schema = z.object({
      id: z.string().regex(/^[a-z0-9_]+$/),
    });

    try {
      const { id } = await schema.parseAsync(req.params);
      const form = await this.formService.getFormById(id);
      if (!form) {
        return res.status(404).json({
          erro: "formulario_nao_encontrado",
          mensagem: `Nenhum formulário com ID '${id}' foi encontrado.`,
        });
      }
      if (form.protegido) {
        return res.status(409).json({
          erro: "formulario_protegido",
          mensagem:
            "Este formulário é protegido e não pode ser removido manualmente.",
        });
      }
      if (!form.is_ativo) {
        return res.status(200).json({
          mensagem: `Formulário '${id}' já está removido.`,
          status: "soft_deleted",
        });
      }
      await this.formService.softDelete(id, "usuario_admin");
      res.status(200).json({
        mensagem: `Formulário '${id}' marcado como removido com sucesso.`,
        status: "soft_deleted",
      });
    } catch (error) {
      res.status(500).json({
        erro: "falha_remocao_logica",
        mensagem: "Erro interno ao marcar o formulário como removido.",
      });
    }
  }

  async updateFormSchema(req: Request, res: Response) {
    const schema = z.object({
      id: z.string().regex(/^[a-z0-9_]+$/),
      nome: z.string().max(255).optional(),
      descricao: z.string().max(500).optional(),
      campos: z
        .array(
          z.object({
            id: z.string().regex(/^[a-z0-9_]+$/),
            label: z.string(),
            tipo: z.enum([
              "text",
              "number",
              "boolean",
              "select",
              "date",
              "calculated",
            ]),
            obrigatorio: z.boolean().optional(),
            condicional: z.string().optional(),
            validacoes: z
              .array(
                z.object({
                  tipo: z.string(),
                  valor: z.any().optional(),
                  mensagem: z.string().optional(),
                })
              )
              .optional(),
            formula: z.string().optional(),
            dependencias: z.array(z.string()).optional(),
            precisao: z.number().optional(),
            formato: z.enum(["inteiro", "decimal"]).optional(),
            multipla: z.boolean().optional(),
            opcoes: z
              .array(z.object({ label: z.string(), value: z.string() }))
              .optional(),
            minima: z.string().optional(),
            maxima: z.string().optional(),
          })
        )
        .min(1)
        .max(100)
        .optional(),
    });

    try {
      const { id, ...data } = await schema.parseAsync({
        ...req.params,
        ...req.body,
      });
      const form = await this.formService.updateFormSchema(id, data as any);
      res.status(200).json({
        mensagem: "Versão atualizada com sucesso.",
        id: form.id,
        schema_version_anterior: form.schema_version - 1,
        schema_version_nova: form.schema_version,
        atualizado_em: new Date().toISOString(),
      });
    } catch (error) {
      let errorMessage = "Erro ao atualizar schema";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("Schema version")) {
          return res.status(422).json({
            erro: "schema_version_invalida",
            mensagem: error.message,
          });
        }
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      res.status(400).json({ erro: "schema_invalido", mensagem: errorMessage });
    }
  }

  async submitResponse(req: Request, res: Response) {
    const schema = z.object({
      id: z.string().regex(/^[a-z0-9_]+$/),
      schema_version: z.number().int().optional(),
      respostas: z.record(z.any()),
    });

    try {
      const { id, schema_version, respostas } = await schema.parseAsync({
        ...req.params,
        ...req.body,
      });
      const response = await this.formService.submitResponse(
        id,
        respostas,
        schema_version
      );
      res.status(201).json({
        mensagem: "Resposta registrada com sucesso.",
        id_resposta: response.id,
        calculados: response.calculados,
        executado_em: response.criado_em.toISOString(),
      });
    } catch (error) {
      let errorMessage = "Erro ao enviar resposta";
      if (error instanceof Error) {
        errorMessage = error.message;
        if (error.message.includes("Schema version")) {
          return res.status(409).json({
            erro: "schema_desatualizado",
            mensagem: error.message,
          });
        } else if (error.message.includes("Form not found")) {
          return res.status(404).json({
            erro: "formulario_nao_encontrado",
            mensagem: error.message,
          });
        }
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      res
        .status(400)
        .json({ erro: "validacao_falhou", mensagem: errorMessage });
    }
  }

  async listResponses(req: Request, res: Response) {
    const schema = z.object({
      id: z.string().regex(/^[a-z0-9_]+$/),
      pagina: z.number().int().min(1).default(1),
      tamanho_pagina: z.number().int().min(1).max(100).default(20),
      incluir_calculados: z.enum(["true", "false"]).default("true"),
      schema_version: z.number().int().optional(),
    });

    try {
      const { id, pagina, tamanho_pagina, incluir_calculados, schema_version } =
        await schema.parseAsync({ ...req.params, ...req.query });
      const responses = await this.formService.listFormResponses(id, {
        page: pagina,
        pageSize: tamanho_pagina,
        filters: {
          schema_version,
          incluir_calculados: incluir_calculados === "true",
        },
      });

      res.status(200).json({
        pagina,
        tamanho_pagina,
        total: responses.length,
        resultados: responses.map((response) => ({
          id_resposta: response.id,
          criado_em: response.criado_em.toISOString(),
          schema_version: response.schema_version,
          respostas: response.respostas,
          ...(incluir_calculados === "true" && {
            calculados: response.calculados,
          }),
        })),
      });
    } catch (error) {
      let errorMessage = "Parâmetros inválidos";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === "string") {
        errorMessage = error;
      }
      res
        .status(400)
        .json({ erro: "parametros_invalidos", mensagem: errorMessage });
    }
  }

  async softDeleteResponse(req: Request, res: Response) {
    const schema = z.object({
      id: z.string().regex(/^[a-z0-9_]+$/),
      id_resposta: z.string().regex(/^[a-z0-9_]+$/),
    });

    try {
      const { id, id_resposta } = await schema.parseAsync(req.params);
      const form = await this.formService.getFormById(id);
      if (!form || !form.is_ativo) {
        return res.status(403).json({
          erro: "formulario_inativo",
          mensagem: "Este formulário foi desativado e não permite alterações.",
        });
      }
      const response = await this.formService.listFormResponses(id, {
        page: 1,
        pageSize: 1,
        filters: { id: id_resposta },
      });
      if (!response.length) {
        return res.status(404).json({
          erro: "resposta_nao_encontrada",
          mensagem: `A resposta '${id_resposta}' não foi localizada.`,
        });
      }
      if (!response[0].is_ativo) {
        return res.status(410).json({
          erro: "resposta_ja_removida",
          mensagem: "A resposta já está inativa.",
        });
      }
      await this.formService.softDeleteResponse(
        id,
        id_resposta,
        "usuario_admin"
      );
      res.status(200).json({
        mensagem: `Resposta '${id_resposta}' marcada como inativa com sucesso.`,
        status: "soft_deleted",
      });
    } catch (error) {
      res.status(500).json({
        erro: "falha_remocao_logica",
        mensagem: "Erro interno ao marcar a resposta como removida.",
      });
    }
  }
}
