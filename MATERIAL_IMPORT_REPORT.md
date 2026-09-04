# Material import dry-run report

- Источник: КВАРЦ.БЕЛ_единый_поиск (2).xlsx
- Дата: 2026-09-04T06:03:02.157Z
- База проверки: pro_erp_test
- Режим: dry-run, записей в БД нет
- Миграция 007 применена: да

## OLD vs NEW

| Метрика | Dry-run №1 | Dry-run №2 |
|---|---:|---:|
| validCandidates | 122 | 328 |
| rejectedRows | 239 | 33 |
| rowsWithoutDimensions | 237 | 33 |

## Текущая статистика

- Всего строк данных: 749
- Кварцевый агломерат: 361
- Натуральный гранит: 0
- Пропущено других категорий: 388
- Валидных кандидатов: 328
- Отклонено строк / отдельных ошибок: 33 / 66
- Строк с предупреждениями / предупреждений: 2 / 2
- Новых материалов: 8
- Обновляемых материалов: 257
- Новых брендов: 1
- Новых форматов: 0
- Новых ценовых записей: 833
- Уникальных materials / variants / prices: 265 / 328 / 833
- OUT/discontinued: 12
- Без физических размеров: 33
- Без толщины: 33
- Без чистого имени: 0
- Без цены: 0
- Duplicate candidates: 0
### Source price counts

- FULL/HALF/QUARTER: 361/274/231

### Importable price counts

- FULL/HALF/QUARTER: 328/274/231
- FULL+HALF: 274
- FULL без HALF: 87
- HALF без FULL: 0
- QUARTER без FULL: 0
- Без FULL: 0

## Нормализация размеров

- NORMAL/НОРМАЛ → 3050×1440: 100
- JUMBO → 3200×1600: 104
- SUPER JUMBO → 3300×1650: 0
- Явные физические размеры: 124
- Всё ещё без размера: 33

Одиночные числа не считаются форматом слэба.

## Новые форматы

```json
[]
```

## Справочники источника

- Бренды: Belenco, Caesarstone, Calisco, Coante, Noblle, Quartzforms, Stratos
- Валюты: EUR, USD
- Размеры/обозначения: 3050×1400×20, 3050×1440×20, 3200×1600×20, 3300×1650×20, 3340×1640×20, не указан

## Примеры

### Stratos

```json
{
  "row": 2,
  "category": "quartz",
  "brand": "Stratos",
  "article": "UC002",
  "materialId": "imp-393bc72460ef15e3d493a4e82fd84318",
  "sourceName": "Thunder",
  "name": "Thunder",
  "commercialFormat": "3200х1600",
  "dimensions": "3200×1600×20",
  "surface": null,
  "dimensionSource": "explicit",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 70000,
      "currency": "USD"
    },
    {
      "fraction": 0.5,
      "amountMinor": 36000,
      "currency": "USD"
    },
    {
      "fraction": 0.25,
      "amountMinor": 21000,
      "currency": "USD"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [],
  "sourceLocation": "лист STRATOS, строка данных 3"
}
```

### Belenco NORMAL/JUMBO

```json
{
  "row": 130,
  "category": "quartz",
  "brand": "Belenco",
  "article": "1010",
  "materialId": "imp-2bee3e915fa3f291bf216797f8659a2d",
  "sourceName": "Premium White",
  "name": "Premium White",
  "commercialFormat": "NORMAL",
  "dimensions": "3050×1440×20",
  "surface": null,
  "dimensionSource": "mapped_normal",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 73000,
      "currency": "EUR"
    },
    {
      "fraction": 0.5,
      "amountMinor": 37500,
      "currency": "EUR"
    },
    {
      "fraction": 0.25,
      "amountMinor": 22000,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [],
  "sourceLocation": "лист BELENCO, строка данных 4"
}
```

```json
{
  "row": 131,
  "category": "quartz",
  "brand": "Belenco",
  "article": "1010",
  "materialId": "imp-2bee3e915fa3f291bf216797f8659a2d",
  "sourceName": "Premium White",
  "name": "Premium White",
  "commercialFormat": "JUMBO",
  "dimensions": "3200×1600×20",
  "surface": null,
  "dimensionSource": "mapped_jumbo",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 85000,
      "currency": "EUR"
    },
    {
      "fraction": 0.5,
      "amountMinor": 43500,
      "currency": "EUR"
    },
    {
      "fraction": 0.25,
      "amountMinor": 25500,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [],
  "sourceLocation": "лист BELENCO, строка данных 5"
}
```

```json
{
  "row": 132,
  "category": "quartz",
  "brand": "Belenco",
  "article": "1010",
  "materialId": "imp-2bee3e915fa3f291bf216797f8659a2d",
  "sourceName": "Premium White SETA",
  "name": "Premium White",
  "commercialFormat": "JUMBO",
  "dimensions": "3200×1600×20",
  "surface": "SETA",
  "dimensionSource": "mapped_jumbo",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 98000,
      "currency": "EUR"
    },
    {
      "fraction": 0.5,
      "amountMinor": 50000,
      "currency": "EUR"
    },
    {
      "fraction": 0.25,
      "amountMinor": 29500,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [],
  "sourceLocation": "лист BELENCO, строка данных 6"
}
```

### Noblle Q840 White Misterio

```json
{
  "row": 695,
  "category": "quartz",
  "brand": "Noblle",
  "article": "Q840",
  "materialId": "imp-345c664fd9e394666fa1790d57e1bc80",
  "sourceName": "White Misterio OUT",
  "name": "White Misterio",
  "commercialFormat": "3200х1600х20 мм",
  "dimensions": "3200×1600×20",
  "surface": "Глянцевая",
  "dimensionSource": "explicit",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 78000,
      "currency": "USD"
    }
  ],
  "discontinued": true,
  "errors": [],
  "warnings": [],
  "sourceLocation": "стр. 1, строка 27"
}
```

Исходные колонки Q840:

```json
{
  "Бренд": "Noblle",
  "Категория": "Кварцевый агломерат",
  "Артикул": "Q840",
  "Наименование": "White Misterio OUT",
  "Размер": "3200х1600х20 мм",
  "Толщина": "20 мм",
  "Поверхность": "Глянцевая",
  "Цена": 780,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": null,
  "Цена 1/4": null,
  "Тип цены": "Прайс",
  "НДС": null,
  "Примечание": null,
  "Источник": "NOBLLE/Noblle Quartz РБ Кварц.бел.pdf",
  "Место в источнике": "стр. 1, строка 27"
}
```

Соседние строки Noblle:

```json
{
  "Бренд": "Noblle",
  "Категория": "Кварцевый агломерат",
  "Артикул": "Q707",
  "Наименование": "Sahara Noir",
  "Размер": "3200х1600х20 мм",
  "Толщина": "20 мм",
  "Поверхность": "Глянцевая",
  "Цена": 780,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": null,
  "Цена 1/4": null,
  "Тип цены": "Прайс",
  "НДС": null,
  "Примечание": null,
  "Источник": "NOBLLE/Noblle Quartz РБ Кварц.бел.pdf",
  "Место в источнике": "стр. 1, строка 25"
}
```

```json
{
  "Бренд": "Noblle",
  "Категория": "Кварцевый агломерат",
  "Артикул": "Q757",
  "Наименование": "Calacatta Aurum",
  "Размер": "3200х1600х20 мм",
  "Толщина": "20 мм",
  "Поверхность": "Глянцевая",
  "Цена": 780,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": null,
  "Цена 1/4": null,
  "Тип цены": "Прайс",
  "НДС": null,
  "Примечание": null,
  "Источник": "NOBLLE/Noblle Quartz РБ Кварц.бел.pdf",
  "Место в источнике": "стр. 1, строка 26"
}
```

```json
{
  "Бренд": "Noblle",
  "Категория": "Кварцевый агломерат",
  "Артикул": "Q840",
  "Наименование": "White Misterio OUT",
  "Размер": "3200х1600х20 мм",
  "Толщина": "20 мм",
  "Поверхность": "Глянцевая",
  "Цена": 780,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": null,
  "Цена 1/4": null,
  "Тип цены": "Прайс",
  "НДС": null,
  "Примечание": null,
  "Источник": "NOBLLE/Noblle Quartz РБ Кварц.бел.pdf",
  "Место в источнике": "стр. 1, строка 27"
}
```

```json
{
  "Бренд": "Noblle",
  "Категория": "Кварцевый агломерат",
  "Артикул": "Q850",
  "Наименование": "Urban Grigio OUT",
  "Размер": "3200х1600х20 мм",
  "Толщина": "20 мм",
  "Поверхность": "Глянцевая",
  "Цена": 780,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": null,
  "Цена 1/4": null,
  "Тип цены": "Прайс",
  "НДС": null,
  "Примечание": null,
  "Источник": "NOBLLE/Noblle Quartz РБ Кварц.бел.pdf",
  "Место в источнике": "стр. 1, строка 28"
}
```

```json
{
  "Бренд": "Noblle",
  "Категория": "Кварцевый агломерат",
  "Артикул": "Q798",
  "Наименование": "Calacatta Elegant",
  "Размер": "3200х1600х20 мм",
  "Толщина": "20 мм",
  "Поверхность": "Глянцевая",
  "Цена": 950,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": null,
  "Цена 1/4": null,
  "Тип цены": "Прайс",
  "НДС": null,
  "Примечание": null,
  "Источник": "NOBLLE/Noblle Quartz РБ Кварц.бел.pdf",
  "Место в источнике": "стр. 1, строка 29"
}
```

Q840 содержит только FULL 780 USD: ячейки HALF и QUARTER пустые и остаются `null`. Значение из соседней ячейки или source location в цену не переносится.

### Belenco Aizano

```json
{
  "row": 180,
  "category": "quartz",
  "brand": "Belenco",
  "article": "4043",
  "materialId": "imp-4b9078be8308153c25e82d46a793cb93",
  "sourceName": "Aizano",
  "name": "Aizano",
  "commercialFormat": "НОРМАЛ",
  "dimensions": "3050×1440×20",
  "surface": null,
  "dimensionSource": "mapped_normal",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 61000,
      "currency": "EUR"
    },
    {
      "fraction": 0.5,
      "amountMinor": 31500,
      "currency": "EUR"
    },
    {
      "fraction": 0.25,
      "amountMinor": 18500,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [],
  "sourceLocation": "лист BELENCO, строка данных 55"
}
```

### Caesarstone 3340×1640

```json
{
  "row": 451,
  "category": "quartz",
  "brand": "Caesarstone",
  "article": "5141",
  "materialId": "imp-fe22be660b5a8d6018ebc1c4f6db9dd3",
  "sourceName": "Frosty Carrina",
  "name": "Frosty Carrina",
  "commercialFormat": "3340х1640 - 20 мм",
  "dimensions": "3340×1640×20",
  "surface": null,
  "dimensionSource": "explicit",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 117000,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [],
  "sourceLocation": "стр. 1, таблица 1, строка 22"
}
```

### FULL/HALF не 50%

```json
{
  "row": 180,
  "category": "quartz",
  "brand": "Belenco",
  "article": "4043",
  "materialId": "imp-4b9078be8308153c25e82d46a793cb93",
  "sourceName": "Aizano",
  "name": "Aizano",
  "commercialFormat": "НОРМАЛ",
  "dimensions": "3050×1440×20",
  "surface": null,
  "dimensionSource": "mapped_normal",
  "prices": [
    {
      "fraction": 1,
      "amountMinor": 61000,
      "currency": "EUR"
    },
    {
      "fraction": 0.5,
      "amountMinor": 31500,
      "currency": "EUR"
    },
    {
      "fraction": 0.25,
      "amountMinor": 18500,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [],
  "sourceLocation": "лист BELENCO, строка данных 55"
}
```

## HALF без FULL — первые 20

Нет.

## Suspicious prices

Нет.

## ARTICLE_NAME_CONFLICT

Групп: 1

- Строка 224: Belenco 1220: source="Calacatta Victory", clean="Calacatta Victory", materialId=imp-5dc8c3eebcaefd4c3f907155a2cd3718
- Строка 225: Belenco 1220: source="Calacatta Paletino", clean="Calacatta Paletino", materialId=imp-8bc6826a31ee688fc141014dfa5a2d17

## Все строки без наименования

Нет.

## Оставшиеся причины reject

- Нет чистого наименования: 0
- Нет однозначных физических размеров: 33
- Нет толщины: 33

## Важные замечания

- Цена 1/4 сохраняется моделью, но automatic slab calculator продолжает работать с шагом 0.5.
- EUR не трактуется как USD. Исходная EUR-цена импортируется без курса, но до явной конвертации не получает calculator USD price и не делает variant calculator-ready.
- NORMAL/НОРМАЛ, JUMBO и SUPER JUMBO нормализуются по утверждённому business mapping; явные размеры всегда имеют приоритет.
- Пустые ценовые ячейки остаются пустыми: importer не восстанавливает FULL/HALF/QUARTER из соседних колонок, source location или иных значений строки.
- Натуральный гранит отсутствует и не импортируется по словам Granite внутри названий других категорий.
