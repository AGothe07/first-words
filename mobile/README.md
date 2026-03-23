# FinanceHub Mobile

App mobile do FinanceHub usando React Native + Expo.

## Pré-requisitos

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go no celular (iOS/Android)

## Como rodar

```bash
# 1. Entrar na pasta mobile
cd mobile

# 2. Instalar dependências
npm install

# 3. Instalar dependência do babel resolver
npx expo install babel-plugin-module-resolver

# 4. Iniciar o Expo
npx expo start
```

Escaneie o QR Code com o Expo Go no celular.

## Estrutura

```
mobile/
├── App.tsx                    # Entry point
├── app.json                   # Expo config
├── package.json               # Dependências
├── src/
│   ├── components/ui/         # Componentes reutilizáveis (Card, Button, Input, Loading)
│   ├── contexts/              # AuthContext (Supabase auth)
│   ├── lib/                   # Supabase client com SecureStore
│   ├── navigation/            # React Navigation (Tabs + Drawer)
│   ├── screens/               # Todas as telas
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   ├── TransactionsScreen.tsx
│   │   ├── CategoriesScreen.tsx
│   │   ├── GoalsScreen.tsx
│   │   ├── BudgetScreen.tsx
│   │   ├── DebtsScreen.tsx
│   │   ├── AssetsScreen.tsx
│   │   ├── InvestmentsScreen.tsx
│   │   ├── AgendaScreen.tsx
│   │   ├── EventsScreen.tsx
│   │   ├── PersonsScreen.tsx
│   │   ├── RecurringScreen.tsx
│   │   └── SettingsScreen.tsx
│   └── theme/                 # Cores e tipografia
```

## Telas disponíveis

| Tela | Descrição |
|------|-----------|
| Login | Autenticação com email/senha |
| Dashboard | KPIs do mês (receitas, despesas, saldo) |
| Lançamentos | Lista de transações |
| Categorias | Lista de categorias |
| Pessoas | Lista de pessoas |
| Metas | Metas com barra de progresso |
| Orçamento | Orçamento por categoria |
| Dívidas | Controle de dívidas |
| Patrimônio | Ativos e patrimônio total |
| Investimentos | Investimentos e aportes |
| Agenda | Eventos e compromissos |
| Datas Importantes | Aniversários e datas |
| Recorrentes | Transações recorrentes |
| Configurações | Conta e logout |

## Backend

O app mobile usa o **mesmo backend Supabase** que a versão web.
Nenhuma alteração no banco ou nas APIs foi necessária.
