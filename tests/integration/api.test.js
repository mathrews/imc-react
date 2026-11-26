import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import handler from '../../api/imc.js';

async function comServidor(executar) {
  const servidor = createServer((req, res) => {
    if (req.url === '/api/imc') return handler(req, res);
    res.statusCode = 404;
    res.end();
  });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  try {
    await executar(`http://127.0.0.1:${servidor.address().port}`);
  } finally {
    await new Promise((resolve, reject) => {
      servidor.close(erro => erro ? reject(erro) : resolve());
    });
  }
}

function post(base, dados) {
  return fetch(`${base}/api/imc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  });
}

test('HTTP 200: cálculo e classificação', async () => {
  await comServidor(async base => {
    const resposta = await post(base, { peso: 80, altura: 2 });
    assert.equal(resposta.status, 200);
    assert.deepEqual(await resposta.json(), { imc: 20, situacao: 'Peso adequado' });
  });
});
test('HTTP 400: altura zero', async () => {
  await comServidor(async base => {
    const resposta = await post(base, { peso: 80, altura: 0 });
    assert.equal(resposta.status, 400);
    assert.match((await resposta.json()).erro, /válidos/);
  });
});
test('HTTP 405: método GET não permitido', async () => {
  await comServidor(async base => {
    const resposta = await fetch(`${base}/api/imc`);
    assert.equal(resposta.status, 405);
    assert.equal(resposta.headers.get('allow'), 'POST');
  });
});
test('HTTP 400: JSON malformado', async () => {
  await comServidor(async base => {
    const resposta = await fetch(`${base}/api/imc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{'
    });
    assert.equal(resposta.status, 400);
  });
});
