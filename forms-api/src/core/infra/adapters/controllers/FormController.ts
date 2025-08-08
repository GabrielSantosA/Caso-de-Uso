/* eslint-disable indent */
import { Request, Response } from "express";
import { inject, injectable } from "tsyringe";
import { z } from "zod";
import { FormService } from "../../../app/use-cases/FormService";
import { Form } from "../../../domain/entities/Form";

@injectable()
export class FormController {
  constructor(
    @inject("FormService") private readonly formService: FormService
  ) {}

  private readonly idSchema = z
    .string()
    .regex(/^[a-z0-9_-]+$/i)
    .min(1)
    .max(50);

  private readonly fieldSchema = z.object({
    id: this.idSchema,
    label: z.string().min(1).max(100),
    tipo: z.enum(["text", "number", "boolean", "select", "date", "calculated"]),
    obrigatorio: z.boolean().optional(),
    condicional: z.string().optional(),
    validacoes: z
      .array(
        z.object({
          tipo: z.string().min(1),
          valor: z.any().optional(),
          mensagem: z.string().optional(),
        })
      )
      .optional(),
    formula: z.string().optional(),
    dependencias: z.array(this.idSchema).optional(),
    precisao: z.number().int().min(0).max(10).optional(),
    formato: z.enum(["inteiro", "decimal"]).optional(),
    multipla: z.boolean().optional(),
    opcoes: z
      .array(
        z.object({
          label: z.string().min(1),
          value: z.string().min(1),
        })
      )
      .optional(),
    minima: z.string().optional(),
    maxima: z.string().optional(),
  });

  private readonly formSchema = z.object({
    nome: z.string().min(1).max(100),
    descricao: z.string().max(500).optional(),
    protegido: z.boolean().optional(),
    campos: z.array(this.fieldSchema).min(1).max(100),
  });

  private readonly paginationSchema = z.object({
    pagina: z.preprocess(
      (val) => Number(val),
      z.number().int().min(1).default(1)
    ),
    tamanho_pagina: z.preprocess(
      (val) => Number(val),
      z.number().int().min(1).max(100).default(20)
    ),
  });

  private handleError(
    res: Response,
    error: unknown,
    defaultMessage: string,
    statusCode = 400
  ) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
        ? error
        : defaultMessage;

    res.status(statusCode).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * @swagger
   * /formularios:
   *   post:
   *     summary: Cria um novo formulário
   *     tags: [Formulários]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Form'
   *     responses:
   *       201:
   *         description: Formulário criado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Form'
   *       400:
   *         description: Erro de validação
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       500:
   *         description: Erro interno
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async create(req: Request, res: Response) {
    try {
      const validatedData = await this.formSchema.parseAsync(req.body);
      const form = await this.formService.criarFormulario(
        validatedData as Form
      );

      res.status(201).json({
        success: true,
        data: {
          id: form.id,
          nome: form.nome,
          schema_version: form.schema_version,
          criado_em: form.data_criacao.toISOString(),
        },
      });
    } catch (error) {
      this.handleError(res, error, "Erro ao criar formulário");
    }
  }

  /**
   * @swagger
   * /formularios:
   *   get:
   *     summary: Lista formulários com paginação
   *     tags: [Formulários]
   *     parameters:
   *       - $ref: '#/components/parameters/pagina'
   *       - $ref: '#/components/parameters/tamanho_pagina'
   *       - $ref: '#/components/parameters/nome'
   *       - $ref: '#/components/parameters/schema_version'
   *     responses:
   *       200:
   *         description: Lista de formulários
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/FormListResponse'
   *       400:
   *         description: Parâmetros inválidos
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async list(req: Request, res: Response) {
    try {
      const { pagina, tamanho_pagina } = await this.paginationSchema.parseAsync(
        req.query
      );
      const filters = {
        nome: z.string().optional().parse(req.query.nome),
        schema_version: z
          .number()
          .int()
          .optional()
          .parse(req.query.schema_version),
        incluirInativos: z
          .enum(["true", "false"])
          .transform((val) => val === "true")
          .optional()
          .parse(req.query.incluir_inativos),
      };

      const forms = await this.formService.listarFormularios({
        pagina,
        tamanho_pagina,
        ...filters,
      });

      res.status(200).json({
        success: true,
        data: {
          pagina,
          tamanho_pagina,
          total: forms.length,
          resultados: forms.map((form) => ({
            id: form.id,
            nome: form.nome,
            schema_version: form.schema_version,
            criado_em: form.data_criacao.toISOString(),
            is_ativo: form.is_ativo,
          })),
        },
      });
    } catch (error) {
      this.handleError(res, error, "Erro ao listar formulários");
    }
  }

  /**
   * @swagger
   * /formularios/{id}:
   *   get:
   *     summary: Obtém um formulário por ID
   *     tags: [Formulários]
   *     parameters:
   *       - $ref: '#/components/parameters/id'
   *     responses:
   *       200:
   *         description: Dados do formulário
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Form'
   *       404:
   *         description: Formulário não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async getById(req: Request, res: Response) {
    try {
      const { id } = await z
        .object({ id: this.idSchema })
        .parseAsync(req.params);
      const form = await this.formService.obterFormularioPorId(id);

      if (!form) {
        return res.status(404).json({
          success: false,
          error: "Formulário não encontrado",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          ...form,
          data_criacao: form.data_criacao.toISOString(),
          data_remocao: form.data_remocao?.toISOString(),
        },
      });
    } catch (error) {
      this.handleError(res, error, "Erro ao buscar formulário");
    }
  }

  /**
   * @swagger
   * /formularios/{id}:
   *   delete:
   *     summary: Desativa um formulário
   *     tags: [Formulários]
   *     parameters:
   *       - $ref: '#/components/parameters/id'
   *     responses:
   *       200:
   *         description: Formulário desativado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *       404:
   *         description: Formulário não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       403:
   *         description: Formulário protegido
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async softDelete(req: Request, res: Response) {
    try {
      const { id } = await z
        .object({ id: this.idSchema })
        .parseAsync(req.params);
      const form = await this.formService.obterFormularioPorId(id);

      if (!form) {
        return res.status(404).json({
          success: false,
          error: "Formulário não encontrado",
        });
      }

      if (form.protegido) {
        return res.status(403).json({
          success: false,
          error: "Formulário protegido não pode ser removido",
        });
      }

      await this.formService.desativarFormulario(id, "usuario_admin");
      res.status(200).json({ success: true });
    } catch (error) {
      this.handleError(res, error, "Erro ao desativar formulário");
    }
  }

  /**
   * @swagger
   * /formularios/{id}/schema_version:
   *   put:
   *     summary: Atualiza o schema de um formulário
   *     tags: [Formulários]
   *     parameters:
   *       - $ref: '#/components/parameters/id'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Form'
   *     responses:
   *       200:
   *         description: Schema atualizado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Form'
   *       400:
   *         description: Erro de validação
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Conflito na versão do schema
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async updateFormSchema(req: Request, res: Response) {
    try {
      const { id } = await z
        .object({ id: this.idSchema })
        .parseAsync(req.params);
      const updateData = await this.formSchema.partial().parseAsync(req.body);

      const form = await this.formService.atualizarSchemaFormulario(
        id,
        updateData
      );

      res.status(200).json({
        success: true,
        data: {
          id: form.id,
          schema_version: form.schema_version,
          atualizado_em: new Date().toISOString(),
        },
      });
    } catch (error) {
      const status =
        error instanceof Error && error.message.includes("Schema version")
          ? 409
          : 400;
      this.handleError(res, error, "Erro ao atualizar schema", status);
    }
  }

  /**
   * @swagger
   * /formularios/{id}/respostas:
   *   post:
   *     summary: Submete uma resposta
   *     tags: [Formulários]
   *     parameters:
   *       - $ref: '#/components/parameters/id'
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               schema_version:
   *                 type: integer
   *                 description: Versão do schema do formulário
   *               respostas:
   *                 type: object
   *                 additionalProperties: true
   *                 description: Objeto com as respostas dos campos
   *     responses:
   *       201:
   *         description: Resposta registrada com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                 schema_version:
   *                   type: integer
   *                 criado_em:
   *                   type: string
   *                   format: date-time
   *       400:
   *         description: Erro na validação da resposta
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Formulário não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       409:
   *         description: Versão do schema desatualizada
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async submitResponse(req: Request, res: Response) {
    try {
      const { id } = await z
        .object({ id: this.idSchema })
        .parseAsync(req.params);
      const { schema_version, respostas } = await z
        .object({
          schema_version: z.number().int().optional(),
          respostas: z.record(z.any()),
        })
        .parseAsync(req.body);

      const response = await this.formService.enviarResposta(
        id,
        respostas,
        schema_version
      );

      res.status(201).json({
        success: true,
        data: {
          id: response.id,
          schema_version: response.schema_version,
          criado_em: response.criado_em.toISOString(),
        },
      });
    } catch (error) {
      const status =
        error instanceof Error && error.message.includes("Schema version")
          ? 409
          : error instanceof Error && error.message.includes("não encontrado")
          ? 404
          : 400;
      this.handleError(res, error, "Erro ao enviar resposta", status);
    }
  }

  /**
   * @swagger
   * /formularios/{id}/respostas:
   *   get:
   *     summary: Lista respostas de um formulário
   *     tags: [Formulários]
   *     parameters:
   *       - $ref: '#/components/parameters/id'
   *       - $ref: '#/components/parameters/pagina'
   *       - $ref: '#/components/parameters/tamanho_pagina'
   *       - $ref: '#/components/parameters/schema_version'
   *     responses:
   *       200:
   *         description: Lista de respostas do formulário
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 pagina:
   *                   type: number
   *                 tamanho_pagina:
   *                   type: number
   *                 total:
   *                   type: number
   *                 resultados:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       id:
   *                         type: string
   *                       criado_em:
   *                         type: string
   *                         format: date-time
   *                       schema_version:
   *                         type: number
   *       400:
   *         description: Parâmetros de query inválidos
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       404:
   *         description: Formulário não encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async listResponses(req: Request, res: Response) {
    try {
      const { id } = await z
        .object({ id: this.idSchema })
        .parseAsync(req.params);
      const { pagina, tamanho_pagina } = await this.paginationSchema.parseAsync(
        req.query
      );
      const filters = {
        schema_version: z
          .number()
          .int()
          .optional()
          .parse(req.query.schema_version),
        incluir_inativos: z
          .enum(["true", "false"])
          .transform((val) => val === "true")
          .optional()
          .parse(req.query.incluir_inativos),
      };

      const responses = await this.formService.listarRespostas(id, {
        pagina,
        tamanho_pagina,
        filtros: filters,
      });

      res.status(200).json({
        success: true,
        data: {
          pagina,
          tamanho_pagina,
          total: responses.length,
          resultados: responses.map((response) => ({
            id: response.id,
            schema_version: response.schema_version,
            criado_em: response.criado_em.toISOString(),
            is_ativo: response.is_ativo,
          })),
        },
      });
    } catch (error) {
      const status =
        error instanceof Error && error.message.includes("não encontrado")
          ? 404
          : 400;
      this.handleError(res, error, "Erro ao listar respostas", status);
    }
  }

  /**
   * @swagger
   * /formularios/{id}/respostas/{respostaId}:
   *   delete:
   *     summary: Remove uma resposta específica de um formulário (soft delete)
   *     tags: [Formulários]
   *     parameters:
   *       - $ref: '#/components/parameters/id'
   *       - $ref: '#/components/parameters/respostaId'
   *     responses:
   *       200:
   *         description: Resposta marcada como inativa com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *       404:
   *         description: Resposta não encontrada
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       410:
   *         description: Resposta já está inativa
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  async softDeleteResponse(req: Request, res: Response) {
    try {
      const { id, respostaId } = await z
        .object({
          id: this.idSchema,
          respostaId: this.idSchema,
        })
        .parseAsync(req.params);

      await this.formService.desativarResposta(id, respostaId, "usuario_admin");
      res.status(200).json({ success: true });
    } catch (error) {
      const status =
        error instanceof Error && error.message.includes("inativa")
          ? 410
          : error instanceof Error && error.message.includes("não encontrada")
          ? 404
          : 400;
      this.handleError(res, error, "Erro ao desativar resposta", status);
    }
  }
}
