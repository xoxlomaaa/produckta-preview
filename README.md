# Produckta

Публичный предпросмотр: **https://xoxlomaaa.github.io/produckta-preview/**. Это версия для обсуждения: сохранены noindex и явный режим формы без отправки данных.

Публикация выполняется GitHub Actions из `main`: Node 24 → сборка с `SITE_BASE_PATH=/produckta-preview/` → GitHub Pages. Локальная сборка по умолчанию остаётся на `/`. Подробности — [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Папки `output/`, `experiments/` и `assets/source/` в Git не включаются.

Текущий рабочий цикл — правка в исходниках, `npm.cmd run build`, точечная проверка изменения на localhost. Полные проверки и Lighthouse выполняются отдельно по запросу или перед финальной приёмкой.

Рабочая главная Produckta с разделом «Вот что мы можем.» после «Как мы работаем»: Архитектоника, сцена с чемоданом, строительная 3D-система, интерфейс проката и экспертиза команды на основе презентации. Статический HTML, mobile-first CSS и отдельные модули поведения.

## Запуск

Требуется Node.js 24 или новее. Установка пакетов не нужна.

```powershell
npm.cmd run verify
npm.cmd run preview
```

Адрес предпросмотра — http://127.0.0.1:4330/. Если порт занят, укажите `PREVIEW_PORT` перед запуском. После правок запустите `npm.cmd run build` и обновите вкладку. `npm.cmd run dev` собирает и сразу запускает сервер.

- Контент и порядок блоков — `src/index.html`.
- FAQ после отзывов и логотипов — `templates/sections/faq.html`, стили — `src/styles/faq.css`; сборка вставляет его в слот `<!-- faq -->`. Управление нативное, отдельного JS нет. Контракт и проверка — [docs/FAQ.md](docs/FAQ.md).
- Раздел возможностей собирается в слот `<!-- capabilities -->` из `templates/sections/capabilities.html` и `templates/components/rental.html`. Код и стили — `src/showcase/`, подготовленные ресурсы — `assets/showcase/`. Карта — [PROJECT-MAP.md](PROJECT-MAP.md).
- Пятый блок об экспертизе — `templates/components/expertise.html`, оформление — `src/showcase/expertise.css`. Источники кейсов и границы утверждений — [docs/EXPERTISE-CASES.md](docs/EXPERTISE-CASES.md).
- Оформление и адаптация — `src/styles/home.css`.
- Входная анимация Hero и образец «Идеи — в дело» — `src/js/page-motion.js`, параметры mobile/desktop — `src/styles/page-motion.css`; контракт и проверки — [docs/PAGE-MOTION-PILOT.md](docs/PAGE-MOTION-PILOT.md). Прокрутка и интерактивная витрина не менялись.
- Общие появления остальных контентных разделов — `src/js/content-motion.js`, [контракт и проверки](docs/CONTENT-MOTION.md). Текст кейсов появляется отдельно от живых превью; их оболочки и скролл не анимируются этим модулем.
- Компании под отзывами — восемь локальных SVG в `assets/partners/`, блок `#partners`; источники, подготовка и проверка — [docs/PARTNER-LOGOS.md](docs/PARTNER-LOGOS.md). Логотипы не требуют доступа к внешним ресурсам.
- Услуги и отрасли объединены в `#services`; вложенный `#industries` сохраняет якорь меню, одна ссылка «Посмотреть решения» ведёт к `#capabilities`. Реализация — [docs/UPPER-COMPOSITION-REVIEW.md](docs/UPPER-COMPOSITION-REVIEW.md).
- Точные цвета брендбука, правила производных подложек и проверка палитры — [docs/BRAND-PALETTE.md](docs/BRAND-PALETTE.md), `node tools/check-brand-palette.mjs`.
- Единая система кнопок, стрелок, рамок и hover — [docs/CONTROLS.md](docs/CONTROLS.md); общие токены в `src/styles/home.css`.
- Для новых цветных блоков фирменный росчерк по умолчанию крупный, с читаемой петлёй; правила — [docs/BRAND-GRAPHICS.md](docs/BRAND-GRAPHICS.md).
- Меню, проверки формы и общее окно политики — `src/js/home.js`.
- Общая плавная прокрутка — `src/js/smooth-scroll.js`; связь с iframe и проверка — [docs/SMOOTH-SCROLL.md](docs/SMOOTH-SCROLL.md).
- Сцена с чемоданом — `src/showcase/locker/src/js/render-story/hero.js`. Для полного перехода нужно на 15% больше движения обычного колеса; скролл страницы и Архитектоники сохранён. `npm.cmd run build` собирает всю главную без папок других проектов. `node tools/check-showcase-transfer.cjs` — точечная проверка переноса, отчёт `output/qa/showcase-main-transfer/report.json`.
- Векторные рисунки из брендбука и подготовленные WebP — `assets/illustrations/`. Исходные материалы — `assets/source/`.
- Портреты команды для сайта — `assets/team/`: одобренные студийные варианты Ксении и Александра, исходная фотография Кирилла. Пробные генерации и промпты — `output/concepts/team-portraits-v01/`.
- Профиль проекта — [docs/project-profile.md](docs/project-profile.md). Общие правила — [docs/README.md](docs/README.md).
- Заголовки основных разделов и описания под ними — единый класс `.section-description`; правила и источник утки-космонавта — [docs/SECTION-HEADINGS.md](docs/SECTION-HEADINGS.md).
- Поля и текущий режим формы заявки — [docs/request-form.md](docs/request-form.md).
- Подвал — в `src/index.html`: телефон, почта и Telegram предоставлены пользователем; VK пока без ссылки. Кнопки политики в форме и подвале открывают один документ-заготовку. SVG-значки Telegram и VK в `assets/brand/` — из [Simple Icons](https://github.com/simple-icons/simple-icons/tree/develop/icons), отображаются локально без внешних библиотек.

Предпросмотр помечен `noindex`. Открытая форма в финальном блоке предлагает выбор услуг и бюджета, проверяет поля в браузере и сообщает, что заявка не отправлена. Окно политики содержит явную заготовку документа. Шесть отзывов с условными логотипами — явно отмеченные демо-заготовки с вымышленными авторами и компаниями; перед публикацией их нужно заменить подтверждёнными материалами. Публичная сборка в `dist/` пересоздаётся командой build; исходники, макеты и отчёты в неё не попадают.

Прокрутка превью Архитектоники: [актуальный контракт и проверки](docs/ARCHITECTURE-SCROLL-SEQUENCE.md). Для колеса/трекпада последовательность не зависит от положения курсора; после изменения JS обновите localhost-вкладку.
