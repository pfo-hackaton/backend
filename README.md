# Установка

Требования:

-   Node >= 18
-   yarn
-   docker

Установка зависимостей

```bash
  yarn install
```

Запуск докер контейнеров для бд

```bash
  yarn docker:up
```

Миграция по схеме в бд

```bash
  yarn prisma migrate
```

Запуск сервера в dev режиме

```bash
yarn start:dev
```
