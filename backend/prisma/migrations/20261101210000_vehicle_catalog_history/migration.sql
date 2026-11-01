CREATE TABLE `categorias_veiculo` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(50) NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `categorias_veiculo_nome_key` (`nome`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `filiais` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(80) NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `filiais_nome_key` (`nome`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `opcionais_veiculo` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(80) NOT NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `opcionais_veiculo_nome_key` (`nome`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `categorias_veiculo` (`nome`, `created_at`, `updated_at`) VALUES
  ('Econômico', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('SUV', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Executivo', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Utilitário', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Compacto', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Sedan', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Luxo', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0));

INSERT INTO `filiais` (`nome`, `created_at`, `updated_at`) VALUES
  ('Matriz', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0));

INSERT INTO `opcionais_veiculo` (`nome`, `created_at`, `updated_at`) VALUES
  ('Ar-condicionado', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Direção elétrica', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Câmbio automático', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Multimídia', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Bluetooth', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Câmera de ré', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Sensor de estacionamento', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Vidros elétricos', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0)),
  ('Trava elétrica', CURRENT_TIMESTAMP(0), CURRENT_TIMESTAMP(0));

ALTER TABLE `Veiculo`
  ADD COLUMN `ano_fabricacao` SMALLINT NULL,
  ADD COLUMN `ano_modelo` SMALLINT NULL,
  ADD COLUMN `apolice_franquia` DECIMAL(10,2) NULL,
  ADD COLUMN `apolice_numero` VARCHAR(40) NULL,
  ADD COLUMN `apolice_vencimento` DATE NULL,
  ADD COLUMN `cambio` ENUM('manual','automatico') NOT NULL DEFAULT 'manual',
  ADD COLUMN `capacidade_porta_malas` SMALLINT UNSIGNED NULL,
  ADD COLUMN `categoria_id` INTEGER NULL,
  ADD COLUMN `chassi` VARCHAR(17) NULL,
  ADD COLUMN `combustivel` ENUM('gasolina','etanol','flex','diesel','eletrico','hibrido') NOT NULL DEFAULT 'flex',
  ADD COLUMN `cor` VARCHAR(30) NULL,
  ADD COLUMN `created_at` TIMESTAMP(0) NULL,
  ADD COLUMN `crlv_vencimento` DATE NULL,
  ADD COLUMN `data_compra` DATE NULL,
  ADD COLUMN `filial_id` INTEGER NULL,
  ADD COLUMN `forma_aquisicao` ENUM('a_vista','financiado','leasing') NULL,
  ADD COLUMN `ipva_vencimento` DATE NULL,
  ADD COLUMN `km_atual` INTEGER UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `licenciamento_vencimento` DATE NULL,
  ADD COLUMN `motor` VARCHAR(20) NULL,
  ADD COLUMN `nivel_combustivel` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ADD COLUMN `num_passageiros` TINYINT UNSIGNED NULL,
  ADD COLUMN `num_portas` TINYINT UNSIGNED NULL,
  ADD COLUMN `proxima_revisao_data` DATE NULL,
  ADD COLUMN `proxima_revisao_km` INTEGER UNSIGNED NULL,
  ADD COLUMN `renavam` VARCHAR(11) NULL,
  ADD COLUMN `seguradora` VARCHAR(80) NULL,
  ADD COLUMN `status` ENUM('disponivel','alugado','reservado','manutencao','inativo') NOT NULL DEFAULT 'inativo',
  ADD COLUMN `updated_at` TIMESTAMP(0) NULL,
  ADD COLUMN `valor_compra` DECIMAL(12,2) NULL,
  ADD COLUMN `valor_fipe` DECIMAL(12,2) NULL,
  ADD COLUMN `valor_revenda_estimado` DECIMAL(12,2) NULL,
  ADD COLUMN `versao` VARCHAR(80) NULL,
  ADD COLUMN `vida_util_meses` SMALLINT UNSIGNED NULL,
  MODIFY `marca` VARCHAR(50) NOT NULL,
  MODIFY `modelo` VARCHAR(80) NOT NULL,
  MODIFY `placa` VARCHAR(8) NOT NULL,
  MODIFY `valorDiaria` DECIMAL(10,2) NOT NULL DEFAULT 0;

UPDATE `Veiculo` AS v
SET v.`ano_fabricacao` = COALESCE(v.`ano`, 2000),
    v.`ano_modelo` = COALESCE(v.`ano`, 2000),
    v.`categoria_id` = (SELECT c.`id` FROM `categorias_veiculo` AS c WHERE c.`nome` = 'Econômico'),
    v.`filial_id` = (SELECT f.`id` FROM `filiais` AS f WHERE f.`nome` = 'Matriz'),
    v.`status` = CASE
      WHEN EXISTS (SELECT 1 FROM `Locacao` AS l WHERE l.`veiculoId` = v.`id` AND l.`status` = 'ATIVA' AND l.`dataInicio` > CURRENT_TIMESTAMP(0)) THEN 'reservado'
      WHEN EXISTS (SELECT 1 FROM `Locacao` AS l WHERE l.`veiculoId` = v.`id` AND l.`status` = 'ATIVA') THEN 'alugado'
      WHEN v.`disponivel` = 1 THEN 'disponivel'
      ELSE 'inativo'
    END,
    v.`created_at` = CURRENT_TIMESTAMP(0),
    v.`updated_at` = CURRENT_TIMESTAMP(0);

ALTER TABLE `Veiculo`
  MODIFY `ano_fabricacao` SMALLINT NOT NULL DEFAULT 2000,
  MODIFY `ano_modelo` SMALLINT NOT NULL DEFAULT 2000,
  MODIFY `categoria_id` INTEGER NOT NULL,
  MODIFY `filial_id` INTEGER NOT NULL,
  MODIFY `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  MODIFY `updated_at` TIMESTAMP(0) NOT NULL,
  DROP COLUMN `ano`,
  DROP COLUMN `disponivel`;

CREATE TABLE `veiculo_opcionais` (
  `veiculo_id` INTEGER NOT NULL,
  `opcional_id` INTEGER NOT NULL,
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  UNIQUE INDEX `veiculo_opcionais_veiculo_id_opcional_id_key` (`veiculo_id`, `opcional_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `manutencoes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `veiculo_id` INTEGER NOT NULL,
  `data` DATE NOT NULL,
  `tipo` VARCHAR(50) NOT NULL,
  `descricao` TEXT NULL,
  `valor` DECIMAL(10,2) NULL,
  `km` INTEGER UNSIGNED NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  INDEX `manutencoes_veiculo_id_idx` (`veiculo_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `sinistros_avarias` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `veiculo_id` INTEGER NOT NULL,
  `data` DATE NOT NULL,
  `descricao` TEXT NOT NULL,
  `valor_reparo` DECIMAL(10,2) NULL,
  `status` ENUM('aberto','em_andamento','resolvido') NOT NULL DEFAULT 'aberto',
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  INDEX `sinistros_avarias_veiculo_id_idx` (`veiculo_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `multas` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `veiculo_id` INTEGER NOT NULL,
  `data` DATETIME(3) NOT NULL,
  `infracao` VARCHAR(120) NOT NULL,
  `valor` DECIMAL(10,2) NOT NULL,
  `status` ENUM('pendente','paga','contestada') NOT NULL DEFAULT 'pendente',
  `locacao_id` INTEGER NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  INDEX `multas_veiculo_id_idx` (`veiculo_id`),
  INDEX `multas_locacao_id_idx` (`locacao_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `vistorias` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `veiculo_id` INTEGER NOT NULL,
  `data` DATETIME(3) NOT NULL,
  `tipo` ENUM('saida','entrada') NOT NULL,
  `km` INTEGER UNSIGNED NOT NULL,
  `nivel_combustivel` TINYINT UNSIGNED NOT NULL,
  `observacoes` TEXT NULL,
  `locacao_id` INTEGER NULL,
  `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` TIMESTAMP(0) NOT NULL,
  INDEX `vistorias_veiculo_id_idx` (`veiculo_id`),
  INDEX `vistorias_locacao_id_idx` (`locacao_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `Veiculo_renavam_key` ON `Veiculo` (`renavam`);
CREATE UNIQUE INDEX `Veiculo_chassi_key` ON `Veiculo` (`chassi`);
CREATE INDEX `Veiculo_categoria_id_idx` ON `Veiculo` (`categoria_id`);
CREATE INDEX `Veiculo_filial_id_idx` ON `Veiculo` (`filial_id`);

ALTER TABLE `Veiculo` ADD CONSTRAINT `Veiculo_categoria_id_fkey`
  FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Veiculo` ADD CONSTRAINT `Veiculo_filial_id_fkey`
  FOREIGN KEY (`filial_id`) REFERENCES `filiais` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `veiculo_opcionais` ADD CONSTRAINT `veiculo_opcionais_veiculo_id_fkey`
  FOREIGN KEY (`veiculo_id`) REFERENCES `Veiculo` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `veiculo_opcionais` ADD CONSTRAINT `veiculo_opcionais_opcional_id_fkey`
  FOREIGN KEY (`opcional_id`) REFERENCES `opcionais_veiculo` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `manutencoes` ADD CONSTRAINT `manutencoes_veiculo_id_fkey`
  FOREIGN KEY (`veiculo_id`) REFERENCES `Veiculo` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `sinistros_avarias` ADD CONSTRAINT `sinistros_avarias_veiculo_id_fkey`
  FOREIGN KEY (`veiculo_id`) REFERENCES `Veiculo` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `multas` ADD CONSTRAINT `multas_veiculo_id_fkey`
  FOREIGN KEY (`veiculo_id`) REFERENCES `Veiculo` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `multas` ADD CONSTRAINT `multas_locacao_id_fkey`
  FOREIGN KEY (`locacao_id`) REFERENCES `Locacao` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `vistorias` ADD CONSTRAINT `vistorias_veiculo_id_fkey`
  FOREIGN KEY (`veiculo_id`) REFERENCES `Veiculo` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `vistorias` ADD CONSTRAINT `vistorias_locacao_id_fkey`
  FOREIGN KEY (`locacao_id`) REFERENCES `Locacao` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
