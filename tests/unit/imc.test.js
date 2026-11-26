import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularIMC, classificarIMC } from '../../src/imc.js';

test('80 kg e 2 m resultam em IMC 20', () => {
  assert.equal(calcularIMC(80, 2), 20);
});
test('arredonda antes de classificar', () => {
  assert.equal(calcularIMC(99.99, 2), 25);
});
for (const [peso, altura] of [[80, 0], [0, 2], [-1, 2], ['80', 2],
  [Infinity, 2], [601, 2], [80, 2.71], [80, 0.49], [80, NaN]]) {
  test(`rejeita ${peso} kg / ${altura} m`, () => {
    assert.throws(() => calcularIMC(peso, altura), RangeError);
  });
}
for (const [imc, esperado] of [
  [18.49, 'Abaixo do peso'], [18.5, 'Peso adequado'],
  [24.99, 'Peso adequado'], [25, 'Sobrepeso'],
  [29.99, 'Sobrepeso'], [30, 'Obesidade grau I'],
  [34.99, 'Obesidade grau I'], [35, 'Obesidade grau II'],
  [39.99, 'Obesidade grau II'], [40, 'Obesidade grau III']
]) {
  test(`classificação no limite ${imc}`, () => {
    assert.equal(classificarIMC(imc), esperado);
  });
}
