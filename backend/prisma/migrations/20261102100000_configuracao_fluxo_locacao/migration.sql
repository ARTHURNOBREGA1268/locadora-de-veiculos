-- Usa VARCHAR temporário porque MySQL compara valores de ENUM sem distinção de maiúsculas/minúsculas
-- sob o collation padrão, o que torna FINALIZADA e finalizada valores duplicados.
ALTER TABLE `Locacao`
  MODIFY `status` VARCHAR(20) NOT NULL DEFAULT 'reservada';

UPDATE `Locacao`
SET `status` = CASE
  WHEN `status` = 'ATIVA' AND `dataInicio` > CURRENT_TIMESTAMP THEN 'reservada'
  WHEN `status` = 'ATIVA' THEN 'em_andamento'
  WHEN `status` = 'FINALIZADA' THEN 'finalizada'
  ELSE `status`
END;

ALTER TABLE `Locacao`
  MODIFY `status` ENUM('reservada','retirada','em_andamento','devolvida','finalizada','cancelada') NOT NULL DEFAULT 'reservada';

CREATE TABLE `configuracoes_locacao` (
  `id` INTEGER NOT NULL DEFAULT 1,
  `periodo_minimo_diarias` TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `periodo_maximo_diarias` SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  `horario_retirada_padrao` TIME NOT NULL DEFAULT '09:00:00',
  `horario_devolucao_padrao` TIME NOT NULL DEFAULT '09:00:00',
  `tolerancia_atraso_minutos` SMALLINT UNSIGNED NOT NULL DEFAULT 30,
  `antecedencia_minima_horas` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `antecedencia_maxima_dias` SMALLINT UNSIGNED NOT NULL DEFAULT 365,
  `cancelamento_prazo_horas` SMALLINT UNSIGNED NOT NULL DEFAULT 24,
  `cancelamento_multa_percentual` DECIMAL(5,2) NOT NULL DEFAULT 0,
  `idade_minima` TINYINT UNSIGNED NOT NULL DEFAULT 21,
  `tempo_minimo_cnh_meses` SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  `documentos_exigidos` JSON NOT NULL,
  `exige_cartao_credito` BOOLEAN NOT NULL DEFAULT true,
  `permite_motorista_adicional` BOOLEAN NOT NULL DEFAULT false,
  `max_motoristas_adicionais` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `km_livre` BOOLEAN NOT NULL DEFAULT true,
  `km_franquia_diaria` INT UNSIGNED NULL,
  `politica_combustivel` ENUM('mesmo_nivel','cobrar_reposicao','tanque_cheio_pre_pago') NOT NULL DEFAULT 'mesmo_nivel',
  `permite_devolucao_outra_filial` BOOLEAN NOT NULL DEFAULT false,
  `permite_entrega_domicilio` BOOLEAN NOT NULL DEFAULT false,
  `permite_retirada_aeroporto` BOOLEAN NOT NULL DEFAULT false,
  `raio_entrega_km` SMALLINT UNSIGNED NULL,
  `protecao_basica_inclusa` BOOLEAN NOT NULL DEFAULT true,
  `exige_vistoria_saida` BOOLEAN NOT NULL DEFAULT true,
  `exige_vistoria_entrada` BOOLEAN NOT NULL DEFAULT true,
  `modelo_contrato` LONGTEXT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`)
);

INSERT INTO `configuracoes_locacao` (`id`, `documentos_exigidos`)
VALUES (1, JSON_ARRAY('CNH válida', 'Documento de identidade'));

CREATE TABLE `protecoes` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(80) NOT NULL,
  `descricao` TEXT NULL,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`)
);

CREATE TABLE `config_protecoes` (
  `config_id` INTEGER NOT NULL,
  `protecao_id` INTEGER NOT NULL,
  `selecionada` BOOLEAN NOT NULL DEFAULT false,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`config_id`, `protecao_id`),
  CONSTRAINT `config_protecoes_config_fk` FOREIGN KEY (`config_id`) REFERENCES `configuracoes_locacao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `config_protecoes_protecao_fk` FOREIGN KEY (`protecao_id`) REFERENCES `protecoes` (`id`) ON DELETE RESTRICT
);

CREATE TABLE `config_filiais` (
  `config_id` INTEGER NOT NULL,
  `filial_id` INTEGER NOT NULL,
  `tipo` ENUM('retirada','devolucao') NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`config_id`, `filial_id`, `tipo`),
  CONSTRAINT `config_filiais_config_fk` FOREIGN KEY (`config_id`) REFERENCES `configuracoes_locacao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `config_filiais_filial_fk` FOREIGN KEY (`filial_id`) REFERENCES `filiais` (`id`) ON DELETE RESTRICT
);

CREATE TABLE `checklist_itens` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `config_id` INTEGER NOT NULL,
  `descricao` VARCHAR(120) NOT NULL,
  `obrigatorio` BOOLEAN NOT NULL DEFAULT true,
  `ordem` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `ativo` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`id`),
  INDEX `checklist_itens_config_ordem_idx` (`config_id`, `ordem`),
  CONSTRAINT `checklist_config_fk` FOREIGN KEY (`config_id`) REFERENCES `configuracoes_locacao` (`id`) ON DELETE CASCADE
);

CREATE TABLE `franquias_categoria` (
  `config_id` INTEGER NOT NULL,
  `categoria_id` INTEGER NOT NULL,
  `valor` DECIMAL(10,2) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`config_id`, `categoria_id`),
  CONSTRAINT `franquia_config_fk` FOREIGN KEY (`config_id`) REFERENCES `configuracoes_locacao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `franquia_categoria_fk` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo` (`id`) ON DELETE RESTRICT
);

CREATE TABLE `caucoes_categoria` (
  `config_id` INTEGER NOT NULL,
  `categoria_id` INTEGER NOT NULL,
  `valor` DECIMAL(10,2) NOT NULL,
  `created_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
  `updated_at` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0) ON UPDATE CURRENT_TIMESTAMP(0),
  PRIMARY KEY (`config_id`, `categoria_id`),
  CONSTRAINT `caucao_config_fk` FOREIGN KEY (`config_id`) REFERENCES `configuracoes_locacao` (`id`) ON DELETE CASCADE,
  CONSTRAINT `caucao_categoria_fk` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_veiculo` (`id`) ON DELETE RESTRICT
);
