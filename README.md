# ragavan

A backup system npm package named **ragavan**.

## Installation

```bash
npm install ragavan
```

## Usage (in Next.js server)

```js
// Import in your Next.js server code
import { backup } from 'ragavan';

// Example usage
backup({
  source: '/path/to/source',
  destination: '/path/to/backup',
});
```

## API

- `backup({ source, destination })`: Backs up files from `source` to `destination`.

## License

ISC 