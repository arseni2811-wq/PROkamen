# Логика расчёта стоимости калькулятора ПРО Камень

Дата анализа: 2 сентября 2026 года. Анализ выполнен по состоянию локального `HEAD` `f022732`; БД не читалась и не изменялась, поэтому ниже отдельно различаются фактические формулы кода, начальные значения миграции и значения опубликованного прайса, которые могут быть изменены администратором.

Главный вывод: браузер не рассчитывает стоимость самостоятельно. `public/js/calculator-app.js` формирует конфигурацию, переводит денежный и процентный ручной ввод в cents/bps и отправляет его на API. Геометрию, расход, строки работ, курс, наценки, резерв, минимальный заказ, публичный коэффициент и итог рассчитывает backend-функция `calculate()` в `backend/services/calculatorService.js:480`.

## 1. Файлы калькулятора

### Фактическая цепочка публичной страницы

1. `public/pages/calculator.html` — контейнер `#calculatorApp`; подключает общие CSS, `public/css/calculator.css`, `public/js/main.js` и `public/js/calculator-app.js`.
2. `public/js/main.js` — общая навигация сайта; расчётных формул нет.
3. `public/js/calculator-app.js` — генерирует UI, хранит состояние формы, формирует payload, запускает API-пересчёт и отображает результат.
4. `backend/server.js:113` — монтирует calculator router под `/api`.
5. `backend/routes/calculator.routes.js` — публичные и внутренние endpoints, authentication и Zod-validation.
6. `backend/middleware/schemas.js:180-306` — допустимые поля и диапазоны payload.
7. `backend/controllers/calculatorController.js` — очищает запрещённые публичные корректировки, загружает опубликованный прайс и вызывает расчёт.
8. `backend/services/calculatorRepository.js` — SQL-чтение материала, формата, опубликованного прайса, настроек и ставок.
9. `backend/services/calculatorService.js` — вся фактическая геометрия и денежные формулы.
10. `backend/services/publicCalculatorPdf.js` — повторно не считает; печатает уже рассчитанный публичный ответ.

### Связанные файлы

- `public/crm/crm/calculator.html` — внутренний режим того же `calculator-app.js` (`data-calculator-mode="internal"`).
- `public/crm/crm/js/api.js` — альтернативные CRM-wrapper-методы к `/api/calculator/*`.
- `backend/controllers/ordersController.js:982-1140` и `backend/routes/orders.routes.js:197-202` — сохранение готового snapshot и `total_amount` в заказ.
- `backend/migrations/001_baseline.sql` — `materials`, `orders`, `order_finances` и исходный `system_settings.exchange_rate`.
- `backend/migrations/005_calculator_pricebook.sql` — форматы, pricebook, ставки, настройки и публичные заявки.
- `backend/migrations/006_calculator_manual_material.sql` — внутренний материал `custom` с ручной ценой.
- `backend/test/calculatorService.test.js`, `backend/test/publicCalculatorPdf.test.js`, `backend/test/schemas.test.js` — подтверждённые сценарии формул и границ.
- `CALCULATOR.md`, `CALCULATOR_QA.md` — документация и результаты прежних проверок; источником истины для этого аудита был код.

CSS-файлы и изображения влияют только на вид страницы. `public/assets/data/price.csv` публичным калькулятором не читается.

## 2. Входные параметры

HTML страницы содержит только `#calculatorApp`; почти все поля создаются строковыми шаблонами в `calculator-app.js`.

| Параметр | UI поле | Переменная/payload | Ед. изм. | Источник, default и validation | Влияет на итог |
|---|---|---|---|---|---|
| Тип изделия | `.item-product-choice` | `item.productType` | enum | `countertop` по умолчанию; также `windowsill`, `table`, `island`, `bar` | Да: выбирает геометрию, доступные опции и монтаж |
| Форма | `.item-shape-choice` | `item.shape` | enum | `straight`; также `l`, `u` | Да: меняет детали и число угловых стыков |
| Форма стола | `.table-shape-choice` | `item.tableShape` | enum | `rectangle`; также `round`, `oval` | Да: меняет площадь и периметр |
| Длина детали | `.piece-length`, `data-piece` | `item.pieces[].lengthMm` | мм | defaults зависят от изделия/формы; UI 1…20000, schema >0…20000 | Да |
| Ширина/глубина | `.piece-width`, `data-piece` | `item.pieces[].widthMm` | мм | defaults зависят от изделия; UI 1…5000, schema >0…5000 | Да |
| Диаметр круглого стола | `.table-diameter` | одновременно `lengthMm` и `widthMm` | мм | default 1100; UI 300…5000, schema до 20000/5000 | Да |
| Размер острова | `.extra-length`, `.extra-width` | единственная `piece` | мм | 1800×900; UI 300…10000 и 250…3000 | Да |
| Размер бара | `.extra-length`, `.extra-width` | единственная `piece` | мм | 1600×500; те же UI-границы | Да |
| Радиусные углы острова | кнопки `data-extra-corners` | `roundedCorners` | шт. | 0; UI 0/2/4, schema 0…4 | Да: площадь, прямой и фигурный рез, кромка |
| Радиус | кнопки `data-extra-radius` | `cornerRadiusMm` | мм | 50; UI 20/50/100, schema 0…500 | Да при `roundedCorners > 0` |
| Выбранные стороны кромки | `data-side-group="edgeSides"` | `edgeSides.front/left/right` | bool | `{front:true,left:false,right:false}` | Да для столешницы/подоконника |
| Модель профиля кромки | `data-edge-profile` | `edgeProfileModel` | enum `model_1`…`model_7` | `model_1` | Нет в текущем UI: все модели принудительно ставят `edgeCode="edge_standard"` |
| Код тарифа кромки | напрямую не выбирается | `edgeCode` | enum | `edge_standard`; schema также допускает `edge_round`, `edge_reinforced` | Да, если иной код попал в API/snapshot |
| Тип бортика | `data-backsplash` | `backsplashType` | enum | `none`; `straight`, `coved` | Прямой — да; радиусный сохраняется, но цены не добавляет |
| Длина бортика | `.backsplash-length` | `backsplashLengthM` | м | 0 означает автоматическую `installationM`; UI 0…1000 | Да только для `straight` |
| Скинали | button `data-field="wallPanel"` | `wallPanel` | bool | false | Да: площадь материала, раскрой и тарифы |
| Автодлина скинали | button `wallPanelAutoLength` | `wallPanelAutoLength` | bool | true | Да через выбранные стороны у стены |
| Стороны у стены | `wallSides` buttons | `wallSides.back/left/right` | bool | `{back:true,left:false,right:false}` | Да для автодлины бортика/скинали |
| Ручная длина скинали | `.wall-panel-length` | `wallPanelLengthM` | м | 0; UI 0.1…1000, schema 0…1000 | Да при выключенной автодлине |
| Высота скинали | `.wall-panel-height` | `wallPanelHeightMm` | мм | 600; UI/schema 50…5000 | Да: площадь и раскрой |
| Мойка | buttons `data-sink` | `sinkType` | enum | у столешницы `under`; варианты none/top/under/stone | Да: вырез/мойка; `under` при монтаже также добавляет вклейку |
| Варочная панель | button `hob` | `hob` | bool | true у столешницы | Да: 1 вырез |
| Смеситель | button `tapHole` | `tapHole` | bool | true у столешницы | Да: 1 отверстие |
| Розетки | `.service-quantity[data-field="socketHoles"]` | `socketHoles` | шт. | 0; UI/schema 0…20 integer | Да |
| Дозаторы | `.service-quantity` | `dispenserHoles` | шт. | 0; 0…20 integer | Да |
| Круглые вырезы | `.service-quantity` | `roundCutouts` | шт. | 0; 0…20 integer | Да |
| Другие отверстия | `.service-quantity` | `otherHoles` | шт. | 0; 0…20 integer | Да |
| Монтаж | button `installation` | `installation` | bool | true для столешницы/подоконника, false для стола/острова/бара | Да |
| Замер | button `measurementRequested` | одноимённый bool | bool | false | Нет: только пометка «по запросу» |
| Доставка | button `deliveryRequested` | одноимённый bool | bool | false | Нет: только пометка «по запросу» |
| Подъём | button `liftingRequested` | одноимённый bool | bool | false | Нет: только пометка «по запросу» |
| Категория/производитель/серия | `#categoryFilter`, `#manufacturerFilter`, `#seriesFilter` | не входят в payload | строки | пусто = все | Нет напрямую; только фильтруют выбор материала |
| Материал | `.material-card__select[data-material]` | `materialId` | id | первый доступный quartz/granite/onyx | Да: цена, наценка, единица цены и формат |
| Формат слэба | `#slabFormat` только CRM | `slabFormatCode` | enum | `normal`; normal/jumbo/super_jumbo/custom | Да: площадь слэба, раскладка, продольные разрывы |
| Толщина | `#thickness` только CRM | `customFormat.thicknessMm` | мм | 20; UI 5…200, schema >0…200 | Только при `custom`; выбирает `polish_20`/`polish_40` для продольных стыков |
| Custom длина/ширина | `#customLength`, `#customWidth` | `customFormat.lengthMm/widthMm` | мм | 3050×1440; schema до 10000×5000 | Да только при `custom` |
| Ручной расход | `#manualSlabs` только CRM | `manualSlabCount` | слэб | пусто/null = auto; UI min 0 step 0.5, schema 0…100 multiple 0.5 | Да для unit `slab`/`half_slab`; не для `sqm`/`manual` |
| Цена своего материала | `#manualMaterialPrice` | `manualMaterialPriceUsdCents` | USD → USD cents | 0; frontend `round(value×100)`, schema integer ≥0 | Да только если материал имеет `price_unit='manual'` |
| Наценка материала | `#materialMarkup` | `materialMarkupBps` | % → bps | 0; frontend `round(value×100)`, schema 0…100000 bps | Да через максимум трёх наценок |
| Доп. стоимость материала | `#materialExtra` | `additionalMaterialBynCents` | BYN → cents | 0; frontend `round(value×100)` | Да до резерва |
| Скидка/надбавка | `#managerAdjustment` | `managerAdjustmentBynCents` | BYN → cents | 0; может быть отрицательной | Да только для внутреннего `finalQuoteTotalCents`, после резерва/minimum |
| Доп. операции CRM | `#operations [data-operation]` | `configuration.operations[]` | m/sqm/pcs/service | 0; список из БД, но automatic codes скрыты | Да: ставка × количество |
| Ручная строка | `.line-*` | `additionalLines[]` | количество × BYN cents | название, количество, единица, цена; UI создаёт только BYN | Да до резерва |

`automaticGeometry` всегда `true` в создаваемом UI и отдельного переключателя нет. Schema допускает `false`, а backend тогда не создаёт automatic quantities; это API/snapshot-сценарий, не режим текущей страницы.

### Зависимости параметров

```text
productType/shape/tableShape/pieces/radius
→ area, straight/curved cut, edge, joints, installation length
→ rate quantities → works → technical → recommended → итог

wallSides + wallPanelAutoLength/manual length + panel height
→ panel length/area/cut → material area/slabs + wall_panel/install lines → итог

materialId
→ price_unit + base USD price + catalog markup + linked slab format
→ material USD → material BYN → technical → итог

slab format dimensions + waste
→ areaWithWaste/slabArea → commercial slabCount
→ material price for slab/half_slab; slab length also → splits/joints/polish

manualSlabCount → replaces automatic slabCount → slab/half_slab material price
materialMarkupBps → max(catalog, minimum, manager) → material only
additionalMaterialBynCents → material BYN before reserve
managerAdjustmentBynCents → CRM final after reserve/minimum only

sink/hob/holes/edge/backsplash/installation/manual operations
→ quantities × DB rates → works → technical → итог

measurement/delivery/lifting/coved backsplash
→ textual request only → no monetary dependency
```

### API-запросы страницы и общего CRM-script

| URL и method | Кто вызывает | Payload | Ценовой response/эффект |
|---|---|---|---|
| `GET /api/public/calculator/catalog` | public init | нет | categories/materials/formats/operations без цен |
| `POST /api/public/calculator/preview` | public calculate и сравнение материалов | `{materialId, slabFormatCode, customFormat?, configuration}` | public calculation: `publicFromTotalCents`, allocated material/works, metrics; USD/rates/settings скрыты |
| `POST /api/public/calculator/pdf` | `#pdfAction` | тот же preview payload | backend заново считает и возвращает PDF; не JSON |
| `POST /api/public/calculator/leads` | public submit | preview payload + contact | backend заново считает; пишет snapshot; возвращает leadId, attachmentToken и public calculation |
| `POST /api/public/calculator/leads/:id/attachment` | после lead, если выбран файл | multipart token+file | цену не меняет |
| `GET /api/calculator/catalog` | internal init | JWT/cookie | полный active catalog и manager operations без цен |
| `POST /api/calculator/preview` | internal calculate | тот же payload, включая manager-only поля | полный snapshot: material/rate lines/totals/settings |
| `GET /api/orders/:id` | internal при `orderId` | auth | восстанавливает snapshot/version; не пересчитывает |
| `PUT /api/orders/:id/calculator` | internal save | `{version,total_amount,exchange_rate,calculator_snapshot}` | сохраняет присланный snapshot/итог, обновляет order items/finances; calculator service повторно не вызывается |

Все mutating public actions пересчитывают цену на backend; frontend preview не передаётся как доверенный итог. Исключение — сохранение уже полученного internal snapshot в заказ.

## 3. Источники цен

Цены не захардкожены в `calculator-app.js`. Runtime-источник — последняя строка `calculator_pricebooks` со `status='published'`.

| Источник | Поля | Использование |
|---|---|---|
| `materials` | `material_id`, `type_id`, `price_unit`, `base_price_usd_cents`, `markup_bps`, `slab_format_id`, `thickness_mm`, flags | материал, базовая USD-цена, catalog markup, связанный формат |
| `calculator_slab_formats` | `system_code`, `length_mm`, `width_mm`, `thickness_mm`, `is_custom` | площадь слэба, физическая проверка, выбор тарифа полировки стыка |
| `calculator_pricebooks` | `version_number`, `exchange_rate_scaled`, `status` | версия и курс BYN/USD × 10000 |
| `calculator_settings` | `reserve_bps`, `public_factor_bps`, `minimum_order_byn_cents`, `rounding_step_byn_cents`, `waste_bps`, `minimum_material_markup_bps`, `public_wording` | глобальная цепочка цены |
| `calculator_rates` | `system_code`, `base_price_usd_cents`, `calculation_mode`, `dependent_code`, `percent_bps`, availability flags | ставки всех работ |

Миграция `005` первоначально переносит legacy `materials.price_per_m2` в USD cents формулой `ROUND((price_per_m2 / 3) * 100)`, но текущий калькулятор далее читает только `base_price_usd_cents`; `price_per_m2` в runtime-формулу не входит.

Начальные форматы миграции: Normal 3050×1440×20, Jumbo 3200×1600×20, Super Jumbo 3300×1650×20, Custom без фиксированных размеров. Это начальные, а не гарантированно текущие значения: администратор может менять их.

Начальные ставки миграции (USD cents): `cut_straight` 500/m; `cut_curved` = 13000 bps от `cut_straight`; `cut_45` 1000/m; `polish_20` 2000/m; `polish_40` 4000/m; `polish_custom` 3000/m; `backsplash_make` 1000/m; стандартные отверстия 1000/pcs; hob 4000; sink top 4000; sink under 5000; round cutout 7000; manual polish small/large 5000/8000; joints short/long 4000/8000; edge standard/round/reinforced 2000/3000/4000 per m; stone sink 30000; backsplash 1000/m; wall panel 1500/m; install countertop 2500/m; wall panel 1500/m; plinth 500/m; plinth corner 500/pcs; sink 1000/pcs; corner countertop 1000/pcs; sill 1000/m. Админ может опубликовать иные значения.

## 4. Расчёт материала

Файл: `backend/services/calculatorService.js`. Функции: `itemGeometry()`, `calculateMaterial()`, `calculate()`.

### Площадь прямоугольных деталей

Кодовая формула: `areaMm2 = Σ(lengthMm * widthMm)`; затем `productAreaM2 = round(areaMm2) / 1_000_000`.

Для прямой, Г- и П-формы площади частей просто складываются. Геометрическое перекрытие в углах не вычитается.

### Круглый стол

`areaMm2 = π × (diameterMm / 2)²`.

### Овальный стол

`areaMm2 = π × (lengthMm / 2) × (widthMm / 2)`.

### Бар с полукруглым торцом

`R = min(width/2, length)`; при `length < width/2` расчёт отклоняется.

`areaMm2 = (length - R) × width + π × R² / 2`.

### Радиусные углы

Для каждого выбранного угла из прямоугольной площади вычитается:

`R² × (1 - π/4)`.

### Скинали

`wallPanelAreaM2 = roundMeters(wallPanelLengthM × wallPanelHeightMm / 1000)`.

`item.areaM2 = round6(productAreaM2 + wallPanelAreaM2)`.

### Цена материала

В `calculateMaterial()` базовая цена зависит от `materials.price_unit`:

- `slab`: `baseUsdCents = round(basePriceUsdCents × slabCount)`;
- `half_slab`: `baseUsdCents = round(basePriceUsdCents × slabCount × 2)`;
- `sqm`: `baseUsdCents = round(basePriceUsdCents × areaWithWasteM2)`;
- `manual`: `baseUsdCents = manualMaterialPriceUsdCents` — число слэбов не умножается.

Эффективная наценка не складывается:

`effectiveMarkupBps = max(material.markup_bps, settings.minimum_material_markup_bps, configuration.materialMarkupBps)`.

`materialTotalUsdCents = round(baseUsdCents × (10000 + effectiveMarkupBps) / 10000)`.

`materialBynCents = round(materialTotalUsdCents × exchangeRateScaled / 10000) + additionalMaterialBynCents`.

Доплата материала добавляется после material markup и конвертации, но до резерва. Общая наценка на услуги отсутствует.

## 5. Расчёт количества слэбов

1. `areaM2 = round6(Σ itemGeometry.areaM2)`.
2. `areaWithWasteM2 = areaM2 × (10000 + wasteBps) / 10000` — отдельного последующего округления нет.
3. `slabAreaM2 = slabLengthMm × slabWidthMm / 1_000_000`.
4. `rawSlabs = areaWithWasteM2 / slabAreaM2`.
5. `automaticSlabCount = ceil(rawSlabs × 2) / 2`.
6. Если `manualSlabCount` задан, используется `ceil(manualSlabCount × 2) / 2`, иначе automatic.

Шаг — 0,5 слэба с округлением только вверх. Значение 0 допустимо и остаётся 0. Остатки ранее купленных слэбов, повторное использование обрезков и складские остатки нигде не учитываются.

Параллельно `buildSlabLayout()` строит shelf-based раскладку прямоугольных частей с kerf 4 мм и выдаёт `physicalSlabCount`. Это число не участвует в коммерческом `slabCount`; цена использует только площадь/площадь слэба или ручное значение. Поэтому физическая раскладка может показать больше целых слэбов, чем оплачиваемый расход, например в примере ниже: `physicalSlabCount=1`, коммерческий `slabCount=0.5`.

Фактический алгоритм раскладки не вращает детали. Части сортируются по убыванию width, затем length. В существующую полку часть помещается при `part.width <= shelf.height` и `shelf.x + part.length <= slabLength`; после размещения `shelf.x += part.length + 4`. Новая полка получает `y = Σ(shelf.height + 4)` и создаётся, если `y + part.width <= slabWidth`. Если места нет, создаётся новый физический слэб. Деталь длиннее слэба заранее делится на сегменты `min(remainingLength, slabLength)`.

## 6. Расчёт изготовления

### Прямой раскрой

Для столешницы/подоконника (`usesSlabEdges=true`):

`exteriorStraightCutM = round3(Σ(length + width) / 1000)`.

Для прямоугольного стола/острова и прочих открытых деталей:

`exteriorStraightCutM = round3(Σ 2×(length + width) / 1000 - 2×R×roundedCorners/1000)`.

Для бара:

`straight = round3((2×(length-R) + width)/1000)`;
`curved = round3(π×R/1000)`.

Для круглого стола straight=0, `curved=round3(π×diameter/1000)`.

Для овального стола используется приближение Рамануджана:

`h=((a-b)²/(a+b)²)`;
`curved=round3(π(a+b)(1+3h/(10+sqrt(4-3h)))/1000)`.

### Детали длиннее слэба

`lengthSplitCount = Σ max(0, ceil(piece.length/slab.length)-1)`.

`jointPolishM = round3(Σ splits × piece.width / 1000)`.

`straightCutM = round3(exteriorStraightCutM + jointPolishM + wallPanelCutM)`.

Толщина формата `<40` выбирает `polish_20`, `>=40` — `polish_40`; quantity = `jointPolishM`.

### Раскрой скинали

`wallPanelCutM = round3(wallPanelLengthM + wallPanelHeightMm/1000)`.

### Кромка

- Столешница/подоконник: сумма выбранной лицевой длины и выбранных левого/правого торцов.
- Стол/остров/бар: весь внешний прямой+криволинейный периметр.
- Для прочих веток 1/2/3 стороны означают front, затем left, затем right, с поправкой радиусных углов.

Финальная ставка строки: `amountUsdCents = round(rateUsdCents × quantity)`.

### Стыки

`jointCount = (shape=='u' ? 2 : shape=='l' ? 1 : 0) + lengthSplitCount`.

Если максимальная ширина детали `<=700 мм`, код `joint_short`, иначе `joint_long`; quantity = jointCount.

### Зависимые и fixed/manual ставки

- `unit` и фактически также `fixed`: `round(basePriceUsdCents × quantity)`.
- `dependent`: `round(dependentBaseUsdCents × quantity × percentBps/10000)`.
- `manual`: берётся `rate.manualUsdCents`, но repository такого поля не формирует.

## 7. Расчёт дополнительных услуг

Automatic quantities:

- sink top/under/stone → 1 соответствующая строка;
- hob/tap → 1;
- socket/dispenser/round/other → введённое количество;
- straight backsplash → `backsplash_make × backsplashLengthM`;
- wall panel → `wall_panel × wallPanelLengthM`;
- installation countertop/sill → `installationM`;
- under-sink при включённом монтаже → `install_sink × 1`;
- straight backsplash при монтаже → `install_plinth × backsplashLengthM`;
- wall panel при монтаже → `install_wall_panel × wallPanelLengthM`.

Автодлина бортика: введённая длина, если >0, иначе `geometry.installationM`. Автодлина скинали: `backLengthM`, то есть сумма отмеченных тыльной/левой/правой сторон.

`measurementRequested`, `deliveryRequested`, `liftingRequested` и радиусный бортик `coved` показываются как «по запросу, без включения в сумму». Денежных строк для них backend не создаёт.

Ручные строки CRM:

- BYN: `amountBynCents = round(unitPriceCents × quantity)`;
- USD: `amountUsdCents = round(unitPriceCents × quantity)`, `amountBynCents = round(amountUsdCents × rateScaled/10000)`.

Текущий UI создаёт ручные строки только с `currency='BYN'`; USD возможен только через API/старый snapshot.

## 8. Наценки

Наценка есть только на материал и выбирается как максимум catalog/minimum/manager, а не сумма.

После сложения материала и работ применяется резерв ко всей технической сумме:

`reserveCents = round(technicalTotalCents × reserveBps / 10000)`.

Это означает: услуги сначала входят в technical total, затем резерв применяется и к материалу, и ко всем работам/ручным BYN-строкам.

Для публичной цены применяется отдельный коэффициент ко всей рекомендуемой цене:

`round(recommendedManagerTotalCents × publicFactorBps / 10000)`.

Это именно коэффициент, не `1 + процент`.

## 9. Скидки

Отдельного процента скидки и отдельной скидки материала нет. Единственный механизм — фиксированная `managerAdjustmentBynCents`, UI «Скидка / надбавка, BYN»:

`finalQuoteTotalCents = max(0, recommendedManagerTotalCents + managerAdjustmentBynCents)`.

Она применяется после резерва и minimum order. Отрицательное значение может опустить итог ниже minimum order вплоть до нуля. Публичный controller принудительно заменяет adjustment на 0, поэтому публичная цена скидку/надбавку менеджера не использует.

## 10. Округление

| Этап | Фактическое округление |
|---|---|
| UI BYN/USD → cents | `Math.round(Number(value) × 100)` |
| UI percent → bps | `Math.round(Number(value) × 100)` |
| Все значения, ожидаемые как integer cents/bps | `asNonNegativeInteger` → `Math.round` |
| Unit price × quantity | `Math.round` до 1 cent |
| USD cents → BYN cents | `Math.round(usdCents × exchangeRateScaled / 10000)` |
| Площадь изделия | mm² округляются до целого, затем /1e6; общая area — 6 знаков |
| Метры геометрии | `Math.round(value×1000)/1000` |
| Расход слэбов | `Math.ceil(value×2)/2` |
| Материал с наценкой | `Math.round` до USD cent |
| Резерв | `Math.round` до BYN cent |
| Public factor | сначала `Math.round` до cent |
| Публичный финал | `Math.ceil(value/roundingStep)×roundingStep` |
| Отображение | cents/100; `toLocaleString`, максимум 2 знака для денег, 3 для чисел |
| Сохранение заказа | `finalQuoteTotalCents/100` → `orders.total_amount DECIMAL(10,2)` |

Есть последовательное округление на нескольких уровнях: геометрия до 0.001 м, каждая ставка×quantity до USD cent, сумма USD-строк → одна конвертация в BYN cents, материал отдельно конвертируется в BYN cents, затем резерв и public factor отдельно округляются. Это не float-only итог: денежные значения внутри snapshot и расчёта — integer cents, но промежуточные quantity/area — JS Number.

## 11. Полная формула итоговой стоимости

Обозначения: `B=10000`, `FX=exchange_rate_scaled`, `W=waste_bps`, `R=reserve_bps`, `P=public_factor_bps`, `Step=rounding_step_byn_cents`.

```text
Area = Σ геометрических площадей изделий и скинали
AreaWaste = Area × (B + W) / B
Slabs = ceil((AreaWaste / SlabArea) × 2) / 2       // если нет manualSlabCount

MaterialUSD = round(MaterialBaseUSD × (B + max(catalogMarkup, minimumMarkup, managerMarkup)) / B)
MaterialBYN = round(MaterialUSD × FX / B) + materialExtraBYN
WorksBYN = round(Σ pricedRateLinesUSD × FX / B)
ManualBYN = Σ ручных BYN-эквивалентов
Technical = MaterialBYN + WorksBYN + ManualBYN
Recommended = max(Technical + round(Technical × R / B), MinimumOrder)
ManagerFinal = max(0, Recommended + ManagerAdjustment)
PublicFrom = ceil(round(Recommended × P / B) / Step) × Step
```

`MaterialBaseUSD` зависит от `price_unit`: price×slabs, price×slabs×2, price×AreaWaste или ручная абсолютная цена.

Критический порядок: material markup применяется только к базовой стоимости камня; затем добавляются material extra, работы и ручные строки; резерв применяется ко всему technical; minimum order применяется после резерва; manager adjustment — после minimum; публичный коэффициент считается не от manager final, а от recommended без adjustment; публичное округление — последнее.

## 12. Последовательность расчёта

1. UI меняет `state` и через 180 мс вызывает `calculate()` frontend.
2. Frontend собирает items, operations, ручные настройки и material/format ids.
3. Zod валидирует диапазоны.
4. Public controller обнуляет ручной расход, ручную цену, manager markup, material extra, adjustment и additional lines.
5. Repository читает последнюю опубликованную версию pricebook, материал, формат, rates и settings.
6. Backend нормализует детали и проверяет положительные размеры.
7. Считает геометрию каждого изделия, продольные разделения и предварительную физическую раскладку.
8. Суммирует площадь, добавляет waste, делит на площадь слэба, округляет расход к 0.5 или принимает ручной расход.
9. Считает material base по `price_unit`, выбирает максимальную material markup, конвертирует USD→BYN, добавляет material extra.
10. Собирает manual и automatic quantities; ручную полировку переключает small/large по границе общей area `<=1`.
11. Считает строки rates в USD cents и ручные строки в BYN/USD.
12. Суммирует production USD, конвертирует один раз в BYN; отдельно суммирует `amountBynCents` ручных строк.
13. Получает technical total.
14. Добавляет reserve, затем применяет minimum order.
15. Для CRM добавляет fixed manager adjustment и ограничивает итог снизу нулём.
16. Для public берёт recommended без manager adjustment, умножает на public factor и округляет вверх к Step.
17. Public response пропорционально перераспределяет public total между «Материал» и «Все работы», скрывая исходные ставки.
18. Frontend только форматирует cents/100 и показывает ответ.

## 13. Frontend vs Backend

| Расчёт | Frontend | Backend | Совпадает |
|---|---|---|---|
| Площадь | Не считает | `itemGeometry()` | Backend authoritative |
| Расход слэбов | Только показывает `areaWaste/slabArea → slabCount` из ответа | `roundSlabs()` | Да, frontend не дублирует расчёт |
| Раскрой/кромка/стыки | Не считает | `itemGeometry()` + `automaticQuantities()` | Backend authoritative |
| Ставки/курс/markup/reserve | Не получает внутренние значения в public | DB + `calculate()` | Backend authoritative |
| Итог CRM | Показывает `finalQuoteTotalCents` | Считает backend | Да |
| Итог public | Показывает `publicFromTotalCents` | Считает backend | Да |
| Public «Материал/Работы» | Показывает агрегаты | Backend пропорционально аллоцирует public total | Сумма совпадает с public total, но это не исходная себестоимость компонентов |
| PDF | Отправляет тот же payload | Backend пересчитывает заново и печатает ответ | Формула та же; возможен новый pricebook между preview и PDF |
| Lead | Отправляет тот же payload | Backend пересчитывает public и internal snapshots | Формула та же; snapshot фиксирует момент заявки |
| Сохранение заказа | Делит cents на 100 | Orders endpoint доверяет присланным `total_amount` и snapshot | Отдельного повторного пересчёта в order endpoint нет |

Public и internal preview используют одну `calculator.calculate()`, но public controller предварительно удаляет все менеджерские корректировки и public result скрывает USD/rates/settings.

## 14. Связь с БД

### Чтение для каждого preview

- `calculator_pricebooks` JOIN `calculator_settings`: только последний published.
- `materials`: по `material_id`; public требует active/public и category quartz/granite/onyx.
- `calculator_slab_formats`: по присланному `slabFormatCode`, а не обязательно по `materials.slab_format_id`; public frontend обычно синхронизирует его с материалом.
- `calculator_rates`: только соответствующая версия и доступность public/manager.

### Каталог

- `dict_material_types` — labels фильтра.
- `materials` — карточки материала.
- `calculator_slab_formats` — форматы.
- `calculator_rates` + published pricebook — список операций.

### Запись

- Public lead: `public_calculator_leads.configuration_json` и `calculation_snapshot`; пересчитанный internal snapshot хранит cents, rate и pricebook version.
- CRM order: `orders.calculator_snapshot` JSON, `orders.total_amount` DECIMAL BYN, `orders.exchange_rate` DECIMAL; зеркало — `order_finances`.

`materials.length_mm` и `materials.width_mm` mapping существует, но preview использует размеры из `calculator_slab_formats`; эти material-поля в расчёт не входят. Для non-custom `materials.thickness_mm` также не подставляется в backend slabFormat: используется `calculator_slab_formats.thickness_mm`.

## 15. Неиспользуемые/сомнительные поля

- `edgeProfileModel` модели 1–7 сохраняется и показывается, но текущий UI для любой модели ставит один `edge_standard`; цена не меняется.
- `measurementRequested`, `deliveryRequested`, `liftingRequested` не создают денежные строки.
- `backsplashType='coved'` и его длина сохраняются, но не создают `backsplash_make`/`backsplash`.
- `#thickness` отображается в CRM при любом формате, но payload отправляет customFormat только при `slabFormatCode='custom'`; для normal/jumbo/super_jumbo его изменение не влияет.
- `materials.length_mm`, `width_mm`, а для non-custom фактически и `thickness_mm` не участвуют в preview.
- `physicalSlabCount` только визуальный metric, не влияет на коммерческий расход/цену.
- Rates `edge_round`, `edge_reinforced` помечены automatic и скрыты из manual operations, но edge-profile UI их не выбирает; практически недоступны через текущий UI.
- Rate `backsplash` не создаётся automatic logic и скрыт как automatic; current UI его не использует.
- `install_corner_countertop`, `install_plinth_corner`, `cut_45`, `polish_custom` доступны только в CRM manual operations (если published/manager flags позволяют).
- `table_unconfirmed` в начальной миграции inactive. Режим `manual` ожидает `manualUsdCents`, которого repository не возвращает.
- Фильтры category/manufacturer/series влияют только на список карточек.
- `polishedSides` принудительно нормализуется frontend: table/island/bar=4, остальные=1. Для countertop/windowsill стоимость боковых торцов определяется `edgeSides`, а не этим полем.

## 16. Потенциальные ошибки логики

Ниже только фактические риски, без предложения новых бизнес-правил.

1. **Коммерческий расход и раскладка независимы.** `physicalSlabCount` может быть больше `slabCount`; цена использует area ratio, а не реально уложенные slabs.
2. **Ручной расход 0 допустим.** При положительной площади он может обнулить material base для `slab`/`half_slab`.
3. **USD manual line может учитываться дважды.** Такая строка получает одновременно `amountUsdCents` и конвертированный `amountBynCents`; затем первое входит в `productionBynCents`, второе — в `manualBynCents`. UI создаёт BYN, но schema разрешает USD.
4. **`fixed` не реализован как фиксированная сумма.** Он попадает в общую ветку `basePrice × quantity`; quantity >1 умножает fixed rate.
5. **`manual` rate фактически равен 0.** `calculateRateLine()` читает `rate.manualUsdCents`, но `mapRate()` такого поля не формирует.
6. **UI-профили кромки не меняют цену.** Семь разных визуальных вариантов используют `edge_standard`.
7. **Услуги по запросу исключены из суммы.** Это отмечено UI, но итог не является ценой с доставкой/подъёмом/замером/coved backsplash.
8. **Public component totals — аллокация, не реальные subtotals.** Reserve, minimum, public factor и rounding пропорционально размазываются по material/works; названия могут восприниматься как фактическая стоимость компонентов.
9. **Manager adjustment не влияет на publicFrom.** Internal final и public quote считаются от разных веток после recommended.
10. **Order save не пересчитывает snapshot.** Endpoint получает `total_amount` и snapshot от клиента; validation проверяет форму, но не вызывает calculator service повторно.
11. **Race последних запросов.** Debounce есть, но AbortController/request sequence нет. Два preview могут завершиться не по порядку, и более старый ответ способен перезаписать `state.calculation`.
12. **Смена published pricebook между preview/PDF/lead.** Каждый endpoint загружает актуальный published pricebook заново; PDF/lead могут отличаться от только что показанного preview.
13. **Internal catalog шире frontend.** Backend отдаёт все active categories/materials, но общий frontend всё равно фильтрует `allowedCategories` до quartz/granite/onyx; например marble в CRM не показывается.
14. **Формат доверяется payload.** Backend принимает активный `slabFormatCode` независимо от `materials.slab_format_id`; public UI связывает их, но прямой API может сочетать любой разрешённый материал и формат.
15. **Толщина материала и формата могут расходиться.** Backend использует thickness формата; UI metadata показывает `material.thicknessMm || format.thicknessMm`, то есть может показывать material thickness, хотя normal preview использует format thickness для полировки.
16. **Площадь Г/П — простая сумма прямоугольников.** Возможное перекрытие частей не вычитается; это фактическая модель данных, не контурная геометрия.
17. **Округление по строкам и компонентам.** Материал и работы конвертируются/округляются раздельно; public factor и final step дают дополнительную разницу относительно арифметики на отображённых BYN.

Backend отбрасывает отрицательные геометрические значения и большинство отрицательных денежных полей через Zod/service; исключение — signed manager adjustment. Потенциальный NaN проверяется в service, а schema требует finite numbers.

## 17. Пример полного расчёта

Пример воспроизведён прямым вызовом текущей `calculate()` без БД. Геометрия взята из default публичного UI; ставки `cut_straight`, edge, sink/hob/tap/install — из начальной миграции; для ясности условный материал задан как 1000 USD за слэб, курс 3 BYN/USD, catalog markup 0. Settings: waste 10%, reserve 10%, public factor 95%, minimum 0, rounding step 10 BYN. Это демонстрация текущих формул, а не утверждение о текущем published pricebook.

### Исходные данные

- прямая столешница 2900×600 мм;
- Normal 3050×1440×20;
- under-sink, hob, tap hole, installation включены;
- front edge 2.9 м, `edge_standard`;
- material 1000 USD/slab, FX=3;
- никаких ручных доплат/скидок.

### Геометрия и расход

1. Площадь: `2900×600/1e6 = 1.74 м²`.
2. Waste: `1.74×1.10 = 1.914 м²`.
3. Slab area: `3050×1440/1e6 = 4.392 м²`.
4. Ratio: `1.914/4.392 = 0.43579…`.
5. Commercial slabs: `ceil(0.43579×2)/2 = 0.5`.
6. Physical layout содержит 1 slab; это не меняет commercial 0.5.
7. Straight cut: `(2900+600)/1000 = 3.5 м`.
8. Edge и installation: `2.9 м`; joints=0.

### Составляющие

| Строка | Формула | BYN |
|---|---|---:|
| Материал | `1000 USD × 0.5 × 3` | 1500.00 |
| Прямой раскрой | `5 USD × 3.5 × 3` | 52.50 |
| Кромка | `20 USD × 2.9 × 3` | 174.00 |
| Вырез under-sink | `50 USD × 1 × 3` | 150.00 |
| Hob | `40 USD × 1 × 3` | 120.00 |
| Tap hole | `10 USD × 1 × 3` | 30.00 |
| Монтаж | `25 USD × 2.9 × 3` | 217.50 |
| Вклейка мойки | `10 USD × 1 × 3` | 30.00 |

Works = 774.00 BYN. Technical = `1500 + 774 = 2274.00 BYN`.

Reserve = `round(227400 cents × 10%) = 227.40 BYN`.

Recommended = `2501.40 BYN`; manager adjustment 0, поэтому manager final = `2501.40 BYN`.

Public before step = `round(250140 × 95%) = 237633 cents = 2376.33 BYN`.

Public final = округление вверх к 1000 cents: `238000 cents = 2380.00 BYN`.

Public response затем распределяет 2380 BYN пропорционально исходным 1500/774: отображает material `1569.92 BYN`, works `810.08 BYN`; эти две суммы складываются ровно в 2380 BYN.

Формула public allocation для каждой части, кроме последней:

`allocatedPart = min(remainingPublic, round(rawPart × publicTotal / rawSourceTotal))`.

Последняя часть получает весь остаток, поэтому сумма всегда точно равна public total. При сохранении нескольких изделий в заказ их `order_items.item_cost` также распределяется по площади: `totalAmount × itemArea / totalArea`.

## 18. Краткая итоговая формула

### ТЕКУЩАЯ ФОРМУЛА ЦЕНЫ

```text
Техническая = материал с максимальной из трёх наценок + material extra + все тарифицированные работы + ручные строки.
Рекомендуемая = max(Техническая + резерв на всю сумму, минимальный заказ).
Цена CRM = max(0, Рекомендуемая + фиксированная скидка/надбавка).
Цена public = округление вверх(Рекомендуемая × публичный коэффициент).
```
