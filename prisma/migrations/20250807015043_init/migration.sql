-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "schema_version" INTEGER NOT NULL,
    "is_ativo" BOOLEAN NOT NULL,
    "data_criacao" TIMESTAMP(3) NOT NULL,
    "data_remocao" TIMESTAMP(3),
    "usuario_remocao" TEXT,
    "protegido" BOOLEAN NOT NULL,
    "campos" JSONB NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Response" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "respostas" JSONB NOT NULL,
    "calculados" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL,
    "is_ativo" BOOLEAN NOT NULL,
    "data_remocao" TIMESTAMP(3),
    "usuario_remocao" TEXT,

    CONSTRAINT "Response_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
