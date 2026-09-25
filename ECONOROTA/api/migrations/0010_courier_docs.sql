-- Entregador: no lugar da foto do veículo, o documento do veículo (CRLV) — exigido só para moto e carro.
-- Moto/carro: CNH (documento com foto) + CRLV. Bicicleta: documento com foto (RG ou CNH).
ALTER TABLE couriers ADD COLUMN vehicle_doc_key TEXT;
