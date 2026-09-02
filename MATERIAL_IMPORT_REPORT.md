# Material import dry-run report

- Источник: КВАРЦ.БЕЛ_единый_поиск (2).xlsx
- Дата: 2026-09-02T13:09:09.665Z
- База проверки: pro_erp_test
- Режим: dry-run, записей в БД нет
- Миграция 007 применена: да

## OLD vs NEW

| Метрика | Dry-run №1 | Dry-run №2 |
|---|---:|---:|
| validCandidates | 122 | 322 |
| rejectedRows | 239 | 39 |
| rowsWithoutDimensions | 237 | 33 |

## Текущая статистика

- Всего строк данных: 749
- Кварцевый агломерат: 361
- Натуральный гранит: 0
- Пропущено других категорий: 388
- Валидных кандидатов: 322
- Отклонено строк / отдельных ошибок: 39 / 105
- Строк с предупреждениями / предупреждений: 328 / 354
- Новых материалов: 0
- Обновляемых материалов: 259
- Новых брендов: 1
- Новых форматов: 0
- Новых ценовых записей: 912
- Уникальных materials / variants / prices: 259 / 322 / 912
- OUT/discontinued: 12
- Без физических размеров: 33
- Без толщины: 33
- Без чистого имени: 39
- Без цены: 0
- Duplicate candidates: 0
- FULL/HALF/QUARTER: 328/361/274
- FULL+HALF: 328
- FULL без HALF: 0
- HALF без FULL: 33
- QUARTER без FULL: 0
- Без FULL: 33

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
  "warnings": [
    "SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность"
  ],
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
  "warnings": [
    "SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность"
  ],
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
  "warnings": [
    "SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность"
  ],
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
  "warnings": [
    "SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность"
  ],
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
    },
    {
      "fraction": 0.5,
      "amountMinor": 2600,
      "currency": "USD"
    }
  ],
  "discontinued": true,
  "errors": [],
  "warnings": [
    "HIGH suspicious_half_price: подозрительное соотношение HALF/FULL"
  ],
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
  "Цена 1/2": 26,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 1985,
  "Примечание": null,
  "Источник": null,
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
  "Цена 1/2": 26,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 1985,
  "Примечание": null,
  "Источник": null,
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
  "Цена 1/2": 26,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 1985,
  "Примечание": null,
  "Источник": null,
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
  "Цена 1/2": 26,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 1985,
  "Примечание": null,
  "Источник": null,
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
  "Цена 1/2": 26,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 1985,
  "Примечание": null,
  "Источник": null,
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
  "Цена 1/2": 26,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 1985,
  "Примечание": null,
  "Источник": null,
  "Место в источнике": "стр. 1, строка 29"
}
```

Значение 26 попало в HALF без вычислений: это непосредственное значение ячейки колонки `Цена 1/2`.

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
  "warnings": [
    "SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность"
  ],
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
    },
    {
      "fraction": 0.5,
      "amountMinor": 1100,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [],
  "warnings": [
    "SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность",
    "HIGH suspicious_half_price: подозрительное соотношение HALF/FULL"
  ],
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
  "warnings": [
    "SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность"
  ],
  "sourceLocation": "лист BELENCO, строка данных 55"
}
```

## HALF без FULL — первые 20

- {
  "row": 276,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "760",
  "materialId": "imp-52999878b68d682c9387d93813eaca0c",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 2"
}
- {
  "row": 277,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "764",
  "materialId": "imp-97b6abffd4468744a8dcbd6303ab7dad",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 3"
}
- {
  "row": 278,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "766",
  "materialId": "imp-aeb87b1e1fa8984e5a6e74bfed36bcd5",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 4"
}
- {
  "row": 279,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "768",
  "materialId": "imp-416ab83dea54e6269c543bdb9b9e9779",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 5"
}
- {
  "row": 280,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "770",
  "materialId": "imp-a979afa1b160426ac38adfc860f95c41",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 6"
}
- {
  "row": 281,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "772",
  "materialId": "imp-5771facbee776909cacb82de710ebcdf",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 7"
}
- {
  "row": 282,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "774",
  "materialId": "imp-aff6ce5b94163c4b7872fbcd293dedf7",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 8"
}
- {
  "row": 283,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "776",
  "materialId": "imp-8292ea7fcf1d96aac3b2ee954546d6dd",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 9"
}
- {
  "row": 284,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "778",
  "materialId": "imp-3bdffbb4e735012dbbeccacd19d818bf",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 10"
}
- {
  "row": 285,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "780",
  "materialId": "imp-e7d0181ae15dd82a7c33b88befb82a61",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 11"
}
- {
  "row": 286,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "782",
  "materialId": "imp-409a97be9ce489d2302d86b55e2cb8d6",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 12"
}
- {
  "row": 287,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "784",
  "materialId": "imp-e0585b055b07e94e50c01ff844949856",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 13"
}
- {
  "row": 288,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "786",
  "materialId": "imp-55ba567d89f1ca4e5a7f68b6ddfc74f8",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 14"
}
- {
  "row": 289,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "788",
  "materialId": "imp-3d2a98ca2f3c5a74499ffd31ef2d7e26",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 15"
}
- {
  "row": 290,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "790",
  "materialId": "imp-5096b0db12e5a9de67ce0938ef63d130",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 16"
}
- {
  "row": 291,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "792",
  "materialId": "imp-79e4afee6c457f4cc71af0c9be1864c1",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 17"
}
- {
  "row": 292,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "794",
  "materialId": "imp-246bb1091e2cad6cde0b85d062a7d99f",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 18"
}
- {
  "row": 293,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "796",
  "materialId": "imp-b8f72ff10d11ecf8c45bc57bd8200067",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 19"
}
- {
  "row": 294,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "798",
  "materialId": "imp-dbe5a41df5b3005c044d0f7b2e981702",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 20"
}
- {
  "row": 295,
  "category": "quartz",
  "brand": "Quartzforms",
  "article": "800",
  "materialId": "imp-42e6f10ebf895a9140b049c8352557a4",
  "sourceName": "",
  "name": "",
  "commercialFormat": null,
  "dimensions": null,
  "surface": null,
  "dimensionSource": "unresolved",
  "prices": [
    {
      "fraction": 0.5,
      "amountMinor": 2800,
      "currency": "EUR"
    }
  ],
  "discontinued": false,
  "errors": [
    "нет наименования",
    "нет однозначных физических размеров слэба",
    "нет толщины"
  ],
  "warnings": [],
  "sourceLocation": "лист QUARTZFORMS, строка данных 21"
}

## Suspicious prices

- Строка 434: Caesarstone 1141 Pure White #OUT — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 435: Caesarstone 3100 Jet Black — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 436: Caesarstone 4130 Clamshell — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 437: Caesarstone 4330 Ginger — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 438: Caesarstone 4003 Sleek Concrete # O U T — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 439: Caesarstone 5003 Piatra Grey — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 440: Caesarstone 5100 Vanilla Noir — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 441: Caesarstone 5110 Alpine Mist — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 442: Caesarstone 5133 Symphony Grey — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 443: Caesarstone 5141 Frosty Carrina — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 444: Caesarstone 5143 White Attica — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 445: Caesarstone 5211 Noble Grey — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 446: Caesarstone 5212 Taj Royale # O U T — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 447: Caesarstone 6003 Coastal Grey — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 448: Caesarstone 6046 Moorland Fog — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 449: Caesarstone 6131 Bianco Drift — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 450: Caesarstone 6338 Woodlands — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 451: Caesarstone 5141 Frosty Carrina — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 452: Caesarstone 4011 Cloudburst Concrete #Матовый! — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 453: Caesarstone 4023 Topus Concrete #Матовый! — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 454: Caesarstone 4033 Rugged Concrete #Матовый! — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 455: Caesarstone 4044 Airy Concrete #Матовый! — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 456: Caesarstone 5810 Black Tempal # O U T #Матовый! — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 457: Caesarstone 4735 Oxidian #OUT #Матовый! — SHIFTED_FULL_PRICE: Цена восстановлена из смещённой колонки Поверхность; HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 681: Noblle Q117 Jade White — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 682: Noblle Q131 Black Sand — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 683: Noblle Q716 Carrara Sun — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 684: Noblle Q718 Carrara Moon — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 685: Noblle Q719 Carrara Black — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 686: Noblle Q717 Bianco Giogia OUT — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 687: Noblle Q735 Bianco Venato OUT — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 688: Noblle Q740 Calacatta Venato — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 689: Noblle Q744 Calacatta Bianco OUT — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 690: Noblle Q765 Nero Marquina — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 691: Noblle Q785 Calacatta Gold OUT — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 692: Noblle Q703 Calacatta Borghini — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 693: Noblle Q707 Sahara Noir — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 694: Noblle Q757 Calacatta Aurum — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 695: Noblle Q840 White Misterio OUT — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 696: Noblle Q850 Urban Grigio OUT — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 697: Noblle Q798 Calacatta Elegant — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 698: Noblle Q810 Grey Glow — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 699: Noblle Q811 Beton White — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 700: Noblle Q859 Beton Brass — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 701: Noblle Q880 Beton Grey — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 702: Noblle Q913 Moon White — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 703: Noblle Q795 Calacatta Magic Dark — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 704: Noblle Q796 Calacatta Magic White — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 705: Noblle Q797 Calacatta True Light — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 706: Noblle Q801 Beton Marquina — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 707: Noblle Q901 Patagonia Gold — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 708: Noblle Q902 Patagonia Platinum — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 709: Noblle Q921 Arabescato Black — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL
- Строка 710: Noblle Q790 Venato Royal выводится — HIGH suspicious_half_price: подозрительное соотношение HALF/FULL

## ARTICLE_NAME_CONFLICT

Групп: 1

- Строка 224: Belenco 1220: source="Calacatta Victory", clean="Calacatta Victory", materialId=imp-5dc8c3eebcaefd4c3f907155a2cd3718
- Строка 225: Belenco 1220: source="Calacatta Paletino", clean="Calacatta Paletino", materialId=imp-8bc6826a31ee688fc141014dfa5a2d17

## Все строки без наименования

### Строка 66

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Stratos",
  "Категория": "Кварцевый агломерат",
  "Артикул": "CLOUD",
  "Наименование": "matt",
  "Размер": "3050х1400",
  "Толщина": "20 мм",
  "Поверхность": 780,
  "Цена": null,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": 400,
  "Цена 1/4": 235,
  "Тип цены": "ОПТ1",
  "НДС": "с НДС 20%",
  "Примечание": 50,
  "Источник": null,
  "Место в источнике": "лист STRATOS, строка данных 69"
}
```

### Строка 67

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Stratos",
  "Категория": "Кварцевый агломерат",
  "Артикул": "CREAM",
  "Наименование": "matt",
  "Размер": "3050х1400",
  "Толщина": "20 мм",
  "Поверхность": 780,
  "Цена": null,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": 400,
  "Цена 1/4": 235,
  "Тип цены": "ОПТ1",
  "НДС": "с НДС 20%",
  "Примечание": 50,
  "Источник": null,
  "Место в источнике": "лист STRATOS, строка данных 70"
}
```

### Строка 68

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Stratos",
  "Категория": "Кварцевый агломерат",
  "Артикул": "CRUSH",
  "Наименование": "matt",
  "Размер": "3050х1400",
  "Толщина": "20 мм",
  "Поверхность": 780,
  "Цена": null,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": 400,
  "Цена 1/4": 235,
  "Тип цены": "ОПТ1",
  "НДС": "с НДС 20%",
  "Примечание": 50,
  "Источник": null,
  "Место в источнике": "лист STRATOS, строка данных 71"
}
```

### Строка 69

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Stratos",
  "Категория": "Кварцевый агломерат",
  "Артикул": "FLAKE",
  "Наименование": "matt",
  "Размер": "3050х1400",
  "Толщина": "20 мм",
  "Поверхность": 780,
  "Цена": null,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": 400,
  "Цена 1/4": 235,
  "Тип цены": "ОПТ1",
  "НДС": "с НДС 20%",
  "Примечание": 50,
  "Источник": null,
  "Место в источнике": "лист STRATOS, строка данных 72"
}
```

### Строка 70

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Stratos",
  "Категория": "Кварцевый агломерат",
  "Артикул": 250,
  "Наименование": null,
  "Размер": "3050х1400",
  "Толщина": "20 мм",
  "Поверхность": 780,
  "Цена": null,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": 400,
  "Цена 1/4": 235,
  "Тип цены": "ОПТ1",
  "НДС": "с НДС 20%",
  "Примечание": 50,
  "Источник": null,
  "Место в источнике": "лист STRATOS, строка данных 73"
}
```

### Строка 71

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Stratos",
  "Категория": "Кварцевый агломерат",
  "Артикул": 252,
  "Наименование": null,
  "Размер": "3050х1400",
  "Толщина": "20 мм",
  "Поверхность": 750,
  "Цена": null,
  "Валюта": "USD",
  "Единица": "слэб",
  "Цена 1/2": 385,
  "Цена 1/4": 225,
  "Тип цены": "ОПТ1",
  "НДС": "с НДС 20%",
  "Примечание": 50,
  "Источник": null,
  "Место в источнике": "лист STRATOS, строка данных 74"
}
```

### Строка 276

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 760,
  "Наименование": null,
  "Размер": 1040,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 2"
}
```

### Строка 277

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 764,
  "Наименование": null,
  "Размер": 1280,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 3"
}
```

### Строка 278

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 766,
  "Наименование": null,
  "Размер": 960,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 4"
}
```

### Строка 279

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 768,
  "Наименование": null,
  "Размер": 1020,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 5"
}
```

### Строка 280

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 770,
  "Наименование": null,
  "Размер": 1280,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 6"
}
```

### Строка 281

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 772,
  "Наименование": null,
  "Размер": 990,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 7"
}
```

### Строка 282

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 774,
  "Наименование": null,
  "Размер": 1020,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 8"
}
```

### Строка 283

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 776,
  "Наименование": null,
  "Размер": 1020,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 9"
}
```

### Строка 284

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 778,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 10"
}
```

### Строка 285

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 780,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 11"
}
```

### Строка 286

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 782,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 12"
}
```

### Строка 287

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 784,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 13"
}
```

### Строка 288

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 786,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 14"
}
```

### Строка 289

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 788,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 15"
}
```

### Строка 290

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 790,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 16"
}
```

### Строка 291

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 792,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 17"
}
```

### Строка 292

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 794,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 18"
}
```

### Строка 293

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 796,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 19"
}
```

### Строка 294

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 798,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 20"
}
```

### Строка 295

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 800,
  "Наименование": null,
  "Размер": 960,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 21"
}
```

### Строка 296

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 802,
  "Наименование": null,
  "Размер": 960,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 22"
}
```

### Строка 297

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 804,
  "Наименование": null,
  "Размер": 1280,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 23"
}
```

### Строка 298

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 806,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 24"
}
```

### Строка 299

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 808,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 25"
}
```

### Строка 300

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 810,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 26"
}
```

### Строка 301

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 812,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 27"
}
```

### Строка 302

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 814,
  "Наименование": null,
  "Размер": 1740,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 28"
}
```

### Строка 303

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 816,
  "Наименование": null,
  "Размер": 960,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 29"
}
```

### Строка 304

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 818,
  "Наименование": null,
  "Размер": 960,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 30"
}
```

### Строка 305

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 820,
  "Наименование": null,
  "Размер": 1280,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 31"
}
```

### Строка 306

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 822,
  "Наименование": null,
  "Размер": 1450,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 32"
}
```

### Строка 307

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 824,
  "Наименование": null,
  "Размер": 1020,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 33"
}
```

### Строка 308

Причина: значение колонки «Наименование» пусто; однозначного соседнего текстового значения нет.

```json
{
  "Бренд": "Quartzforms",
  "Категория": "Кварцевый агломерат",
  "Артикул": 826,
  "Наименование": null,
  "Размер": 1020,
  "Толщина": null,
  "Поверхность": null,
  "Цена": null,
  "Валюта": "EUR",
  "Единица": "слэб",
  "Цена 1/2": 28,
  "Цена 1/4": null,
  "Тип цены": null,
  "НДС": 761,
  "Примечание": null,
  "Источник": "QUARTZFORMS/Рекомендуемая розница QUARTZFORMS.xlsx",
  "Место в источнике": "лист QUARTZFORMS, строка данных 34"
}
```

## Оставшиеся причины reject

- Нет чистого наименования: 39
- Нет однозначных физических размеров: 33
- Нет толщины: 33

## Важные замечания

- Цена 1/4 сохраняется моделью, но automatic slab calculator продолжает работать с шагом 0.5.
- EUR не трактуется как USD. Для реального импорта и выбора EUR-цены калькулятором нужен явный `--eur-per-usd` и дата курса.
- NORMAL/НОРМАЛ, JUMBO и SUPER JUMBO нормализуются по утверждённому business mapping; явные размеры всегда имеют приоритет.
- В исходном XLSX у части строк полная цена фактически находится в числовой ячейке «Поверхность» при пустой «Цена»; dry-run восстанавливает её с предупреждением и не выдумывает поверхность.
- Натуральный гранит отсутствует и не импортируется по словам Granite внутри названий других категорий.
