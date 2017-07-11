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
array.push({id: 333});  // [console] length: 3
source.push({id: 5});   // nothing
```

### Development

 - `npm i`
 - `npm test`, [code coverage](./coverage/lcov-report/index.html)
