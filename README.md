Elastin
-------
"Connective material" for your application.

```
npm i --save-dev elastin
```

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
source.push({id: 333});  // [console] length: 3
source.push({id: 5});   // nothing
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
