-- CreateTable
CREATE TABLE `tarifas_base` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `categoria_id` INTEGER NOT NULL,
    `valor_diaria` DECIMAL(10, 2) NOT NULL,
    `valor_semanal` DECIMAL(10, 2) NULL,
    `valor_mensal` DECIMAL(10, 2) NULL,
    `vigencia_inicio` DATE NOT NULL,
    `vigencia_fim` DATE NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `tarifas_base_categoria_id_ativo_vigencia_inicio_vigencia_fim_idx`(`categoria_id`, `ativo`, `vigencia_inicio`, `vigencia_fim`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `custos_precificacao_veiculo` (
    `veiculo_id` INTEGER NOT NULL,
    `custo_capital_mensal` DECIMAL(12, 2) NULL,
    `ipva_anual` DECIMAL(12, 2) NULL,
    `seguro_anual` DECIMAL(12, 2) NULL,
    `licenciamento_anual` DECIMAL(12, 2) NULL,
    `manutencao_por_km` DECIMAL(10, 4) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`veiculo_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configuracoes_precificacao` (
    `id` INTEGER NOT NULL DEFAULT 1,
    `ocupacao_alvo_percentual` DECIMAL(5, 2) NULL,
    `margem_desejada_percentual` DECIMAL(5, 2) NULL,
    `custo_administrativo_mensal` DECIMAL(12, 2) NULL,
    `km_medio_diario` SMALLINT UNSIGNED NULL,
    `limpeza_por_locacao` DECIMAL(10, 2) NULL,
    `dias_medios_locacao` SMALLINT UNSIGNED NULL,
    `comissao_percentual` DECIMAL(5, 2) NULL,
    `taxa_pagamento_percentual` DECIMAL(5, 2) NULL,
    `valor_km_excedente` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `taxa_reposicao_combustivel` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `taxa_combustivel_por_litro` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `taxa_limpeza` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `taxa_aeroporto` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `taxa_outra_filial` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `taxa_entrega_domicilio_fixa` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `taxa_entrega_por_km` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `atraso_tolerancia_minutos` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    `atraso_valor_hora_percentual` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `atraso_limite_horas_vira_diaria` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `multa_cancelamento_percentual` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxa_admin_multa_transito` DECIMAL(8, 2) NOT NULL DEFAULT 0,
    `iss_percentual` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `taxa_cartao_percentual` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `parcelamento_max` TINYINT UNSIGNED NOT NULL DEFAULT 1,
    `parcelamento_juros_percentual` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `preco_minimo_margem_percentual` DECIMAL(5, 2) NULL,
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `precos_piso_categoria` (
    `categoria_id` INTEGER NOT NULL,
    `preco_piso_categoria` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`categoria_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `regras_preco` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(80) NOT NULL,
    `tipo` ENUM('sazonalidade', 'dia_semana', 'antecedencia', 'ocupacao', 'duracao') NOT NULL,
    `categoria_id` INTEGER NULL,
    `data_inicio` DATE NULL,
    `data_fim` DATE NULL,
    `dias_semana` JSON NULL,
    `antecedencia_min_dias` SMALLINT UNSIGNED NULL,
    `antecedencia_max_dias` SMALLINT UNSIGNED NULL,
    `ocupacao_min_percentual` DECIMAL(5, 2) NULL,
    `duracao_min_diarias` SMALLINT UNSIGNED NULL,
    `tipo_ajuste` ENUM('percentual', 'valor_fixo') NOT NULL,
    `valor_ajuste` DECIMAL(10, 2) NOT NULL,
    `prioridade` TINYINT UNSIGNED NOT NULL DEFAULT 0,
    `acumulavel` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `regras_preco_ativo_tipo_categoria_id_idx`(`ativo`, `tipo`, `categoria_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `adicionais` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(80) NOT NULL,
    `tipo_cobranca` ENUM('por_diaria', 'por_locacao') NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `valor_maximo_locacao` DECIMAL(10, 2) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `protecoes_preco` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `protecao_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NULL,
    `valor_diaria` DECIMAL(10, 2) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `protecoes_preco_protecao_id_categoria_id_ativo_idx`(`protecao_id`, `categoria_id`, `ativo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convenios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(80) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `convenios_nome_key`(`nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `promocoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo_cupom` VARCHAR(30) NOT NULL,
    `descricao` VARCHAR(120) NOT NULL,
    `tipo_desconto` ENUM('percentual', 'valor_fixo') NOT NULL,
    `valor_desconto` DECIMAL(10, 2) NOT NULL,
    `vigencia_inicio` DATE NOT NULL,
    `vigencia_fim` DATE NOT NULL,
    `limite_usos_total` INTEGER UNSIGNED NULL,
    `limite_usos_por_cliente` SMALLINT UNSIGNED NULL,
    `usos_realizados` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    `categoria_id` INTEGER NULL,
    `convenio_id` INTEGER NULL,
    `acumulavel` BOOLEAN NOT NULL DEFAULT false,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `promocoes_codigo_cupom_key`(`codigo_cupom`),
    INDEX `promocoes_ativo_vigencia_inicio_vigencia_fim_idx`(`ativo`, `vigencia_inicio`, `vigencia_fim`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usos_promocao` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `promocao_id` INTEGER NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `locacao_id` INTEGER NOT NULL,
    `desconto_aplicado` DECIMAL(12, 2) NOT NULL,
    `usado_em` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `usos_promocao_locacao_id_key`(`locacao_id`),
    INDEX `usos_promocao_promocao_id_usuario_id_idx`(`promocao_id`, `usuario_id`),
    UNIQUE INDEX `usos_promocao_promocao_id_usuario_id_locacao_id_key`(`promocao_id`, `usuario_id`, `locacao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `niveis_fidelidade` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(40) NOT NULL,
    `locacoes_minimas` SMALLINT UNSIGNED NOT NULL,
    `desconto_percentual` DECIMAL(5, 2) NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `niveis_fidelidade_locacoes_minimas_key`(`locacoes_minimas`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `historico_tarifas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tabela_origem` VARCHAR(40) NOT NULL,
    `registro_id` INTEGER UNSIGNED NOT NULL,
    `campo` VARCHAR(40) NOT NULL,
    `valor_anterior` VARCHAR(100) NULL,
    `valor_novo` VARCHAR(100) NULL,
    `usuario_id` INTEGER NOT NULL,
    `alterado_em` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `historico_tarifas_tabela_origem_registro_id_alterado_em_idx`(`tabela_origem`, `registro_id`, `alterado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `locacao_precos` (
    `locacao_id` INTEGER NOT NULL,
    `valor_diaria_aplicada` DECIMAL(10, 2) NOT NULL,
    `qtd_diarias` SMALLINT UNSIGNED NOT NULL,
    `subtotal_diarias` DECIMAL(12, 2) NOT NULL,
    `total_adicionais` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `total_protecoes` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `desconto_total` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `impostos_taxas` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `valor_total` DECIMAL(12, 2) NOT NULL,
    `regras_aplicadas` JSON NOT NULL,
    `promocao_id` INTEGER NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`locacao_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `tarifas_base` ADD CONSTRAINT `tarifas_base_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `custos_precificacao_veiculo` ADD CONSTRAINT `custos_precificacao_veiculo_veiculo_id_fkey` FOREIGN KEY (`veiculo_id`) REFERENCES `Veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `precos_piso_categoria` ADD CONSTRAINT `precos_piso_categoria_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `regras_preco` ADD CONSTRAINT `regras_preco_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `protecoes_preco` ADD CONSTRAINT `protecoes_preco_protecao_id_fkey` FOREIGN KEY (`protecao_id`) REFERENCES `protecoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `protecoes_preco` ADD CONSTRAINT `protecoes_preco_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promocoes` ADD CONSTRAINT `promocoes_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `promocoes` ADD CONSTRAINT `promocoes_convenio_id_fkey` FOREIGN KEY (`convenio_id`) REFERENCES `convenios`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usos_promocao` ADD CONSTRAINT `usos_promocao_promocao_id_fkey` FOREIGN KEY (`promocao_id`) REFERENCES `promocoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usos_promocao` ADD CONSTRAINT `usos_promocao_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usos_promocao` ADD CONSTRAINT `usos_promocao_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `Locacao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `historico_tarifas` ADD CONSTRAINT `historico_tarifas_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locacao_precos` ADD CONSTRAINT `locacao_precos_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `Locacao`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `locacao_precos` ADD CONSTRAINT `locacao_precos_promocao_id_fkey` FOREIGN KEY (`promocao_id`) REFERENCES `promocoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
