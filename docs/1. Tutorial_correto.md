# Tutorial do zero: IMC React + Supabase + Vercel + Google Auth + Stripe

## 0. O que está incluído

Este ZIP já é um projeto Vite/React completo. Não execute `npm create vite` e não substitua arquivos manualmente. A pasta contém `src/` (interface), `public/icon.svg` (ícone), `supabase/schema.sql` (banco e permissões), `api/checkout.js` e `api/webhook.js` (funções de servidor Vercel), `.env.example` (nomes das variáveis), `package.json`, `index.html`, `.gitignore` e `vercel.json`. Não há `node_modules`: será instalado pelo npm.

A publicidade é somente visual, sem anúncios reais do Google AdSense, porque se faz necessário comprar um domínio. Usuários anônimos podem calcular IMC, mas nenhum cálculo é enviado ao banco. Usuários autenticados salvam automaticamente cada cálculo e visualizam até 100 registros recentes. As assinaturas são recorrentes e processadas pelo Stripe em modo de teste. O acesso sem anúncios depende da confirmação do webhook Stripe, nunca de um parâmetro no navegador.

## 1. Preparar o computador

Instale Node.js LTS compatível com Vite 6 (Node 18 ou superior; preferencialmente Node 20/22) em https://nodejs.org/. Instale Git em https://git-scm.com/downloads. No Terminal execute:

```bash
node -v
npm -v
git --version
```

Se `node -v` indicar 16 ou inferior, atualize o Node antes de continuar. Não use `sudo npm install`.

## 2. Extrair e executar

Baixe o ZIP, extraia e abra a pasta `imc-react` no Terminal CMD (não funciona no PowerShell do Windows). Exemplo:

```bash
cd caminho/para/imc-react
npm install
npm run dev
```

Abra o endereço exibido pelo Vite no navegador, normalmente `http://localhost:5173`. O cálculo e os anúncios demonstrativos funcionam sem configurar serviços. Login e histórico dependem do Supabase; pagamentos dependem também das funções de servidor.

## 3. Criar o projeto Supabase

1. Acesse https://supabase.com/dashboard e crie conta ou entre.
2. Clique **New project**, escolha organização, nome `imc-react`, região mais próxima aos usuários e senha forte do banco. Aguarde o provisionamento.
3. No painel a esquerda, abra **SQL Editor**, clique **New query** e cole TODO o conteúdo de `supabase/schema.sql`. Clique **Run** uma única vez. O SQL cria `profiles` e `bmi_records` os quais podem ser vistos no painel **Table Editor**), políticas RLS, índice e trigger de perfil.
4. Na pasta do projeto, copie o arquivo `.env.example` e cole, renomeando o novo arquivo para `.env.local`.
5. ✅No Supabase, no painel a esquerda, abra Project Overview e copie a url no formato: `https://ID-SEU-PROJETO.supabase.co`. Na pasta do projeto, abra `.env.local` e cole o valor em `VITE_SUPABASE_URL`e em `SUPABASE_URL`.
6. No Supabase, no painel esquerdo, abra **Project Settings > API Keys**, abra a aba **Legacy anon, service_role API keys** e copie a chave **anon public**. Nunca use a service_role no frontend.
7. ✅No projeto, abra `.env.local` e cole no valor de `VITE_SUPABASE_ANON_KEY` com os valores públicos.
8. ✅No Supabase, abra **Project Settings > API Keys**, clique na aba **"Legacy anon, service_role API keys"** e copie a chave **service_role/secret** para `SUPABASE_SERVICE_ROLE_KEY` no arquivo `.env.local`. Não compartilhe esse arquivo.

O banco aplica RLS: cada usuário só pode ler e inserir seus próprios registros. Não existe política de alteração do plano pelo cliente; somente a função de servidor com service role pode atualizá-lo. A service role ignora RLS: mantenha-a exclusivamente nas variáveis de ambiente do servidor.

## 4. Publicar na Vercel

1. Crie ou use uma conta **GitHub** em [https://github.com]([https://github.com]()) e use o mesmo e-mail para logar na **Vercel** em [https://vercel.com]([https://vercel.com]()) (pode usar login GitHub).
2. No Terminal CMD, dentro de `imc-react`, execute:

```bash
git init
git add .
git commit -m "Primeira versão do IMC sem Stripe nem Google Auth"
```

3. Crie um repositório vazio no GitHub, por exemplo `imc-react`, sem README inicial. Siga a URL fornecida pelo GitHub (altere a url abaixo pela url correta do repositório do GitHub):

```bash
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/imc-react.git
git push -u origin main
```

4. Na Vercel, clique em **Add New > Project**, importe esse repositório GitHub. Selecione framework **Vite**, build `npm run build`, output `dist`.
5. Clique **Deploy**. Copie a URL definitiva do seu projeto no Vercel no formato:`https://...vercel.app`. No Projeto VSCode, atualize a variável `PUBLIC_SITE_URL` com essa URL no arquivo `.env.local` e faça redeploy.

## 5. Configurar Google OAuth

1. Acesse o Google Cloud Console em[ https://console.cloud.google.com/]([https://console.cloud.google.com/]()), crie ou selecione um projeto.
2. No Google Cloud Console, digite no campo de pesquisa: **Google Auth Platform, e clique quando** carregar esta opção.
3. No painel esquerdo do Google Auth Platform, clique em **Branding.** Adicione nome, contato e domínio, conforme exigido. No painel esquerdo, clique em **Audience**, selecione público externo e adicione usuários de teste enquanto o aplicativo estiver em modo de teste.
4. Em **Clients**, crie um **OAuth Client ID** do tipo **Web application**.
5. ✅Em **Authorized redirect URIs**, adicione exatamente a URL a seguir trocando `ID-SEU-PROJETO` pelo correspondente do projeto Supabase): `https://SEU-PROJETO.supabase.co/auth/v1/callback`.
6. ✅Ao salvar, copie o **Client ID e Client Secret.**. Entre no Supabase, abra **Authentication > Providers > Google**, habilite o provedor, cole os dois valores e salve.

7. ✅Em **Authentication > URL Configuration**, defina `Site URL` como `https://SEU-DOMINIO.vercel.app`; em **Redirect URLs**, adicione`http://localhost:5173/**` e `https://SEU-DOMINIO.vercel.app/**`.


8. ✅Inclua `https://SEU-DOMINIO.vercel.app/`em **PUBLIC_SITE_URL** no arquivo `env.local`.
No Google Cloud, se solicitado para branding/domínio, registre o domínio público, mas mantenha o callback OAuth apontando ao Supabase.
9. No navegador, acesse `https://SEU-DOMINIO.vercel.app`, clique em **Entrar com Google** e conclua o login.
10. No Supabase, em **Table Editor > profiles** confirme a criação do perfil. Calcule um IMC e confira a linha em `bmi_records`.

Se o Google informar `redirect_uri_mismatch`, confira o callback do Supabase, letra por letra. Se o usuário não conseguir entrar durante a fase de testes, confira a lista de usuários de teste no Google Cloud.

## 6. Configurar Stripe em modo de teste

1. Entre em [https://dashboard.stripe.com/]([https://dashboard.stripe.com/]()), insira as informações e **Pule** etapas assim que esta opção aparecer.
2. No Stripe, o **Test mode** (ambiente de teste) deve estar ativo (basta verificar se a URL no navegador possui /test/). Nunca misture chaves `sk_test` com preços de produção.
3. No Stripe, no painel esquerdo, clique me **Product catalog**, crie UM ÚNICO produto chamado `Meu IMC sem anúncios`.
4. Crie dois preços **recorrentes** em BRL: mensal de 4,90 reais chamado `SEM ANÚNCIOS - MENSAL`e anual de 34,90 reais chamado `SEM ANÚNCIOS - ANUAL` **no mesmo produto**. Salve.
5. ✅Na Stripe, no painel esquerdo, clique em **Product catalog**, clique no produto criado, depois clique nos três pontinhos de cada preço e copie os IDs `price_...` para `STRIPE_PRICE_MONTHLY` e `STRIPE_PRICE_YEARLY` no arquivo `.env.local`.
6. ✅Na Stripe, no canto inferior esquerdo, clique em **Developers > API keys**, copie a chave secreta de teste `sk_test_...` para `STRIPE_SECRET_KEY` no arquivo `.env.local`. Nunca use prefixo `VITE_` nessa chave.
7. ✅Na Stripe, abra **Desenvolvedores > Webhooks** e clique em **Adicionar destino**. Selecione apenaas `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Em seguida, adicione o destiono de eventos webhook para o Vercel: `https://SEU-DOMINIO.vercel.app/api/webhook`, trocando sempre `SEU-DOMINIO` pelo correspondente do seu projeto.
8. ✅Copie o **signing secret** do webhook `whsec_...` para `STRIPE_WEBHOOK_SECRET` no `env.local`. Ele é diferente da chave API.
9. ✅Configure `PUBLIC_SITE_URL` do `env.local` com a URL HTTPS do Vercel, sem barra final (`https://SEU-DOMINIO.vercel.app`).


## 7. Atualizar o Vercel

1. No CMD, faça novo deploy para carregar as variáveis através de novo push no GitHub: 

```bash
git add .
git commit -m "Variáveis atualizadas"
git push -u origin main
```
2. ✅🚨🚨✅No Vercel, vá em **Settings > Environment Variables** e clique em importar .env, selecione o arquivo `.env.local` completamente preenchido do seu projeto. Pode aparecer uma mensagem de que as variáveis já existem, visto o passo anterior ter funcionado. De toda forma, o Vercel terá todas as 9 variáveis do arquivo `env.local`. Então, confirme se estão: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` e `PUBLIC_SITE_URL`. Os dois `VITE_` são públicos; os demais são privados do servidor. Use valores de teste do Stripe.
3. Teste, nesta ordem: IMC anônimo; login Google; IMC logado; histórico de IMCs cauculados após recarregar. 

### Testar a cobrança

✅Abra o dominio Vercel no navegador: `https://SEU-DOMINIO.vercel.app/api/webhook`. Entre com Google, clique no plano mensal ou anual, conclua o Stripe Checkout com um cartão de teste oficial (ex.: `4242 4242 4242 4242`, validade futura e CVC fictício). Confira em **Stripe > Events** se o webhook recebeu o evento e respondeu HTTP 200. No Supabase verifique `profiles.plan` e `plan_expires_at`. Recarregue a página: os anúncios devem desaparecer.

**Importante:** este projeto demonstra o checkout e sincronização básica do status. Não inclui portal de cancelamento, cobrança de impostos, e-mails transacionais, gestão completa de falhas de pagamento, proteção contra reordenação de webhooks nem conciliação financeira. Não venda assinaturas reais antes de implementar e testar esses pontos. Para testar alterações de assinatura e expiração, use eventos reais de teste no Stripe, não altere manualmente o plano no frontend.



## 8. Solução de problemas


- **Login não funciona:** verifique URL e chave pública Supabase, provedor Google, callback e Redirect URLs.
- **Histórico não salva:** execute SQL, confirme usuário autenticado e inspecione políticas RLS.

- **Checkout retorna 500:** confira logs da função Vercel e as variáveis secretas e IDs dos preços.
- **Assinatura paga mas banners continuam:** verifique Stripe Events, URL e assinatura do webhook, registro `profiles` e recarregue a página.
- **✅Nunca comite `.env.local`:** já está no `.gitignore`. Se uma chave secreta vazar, revogue-a imediatamente.

## 9. Observações de segurança e produto

O cálculo é informativo, não diagnóstico. A classificação usa faixas usuais de IMC de adultos. O histórico contém dados de saúde e merece política de privacidade, retenção, exclusão e avaliação de conformidade com a LGPD antes de operação pública. O exemplo não implementa exclusão de conta nem portal de cancelamento; esses são requisitos antes de produção comercial. Preços apresentados na interface são valores de demonstração definidos neste projeto, e o preço efetivo cobrado será aquele configurado no Stripe.
