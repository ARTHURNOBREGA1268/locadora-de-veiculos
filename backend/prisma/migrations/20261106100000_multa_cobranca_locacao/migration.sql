ALTER TABLE `locacao_cobrancas_extras`
  ADD COLUMN `multa_id` INTEGER NULL;

CREATE UNIQUE INDEX `locacao_cobrancas_extras_multa_id_key`
  ON `locacao_cobrancas_extras`(`multa_id`);

ALTER TABLE `locacao_cobrancas_extras`
  ADD CONSTRAINT `locacao_cobrancas_extras_multa_id_fkey`
  FOREIGN KEY (`multa_id`) REFERENCES `multas`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
