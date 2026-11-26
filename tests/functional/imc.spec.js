import { test, expect } from '@playwright/test';

test('formulário apresenta resposta simulada', async ({ page }) => {
  await page.route('**/api/imc', async rota => {
    expect(rota.request().method()).toBe('POST');
    expect(rota.request().postDataJSON()).toEqual({ peso: 80, altura: 2 });
    await rota.fulfill({ json: { imc: 20, situacao: 'Peso adequado' } });
  });
  await page.goto('/');
  await page.getByLabel('Peso (kg)').fill('80');
  await page.getByLabel('Altura (m)').fill('2');
  await page.getByRole('button', { name: 'Calcular IMC' }).click();
  await expect(page.locator('.result strong')).toHaveText('20,00');
  await expect(page.locator('.result span')).toHaveText('Peso adequado');
});

test('interface apresenta mensagem de erro da API', async ({ page }) => {
  await page.route('**/api/imc', rota => rota.fulfill({
    status: 400, json: { erro: 'Entrada inválida' }
  }));
  await page.goto('/');
  await page.getByLabel('Peso (kg)').fill('80');
  await page.getByLabel('Altura (m)').fill('0');
  await page.getByRole('button', { name: 'Calcular IMC' }).click();
  await expect(page.getByRole('status')).toHaveText('Entrada inválida');
  await expect(page.locator('.result')).toHaveCount(0);
});
