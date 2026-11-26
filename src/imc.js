export function calcularIMC(peso, altura) {
  if (!Number.isFinite(peso) || !Number.isFinite(altura) ||
      peso <= 0 || peso > 600 || altura < 0.5 || altura > 2.7) {
    throw new RangeError('Informe peso e altura válidos (altura em metros).');
  }
  return Number((peso / (altura * altura)).toFixed(2));
}

export function classificarIMC(imc) {
  if (!Number.isFinite(imc) || imc < 0) throw new RangeError('IMC inválido');
  if (imc < 18.5) return 'Abaixo do peso';
  if (imc < 25) return 'Peso adequado';
  if (imc < 30) return 'Sobrepeso';
  if (imc < 35) return 'Obesidade grau I';
  if (imc < 40) return 'Obesidade grau II';
  return 'Obesidade grau III';
}
