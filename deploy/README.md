# Proxy de produção (exemplo para host único)

O arquivo `nginx.conf` é um modelo para um host Linux em que o Nginx é a única porta HTTP(S) pública. Ele serve os arquivos estáticos do frontend e encaminha `/api/*` para `127.0.0.1:3333`; o backend deve manter `HOST=127.0.0.1`. O banco MySQL também deve permanecer em rede privada e não deve ser exposto à internet.

Para gerar e instalar os arquivos do frontend:

```bash
cd frontend
npm ci
npm run build
sudo mkdir -p /var/www/locadora-de-veiculos
sudo cp -a dist/. /var/www/locadora-de-veiculos/
```

Instale `deploy/nginx.conf` como configuração de site do Nginx e ajuste `server_name` para o domínio real. Configure TLS no Nginx ou no balanceador que o antecede. Rode o backend com um supervisor de processos, usando `HOST=127.0.0.1`, `PORT=3333`, `DATABASE_URL` e `JWT_SECRET` próprios do ambiente. Não abra as portas `3333` da API nem `3306` do MySQL no firewall público. Em implantação com serviços separados ou contêineres, mantenha a API e o banco em uma rede privada e adapte o upstream Nginx.

Este exemplo não substitui a configuração de TLS, firewall, supervisor de processos, backups ou gestão de segredos do ambiente escolhido. No desenvolvimento local, o proxy Vite encaminha `/api` para o backend em `127.0.0.1:3333`.
