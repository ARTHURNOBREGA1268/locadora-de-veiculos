-- Migração preservadora: cria Cliente, copia locações existentes para o novo modelo e troca as FKs sem descartar histórico.

-- A coluna usuario_id da locação legada é convertida em cliente_id por meio do vínculo Cliente.usuario_id.

ALTER TABLE `Locacao` DROP FOREIGN KEY `Locacao_usuarioId_fkey`;

ALTER TABLE `Locacao` DROP FOREIGN KEY `Locacao_veiculoId_fkey`;

ALTER TABLE `multas` DROP FOREIGN KEY `multas_locacao_id_fkey`;

ALTER TABLE `vistorias` DROP FOREIGN KEY `vistorias_locacao_id_fkey`;

ALTER TABLE `usos_promocao` DROP FOREIGN KEY `usos_promocao_usuario_id_fkey`;

ALTER TABLE `usos_promocao` DROP FOREIGN KEY `usos_promocao_locacao_id_fkey`;

ALTER TABLE `locacao_precos` DROP FOREIGN KEY `locacao_precos_locacao_id_fkey`;

DROP INDEX `usos_promocao_promocao_id_usuario_id_idx` ON `usos_promocao`;

DROP INDEX `usos_promocao_promocao_id_usuario_id_locacao_id_key` ON `usos_promocao`;

CREATE TABLE `clientes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(120) NOT NULL,
    `cpf` VARCHAR(11) NULL,
    `email` VARCHAR(191) NULL,
    `telefone` VARCHAR(30) NULL,
    `usuario_id` INTEGER NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `clientes_cpf_key`(`cpf`),
    UNIQUE INDEX `clientes_usuario_id_key`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `clientes` (`nome`, `email`, `usuario_id`, `ativo`, `created_at`, `updated_at`)
SELECT `nome`, `email`, `id`, `ativo`, `criadoEm`, `criadoEm`
FROM `Usuario`;

ALTER TABLE `usos_promocao` ADD COLUMN `cliente_id` INTEGER NULL;
UPDATE `usos_promocao` up
JOIN `clientes` c ON c.`usuario_id` = up.`usuario_id`
SET up.`cliente_id` = c.`id`;
ALTER TABLE `usos_promocao`
  MODIFY COLUMN `cliente_id` INTEGER NOT NULL,
  DROP COLUMN `usuario_id`;

CREATE TABLE `locacoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `codigo` VARCHAR(20) NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `veiculo_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NULL,
    `status` ENUM('reservada', 'retirada', 'em_andamento', 'devolvida', 'finalizada', 'cancelada') NOT NULL DEFAULT 'reservada',
    `origem` ENUM('balcao', 'site', 'telefone', 'app', 'convenio') NULL,
    `atendente_id` INTEGER NULL,
    `retirada_prevista` DATETIME(3) NOT NULL,
    `devolucao_prevista` DATETIME(3) NOT NULL,
    `retirada_real` DATETIME(3) NULL,
    `devolucao_real` DATETIME(3) NULL,
    `qtd_diarias_previstas` SMALLINT UNSIGNED NOT NULL,
    `qtd_diarias_cobradas` SMALLINT UNSIGNED NULL,
    `filial_retirada_id` INTEGER NULL,
    `filial_devolucao_id` INTEGER NULL,
    `entrega_domicilio` BOOLEAN NOT NULL DEFAULT false,
    `endereco_entrega` VARCHAR(255) NULL,
    `endereco_coleta` VARCHAR(255) NULL,
    `distancia_entrega_km` DECIMAL(6, 2) NULL,
    `voo_numero` VARCHAR(10) NULL,
    `km_saida` INTEGER UNSIGNED NULL,
    `km_entrada` INTEGER UNSIGNED NULL,
    `km_franquia_total` INTEGER UNSIGNED NULL,
    `km_excedente` INTEGER UNSIGNED NULL,
    `combustivel_saida` TINYINT UNSIGNED NULL,
    `combustivel_entrada` TINYINT UNSIGNED NULL,
    `valor_total` DECIMAL(12, 2) NOT NULL,
    `valor_final_cobrado` DECIMAL(12, 2) NULL,
    `caucao_valor` DECIMAL(10, 2) NULL,
    `caucao_status` ENUM('pendente', 'retida', 'liberada', 'utilizada') NOT NULL DEFAULT 'pendente',
    `forma_pagamento` ENUM('credito', 'debito', 'pix', 'boleto', 'dinheiro', 'faturado') NULL,
    `parcelas` TINYINT UNSIGNED NULL,
    `promocao_id` INTEGER NULL,
    `cancelada_em` DATETIME(3) NULL,
    `motivo_cancelamento` VARCHAR(255) NULL,
    `multa_cancelamento` DECIMAL(10, 2) NULL,
    `vistoria_saida_id` INTEGER NULL,
    `vistoria_entrada_id` INTEGER NULL,
    `contrato_texto` LONGTEXT NULL,
    `contrato_assinado` BOOLEAN NOT NULL DEFAULT false,
    `contrato_assinado_em` DATETIME(3) NULL,
    `observacoes` TEXT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `locacoes_codigo_key`(`codigo`),
    UNIQUE INDEX `locacoes_vistoria_saida_id_key`(`vistoria_saida_id`),
    UNIQUE INDEX `locacoes_vistoria_entrada_id_key`(`vistoria_entrada_id`),
    INDEX `locacoes_cliente_id_status_idx`(`cliente_id`, `status`),
    INDEX `locacoes_veiculo_id_status_retirada_prevista_devolucao_previ_idx`(`veiculo_id`, `status`, `retirada_prevista`, `devolucao_prevista`),
    INDEX `locacoes_categoria_id_idx`(`categoria_id`),
    INDEX `locacoes_atendente_id_idx`(`atendente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `locacoes` (
  `id`, `codigo`, `cliente_id`, `veiculo_id`, `categoria_id`, `status`, `origem`, `atendente_id`,
  `retirada_prevista`, `devolucao_prevista`, `retirada_real`, `devolucao_real`,
  `qtd_diarias_previstas`, `qtd_diarias_cobradas`, `filial_retirada_id`, `filial_devolucao_id`,
  `entrega_domicilio`, `endereco_entrega`, `endereco_coleta`, `distancia_entrega_km`, `voo_numero`,
  `km_saida`, `km_entrada`, `km_franquia_total`, `km_excedente`, `combustivel_saida`, `combustivel_entrada`,
  `valor_total`, `valor_final_cobrado`, `caucao_valor`, `caucao_status`, `forma_pagamento`, `parcelas`,
  `promocao_id`, `cancelada_em`, `motivo_cancelamento`, `multa_cancelamento`, `vistoria_saida_id`,
  `vistoria_entrada_id`, `contrato_texto`, `contrato_assinado`, `contrato_assinado_em`, `observacoes`,
  `created_at`, `updated_at`
)
SELECT
  l.`id`, CONCAT('LOC-', YEAR(l.`dataInicio`), '-', LPAD(l.`id`, 4, '0')), c.`id`, l.`veiculoId`, NULL,
  l.`status`, NULL, NULL, l.`dataInicio`, l.`dataPrevistaDevolucao`, NULL, l.`dataDevolucaoEfetiva`,
  GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, l.`dataInicio`, l.`dataPrevistaDevolucao`) / 86400)),
  CASE WHEN l.`dataDevolucaoEfetiva` IS NULL THEN NULL ELSE GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, l.`dataInicio`, l.`dataDevolucaoEfetiva`) / 86400)) END,
  NULL, NULL, FALSE, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
  l.`valorTotal`, NULL, p.`valor_caucao`, 'pendente', NULL, NULL, p.`promocao_id`, NULL, NULL, NULL, NULL, NULL,
  NULL, FALSE, NULL, NULL, CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)
FROM `Locacao` l
JOIN `clientes` c ON c.`usuario_id` = l.`usuarioId`
JOIN `Veiculo` v ON v.`id` = l.`veiculoId`
LEFT JOIN `locacao_precos` p ON p.`locacao_id` = l.`id`;

UPDATE `locacoes` l
JOIN (
  SELECT `locacao_id`, MIN(`id`) AS `vistoria_id`
  FROM `vistorias`
  WHERE `locacao_id` IS NOT NULL AND `tipo` = 'saida'
  GROUP BY `locacao_id`
) s ON s.`locacao_id` = l.`id`
JOIN `vistorias` v ON v.`id` = s.`vistoria_id`
SET l.`vistoria_saida_id` = v.`id`, l.`retirada_real` = v.`data`,
    l.`km_saida` = v.`km`, l.`combustivel_saida` = v.`nivel_combustivel`;

UPDATE `locacoes` l
JOIN (
  SELECT `locacao_id`, MIN(`id`) AS `vistoria_id`
  FROM `vistorias`
  WHERE `locacao_id` IS NOT NULL AND `tipo` = 'entrada'
  GROUP BY `locacao_id`
) s ON s.`locacao_id` = l.`id`
JOIN `vistorias` v ON v.`id` = s.`vistoria_id`
SET l.`vistoria_entrada_id` = v.`id`, l.`devolucao_real` = COALESCE(l.`devolucao_real`, v.`data`),
    l.`km_entrada` = v.`km`, l.`combustivel_entrada` = v.`nivel_combustivel`;

UPDATE `locacoes`
SET `qtd_diarias_cobradas` = GREATEST(1, CEIL(TIMESTAMPDIFF(SECOND, `retirada_prevista`, `devolucao_real`) / 86400))
WHERE `devolucao_real` IS NOT NULL;

CREATE TABLE `locacao_motoristas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locacao_id` INTEGER NOT NULL,
    `cliente_id` INTEGER NOT NULL,
    `principal` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `locacao_motoristas_cliente_id_idx`(`cliente_id`),
    UNIQUE INDEX `locacao_motoristas_locacao_id_cliente_id_key`(`locacao_id`, `cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `locacao_adicionais` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locacao_id` INTEGER NOT NULL,
    `adicional_id` INTEGER NOT NULL,
    `quantidade` SMALLINT UNSIGNED NOT NULL,
    `valor_unitario` DECIMAL(10, 2) NOT NULL,
    `valor_total` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `locacao_adicionais_locacao_id_adicional_id_key`(`locacao_id`, `adicional_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `locacao_protecoes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locacao_id` INTEGER NOT NULL,
    `protecao_id` INTEGER NOT NULL,
    `valor_diaria` DECIMAL(10, 2) NOT NULL,
    `valor_total` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    UNIQUE INDEX `locacao_protecoes_locacao_id_protecao_id_key`(`locacao_id`, `protecao_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `locacao_cobrancas_extras` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locacao_id` INTEGER NOT NULL,
    `tipo` ENUM('km_excedente', 'combustivel', 'limpeza', 'atraso', 'avaria', 'multa_transito', 'outros') NOT NULL,
    `descricao` VARCHAR(120) NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `locacao_cobrancas_extras_locacao_id_tipo_idx`(`locacao_id`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `locacao_pagamentos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locacao_id` INTEGER NOT NULL,
    `tipo` ENUM('reserva', 'caucao', 'saldo', 'estorno') NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('pendente', 'pago', 'falhou', 'estornado') NOT NULL DEFAULT 'pendente',
    `gateway_id` VARCHAR(80) NULL,
    `pago_em` DATETIME(3) NULL,
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `locacao_pagamentos_locacao_id_tipo_status_idx`(`locacao_id`, `tipo`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `locacao_status_historico` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `locacao_id` INTEGER NOT NULL,
    `status_anterior` VARCHAR(20) NOT NULL,
    `status_novo` VARCHAR(20) NOT NULL,
    `usuario_id` INTEGER NOT NULL,
    `alterado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` DATETIME(0) NOT NULL,

    INDEX `locacao_status_historico_locacao_id_alterado_em_idx`(`locacao_id`, `alterado_em`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP TABLE `Locacao`;

CREATE INDEX `usos_promocao_promocao_id_cliente_id_idx` ON `usos_promocao`(`promocao_id`, `cliente_id`);

CREATE UNIQUE INDEX `usos_promocao_promocao_id_cliente_id_locacao_id_key` ON `usos_promocao`(`promocao_id`, `cliente_id`, `locacao_id`);

ALTER TABLE `clientes` ADD CONSTRAINT `clientes_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_veiculo_id_fkey` FOREIGN KEY (`veiculo_id`) REFERENCES `Veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_atendente_id_fkey` FOREIGN KEY (`atendente_id`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_filial_retirada_id_fkey` FOREIGN KEY (`filial_retirada_id`) REFERENCES `filiais`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_filial_devolucao_id_fkey` FOREIGN KEY (`filial_devolucao_id`) REFERENCES `filiais`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_promocao_id_fkey` FOREIGN KEY (`promocao_id`) REFERENCES `promocoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_vistoria_saida_id_fkey` FOREIGN KEY (`vistoria_saida_id`) REFERENCES `vistorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacoes` ADD CONSTRAINT `locacoes_vistoria_entrada_id_fkey` FOREIGN KEY (`vistoria_entrada_id`) REFERENCES `vistorias`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `multas` ADD CONSTRAINT `multas_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `vistorias` ADD CONSTRAINT `vistorias_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `usos_promocao` ADD CONSTRAINT `usos_promocao_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `usos_promocao` ADD CONSTRAINT `usos_promocao_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_precos` ADD CONSTRAINT `locacao_precos_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_motoristas` ADD CONSTRAINT `locacao_motoristas_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_motoristas` ADD CONSTRAINT `locacao_motoristas_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `clientes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_adicionais` ADD CONSTRAINT `locacao_adicionais_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_adicionais` ADD CONSTRAINT `locacao_adicionais_adicional_id_fkey` FOREIGN KEY (`adicional_id`) REFERENCES `adicionais`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_protecoes` ADD CONSTRAINT `locacao_protecoes_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_protecoes` ADD CONSTRAINT `locacao_protecoes_protecao_id_fkey` FOREIGN KEY (`protecao_id`) REFERENCES `protecoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_cobrancas_extras` ADD CONSTRAINT `locacao_cobrancas_extras_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_pagamentos` ADD CONSTRAINT `locacao_pagamentos_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_status_historico` ADD CONSTRAINT `locacao_status_historico_locacao_id_fkey` FOREIGN KEY (`locacao_id`) REFERENCES `locacoes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `locacao_status_historico` ADD CONSTRAINT `locacao_status_historico_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `Usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
