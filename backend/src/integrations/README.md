# Integrações externas

Este módulo é a fronteira reservada para clientes e adaptadores de serviços externos que o sistema venha a utilizar. O frontend não deve chamar provedores externos diretamente; os serviços internos do backend devem consumir os adaptadores necessários e expor somente as operações autorizadas por meio da API.

Credenciais de provedores ficam exclusivamente em variáveis de ambiente do backend e nunca em variáveis `VITE_*` ou no bundle do navegador. Atualmente o projeto não possui integrações externas implementadas; não adicione adaptadores fictícios apenas para preencher este diretório.
