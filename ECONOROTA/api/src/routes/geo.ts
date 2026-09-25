import { Hono } from 'hono';

import { badRequest, notFound, ApiError } from '../lib/errors';
import type { AppEnv } from '../lib/types';

type Place = { zip: string | null; street: string; district: string; city: string; state: string; lat?: number; lng?: number };

const UF: Record<string, string> = {
  Acre: 'AC', Alagoas: 'AL', Amapá: 'AP', Amazonas: 'AM', Bahia: 'BA', Ceará: 'CE', 'Distrito Federal': 'DF',
  'Espírito Santo': 'ES', Goiás: 'GO', Maranhão: 'MA', 'Mato Grosso': 'MT', 'Mato Grosso do Sul': 'MS',
  'Minas Gerais': 'MG', Pará: 'PA', Paraíba: 'PB', Paraná: 'PR', Pernambuco: 'PE', Piauí: 'PI', 'Rio de Janeiro': 'RJ',
  'Rio Grande do Norte': 'RN', 'Rio Grande do Sul': 'RS', Rondônia: 'RO', Roraima: 'RR', 'Santa Catarina': 'SC',
  'São Paulo': 'SP', Sergipe: 'SE', Tocantins: 'TO',
};

const geo = new Hono<AppEnv>();

/** Endereço pelo CEP (ViaCEP, gratuito). Resposta em cache por 7 dias. */
geo.get('/cep/:cep', async (c) => {
  const cep = c.req.param('cep').replace(/\D/g, '');
  if (cep.length !== 8) throw badRequest('CEP inválido.', 'validation');
  const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { cf: { cacheTtl: 604800, cacheEverything: true } });
  if (!res.ok) throw new ApiError(502, 'geo_unavailable', 'Serviço de CEP indisponível. Tente novamente.');
  const j = (await res.json()) as Record<string, string | boolean>;
  if (j.erro) throw notFound('CEP não encontrado.');
  const place: Place = {
    zip: cep,
    street: String(j.logradouro ?? ''),
    district: String(j.bairro ?? ''),
    city: String(j.localidade ?? ''),
    state: String(j.uf ?? ''),
  };
  // Coordenadas aproximadas (para distância até os mercados). Falha aqui não impede o CEP.
  try {
    const query = [place.street, place.city, place.state, 'Brasil'].filter(Boolean).join(', ');
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`,
      {
        headers: { 'User-Agent': c.env.GEOCODER_USER_AGENT ?? 'EconoRota/1.0 (contato@econorota.app)' },
        cf: { cacheTtl: 604800, cacheEverything: true },
      },
    );
    const hits = geoRes.ok ? ((await geoRes.json()) as { lat: string; lon: string }[]) : [];
    if (hits[0]) {
      place.lat = Math.round(Number(hits[0].lat) * 1e4) / 1e4;
      place.lng = Math.round(Number(hits[0].lon) * 1e4) / 1e4;
    }
  } catch {
    // Sem coordenadas: a lista de mercados aparece sem distância.
  }
  return c.json({ place }, 200, { 'Cache-Control': 'public, max-age=86400' });
});

/** Endereço aproximado a partir do GPS. Coordenadas arredondadas (~11 m) por privacidade e cache. */
geo.get('/reverse', async (c) => {
  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw badRequest('Coordenadas inválidas.', 'validation');
  }
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=pt-BR&lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': c.env.GEOCODER_USER_AGENT ?? 'EconoRota/1.0 (contato@econorota.app)' },
    cf: { cacheTtl: 86400, cacheEverything: true },
  });
  if (!res.ok) throw new ApiError(502, 'geo_unavailable', 'Não foi possível obter seu endereço. Digite o CEP.');
  const j = (await res.json()) as { address?: Record<string, string> };
  const a = j.address;
  if (!a) throw notFound('Endereço não encontrado para esta localização.');
  const place: Place = {
    zip: (a.postcode ?? '').replace(/\D/g, '') || null,
    street: a.road ?? a.pedestrian ?? '',
    district: a.suburb ?? a.neighbourhood ?? a.quarter ?? '',
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? '',
    state: UF[a.state ?? ''] ?? (a['ISO3166-2-lvl4'] ?? '').replace('BR-', ''),
    lat,
    lng,
  };
  return c.json({ place });
});

export default geo;
