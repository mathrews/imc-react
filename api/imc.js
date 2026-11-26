import { processarIMC } from '../src/handle-imc.js';

function responder(res, status, corpo) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(corpo));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return responder(res, 405, { erro: 'Método não permitido' });
  }
  try {
    let dados = req.body;
    if (dados === undefined) {
      let tamanho = 0;
      const partes = [];
      for await (const parte of req) {
        const buffer = Buffer.from(parte);
        tamanho += buffer.length;
        if (tamanho > 10000) {
          return responder(res, 413, { erro: 'Corpo muito grande' });
        }
        partes.push(buffer);
      }
      dados = Buffer.concat(partes).toString('utf8');
    }
    if (Buffer.isBuffer(dados)) dados = dados.toString('utf8');
    if (typeof dados === 'string') dados = JSON.parse(dados);
    const resultado = processarIMC(dados);
    return responder(res, resultado.status, resultado.corpo);
  } catch (erro) {
    if (erro instanceof SyntaxError) {
      return responder(res, 400, { erro: 'JSON inválido' });
    }
    return responder(res, 500, { erro: 'Erro interno' });
  }
}
