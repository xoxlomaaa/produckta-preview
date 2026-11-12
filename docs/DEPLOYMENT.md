# Публикация предпросмотра

Последнее обновление 12.11: облегчённая крыша опубликована в runtime `2652a04`, workflow `43279534303` success, включая оба unit-теста. Холодные HTTPS-проверки desktop/mobile и весь интерактив успешны; опубликованные roof.js / assets / download / viewer побайтно совпали с проверенной prefixed-сборкой. Отчёты `output/qa/roof-loading/public-*`, контракт `ROOF-COLD-LOADING.md`. Ниже — история предыдущих публикаций.

Обновление 12.11: оптимизация чемодана опубликована в runtime `f64cede` (workflow `43274899395`, success). Ранняя подготовка и более лёгкие пакеты; при подходе к сцене приоритет новых запросов повышается с low до auto. Финальные холодные проверки с публичного HTTPS — `output/qa/locker-loading/public-final-*`, контракт — `LOCKER-COLD-LOADING.md`. Первоначальная публикация ниже сохранена как история.

Репозиторий: `https://github.com/xoxlomaaa/produckta-preview`.
Адрес Pages: `https://xoxlomaaa.github.io/produckta-preview/`.

Это публичная версия для обсуждения с друзьями, не запуск рабочего приёма заявок. Meta noindex, демонстрационные отзывы и сообщение формы о том, что данные не отправлены, сохранены.

## Первоначальная публикация 12.11.2026

Опубликована runtime-сборка `c497e20`. Workflow `43260196368` завершился успешно, включая build/check/upload/deploy. Проверен анонимный HTTPS-адрес: HTTP 200, gzip, HTML побайтно совпал с проверенной локальной prefixed-сборкой. Проверены desktop/390px, Архитектоника, GLB ready, админка, меню и inline-политика; ошибок JS/404/переполнения нет. Протокол и снимки — `output/publish/public-check.json`, `public-desktop.png`, `public-mobile.png` (локальные, не включены в Git).

## Сборка

- `node tools/build.mjs` — прежняя локальная сборка в `dist/`, URL от `/`.
- Переменная `SITE_BASE_PATH=/produckta-preview/` включает префикс для Pages.
- `tools/publish-paths.mjs` меняет только результат сборки: import maps, root-relative медиа, worker/Draco/GLB и Vite modulepreload из iframe. Исходники сцен и локальная прокрутка не меняются.
- Для локальной проверки публикации разрешён третий явный output `output/publish/site`; он не включается в Git.
- `.nojekyll` сохраняет статическую структуру, включая `_astro`.

## GitHub Actions

`.github/workflows/pages.yml`: push в main либо ручной запуск, Node 24, build с base-path, статические проверки, загрузка артефакта и deploy-pages. Репозиторий Pages должен использовать `build_type=workflow`. Разрешения минимальны: contents read, pages write, id-token write.

В репозиторий включаются исходники, шаблоны, инструменты и локальные runtime-ресурсы. Внутренние отчёты/диагностические скрипты, экспериментальные сборки, исходные презентации/мастера и файлы окружения исключены через .gitignore.

## Проверка

До отправки: отдельный HTTP mount `/produckta-preview/`; проверены Hero, iframe, запуск крыши, админка, мобильное меню и политика. Нет ошибок JS, HTTP 404 и HTTP-запросов вне prefix. Локальный протокол — `output/publish/subpath-check.json`.

После push нужно дождаться успешного deployment и проверить настоящий HTTPS-адрес, шрифты/медиа, iframe, worker/модель, мобильную ширину и политику. Публичный статус подтверждается только после этой проверки.
