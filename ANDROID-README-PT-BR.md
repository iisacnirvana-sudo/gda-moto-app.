# GDA Moto para Android

Este repositório mantém o aplicativo web atual e prepara uma versão Android usando Capacitor.

## Gerar APK de teste

1. Abra a aba **Actions** deste repositório no GitHub.
2. Selecione **Build GDA Moto Android APK**.
3. Toque em **Run workflow** e confirme.
4. Aguarde o fluxo terminar com sucesso.
5. Abra a execução concluída e baixe o artefato **gda-moto-debug-apk**.
6. Extraia o arquivo ZIP e instale o `app-debug.apk` em um Android de teste.

O APK de depuração é destinado a testes. Para distribuição pública será necessária uma versão assinada de lançamento, com chave de assinatura protegida como segredo do GitHub.

## Estado desta primeira etapa

- O aplicativo web existente é copiado para dentro do pacote Android.
- A configuração Capacitor gera o projeto Android durante o workflow.
- O GitHub Actions compila e disponibiliza um APK de teste.
- O Supabase continua sendo o backend existente; nenhuma tabela ou dado é migrado.

## Recursos nativos ainda necessários

Esta primeira compilação é apenas o invólucro Android do aplicativo web. Ela **não implementa ainda** localização contínua em segundo plano nem notificações push de novas corridas.

Para isso, a próxima etapa deverá adicionar:
- Serviço Android em primeiro plano para GPS, com notificação persistente e permissões adequadas.
- Tratamento de permissões de localização em primeiro e segundo plano, respeitando as versões do Android.
- Notificações push por Firebase Cloud Messaging e integração segura no backend.
- Testes em aparelhos reais, inclusive com tela bloqueada e economia de bateria.

Não considerar o APK inicial pronto para operação comercial. Validar requisitos legais, segurança, privacidade, permissões e funcionamento antes de uso com passageiros.
