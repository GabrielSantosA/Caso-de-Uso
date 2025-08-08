/*
  Warnings:

  - You are about to drop the `Form` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Response` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Response" DROP CONSTRAINT "Response_formId_fkey";

-- DropTable
DROP TABLE "Form";

-- DropTable
DROP TABLE "Response";

-- CreateTable
CREATE TABLE "forms" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "is_ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_remocao" TIMESTAMP(3),
    "usuario_remocao" TEXT,
    "protegido" BOOLEAN NOT NULL DEFAULT false,
    "campos" JSONB NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "responses" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL DEFAULT 1,
    "respostas" JSONB NOT NULL,
    "calculados" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_ativo" BOOLEAN NOT NULL DEFAULT true,
    "data_remocao" TIMESTAMP(3),
    "usuario_remocao" TEXT,

    CONSTRAINT "responses_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "responses" ADD CONSTRAINT "responses_formId_fkey" FOREIGN KEY ("formId") REFERENCES "forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
