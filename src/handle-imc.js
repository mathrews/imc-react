import { calcularIMC, classificarIMC } from './imc.js';

export function processarIMC(dados) {
  try {
    const imc = calcularIMC(dados?.peso, dados?.altura);
    return { status: 200, corpo: { imc, situacao: classificarIMC(imc) } };
  } catch (erro) {
    if (erro instanceof RangeError) {
      return { status: 400, corpo: { erro: erro.message } };
    }
    throw erro;
  }
}
