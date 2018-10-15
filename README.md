Elastin
-------
"Connective material" for your application.

```
npm i --save-dev elastin
```


```ts
// И так, новая идея Elastin'а, теперь это хранилище данных.
// Пока до конца не понятно, как в итоге будет выглядеть api,
// но пока вырисовывается что-то типа этого.

// Первым делом, создаём `space`
const space = new Space('users', {
	id: type.Number({primary: true}), // обязательно должен быть хоть один
	name: type.String(),
	email: type.String({indexed: true}), // индексируемое поле
	createdAt: type.Date(),
});

// Дальше мы можем добавлять данных и получать
space.add({id: 1, ...});
space.add({id: 2, ...});

// Но получать можно будет только потоки, для этого нужно использовать `query`,
// через который можно сконфигурировать нуный поток, например всех данных:
const allStream = space.all;

// Или только за сегодня
const todayStream = space.query.where('createdAt', '>', todayTS);

// Поток ленивен и ассинхронен, поэтому активируется только при взаимодействие с ним.
// Есть несколько флагов для проверки состояния потока, доступ к любому из них,
// сразу активирует его (подсасывает данные)
todayStream.busy; // поток что-то делает (иными словами занят)
todayStream.ok; // готов к работе
todayStream.failed; // что-то пошло не так
todayStream.exists; // данные для потока не найдены
todayStream.length; // актуальное количество данных
todayStream.items; // данные

// Кроме этого, потоки реактивны, не в смысле FRP, а именно RP.
// Но тут возникает вопрос, удалять ли потоко автоматом, если его больше не использовали,
// или нет. Дело в том, что теже даныне могу понадобиться через ХХms и создание нового
// потоко может влететь в копеичку, поэтому наверно стоит сделать компромисный вариант
// и удалять поток только через TTL.

// Хорошо получилось, RP, TTL, прям самому понравилось.
// Поэтому давайте я немного расскажу, что я понимаю под RP и почему не люблю FRP.

// Яркий пример FRP, конечно же Rx и его 1000 и одна функция (на самом деле их немногим больше 100, 
// но сути это не меняет). Так вот, проблема не количестве методов, а в самих методах. Потоки могут 
// взаимодействовать только через методы, заложенные разработчиком и из-за этого, вы можете 
// действовать только в рамках библиотеки, так что по сути, нет никакого FRP, так же как нет
// jQuery-программирования, есть просто библиотека Rx, которая даёт событийное API и методы, для
// модивикации этих событий.

// RP — другое дело, тут нет как такого API, единсвенное, что вам понадобиться,
// это реактивный контейнер и всё, например возьмем мега быструю cellx и напишем простой пример
const a = cellx(0);
const b = cellx(0)
const c = cellx(() => a() + b());

c('addChangeListener', ({prevValue, value}) => {
	console.log(`${prevValue} -> ${value}`);
});

a(1);  // 1 + 0 = "0 -> 1"
b(3);  // 1 + 3 = "1 -> 4"
a(-3); // -3 + 3 = "4 -> 0"

// Вот тот же пример на Rx

// Знает что в этом пример самое плохое? Поток будет активен, если даже никто не использует, а вот
// пример на cellx умный, например, если бы написал вот такой код
const c = cellx(() => a() < 10 ? a() : b());

// то пока `a` меньше `10`, изменение `b` никак не будут влиять на одновление `c`, и только после
// `a > 10`, `b` будет првязанно к `c`, но если `а` опять станет меньше `10`, `b` будет
// овязано от `c` и вам ничего не нужно делать.

// Вот что я понимаю под реактивным программирование (RP), а не тот симулякр, который предлогает Rx 
// и подобные.

// Но, если отбросить FRP и оставить потоки, мы получим 
```

А теперь давайте прикинем, как это должно работать?



### Usage

```ts
import {autorun, query} from 'elastin';

const source = [{id: 1}, {id: '1'}, {id: 2}, {id: 3}];
let stream;

autorun(() => {
	stream = query.where('id', '>=', 123)(source);
	console.log(`length: ${source.length}`);
});
                        // [console] length: 0
source.push({id: 123}); // [console] length: 1
source.push({id: 321}); // [console] length: 2
source.push({id: 333}); // [console] length: 3
source.push({id: 5});   // nothing
```

### Space API

```ts
import md5 from 'md5';
import {createSpace, types, refs} from 'elastin';

const space = createSpace({
	name: 'timeline',
	endpoint: '/api/elastin/',
});

space.define('projects', {
	id: types.uuid(),
	name: types.string(),
	email: types.string({index: true}),
	pass: types.string({
		setter: (value) => md5(value),
	}),
	chats: types.array(types.string())
	tokens: refs.hasMany('tokens'),
	records: refs.hasMany('records'),
});

space.define('tokens', {
	id: types.uuid(),
	ts: types.date(),
	project: refs.hasOne('projects'),
	value: types.string(),
});

space.define('records', {
	id: types.uuid(),
	project: refs.hasOne('projects'),
	ts: types.date(),
	body: types.string(),
});

// Искать можно только по индексам
const project = space.projects.select({email: 'ibn@rubaxa.org'}).first();
const token = project.tokens.find(({value}) => value == req.query.token);

if (token.busy) {
	// идёт загрузка
} else if (token.failed) {
	// Ошибка
} else if (token.ok && token.exists) {
	// всё хорошо и объект найден
}

// Запрос будет отправлен только в тот момент, когда данные будут щупать
// GET /api/elastin/timeline/projects/?email=ibn@rubaxa.org&limit=1
// GET /api/elastin/timeline/tokens/?project=123
```

### Query API

```ts
interface IQuery {
	// Apply query to collection
	(collection: any[]): any[];

	where(property: string, value): IQuery;
	where(property: string, operator: '==' | '===' | '<' | '>' | '>=' | '<=', value): IQuery;
	orderBy(property: string, direction: 'desc' | 'asc'): IQuery;
	limit(count: number): IQuery;
}

// Usage
const select = query
				.where('value', '>=', 55)
				.where('rank', '>', 0)
				.orderBy('name', 'desc')
				.limit(5);

const stream = select(dataSource);
```


### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
