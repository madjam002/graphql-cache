graphql-cache [![Build Status](https://img.shields.io/travis/madjam002/graphql-cache/master.svg?style=flat)](https://travis-ci.org/madjam002/graphql-cache)  [![NPM](https://img.shields.io/npm/v/graphql-cache.svg)](https://npmjs.com/package/graphql-cache) [![Github Issues](https://img.shields.io/github/license/madjam002/graphql-cache.svg)](https://github.com/madjam002/graphql-cache)
==================

> A simple, modular GraphQL cache for Javascript

**This project is a work in progress and is not ready for production yet. The API is likely to change over the next couple of weeks.**

This is a simple GraphQL cache for Javascript. It is primarily aimed at being used in GraphQL clients for powering their underlying cache.

At the moment this is a very simple cache which only caches the tree returned by a GraphQL server, but support for normalizing entities and pagination will be coming shortly.

This library doesn't enforce state and you are responsible for handling the cache object.

## Usage

Start off by initialising your cache. The cache is just a simple Javascript object. You can pass it around, persist it to disk so it can be restored for the next user session, or pass a stringified version of it down from a server side render to the client.

```js
let cache = {}
```

All methods which operate on the cache are immutable, meaning you'll get a new cache instance back every time.

The first thing you'll want to do is populate the cache from a GraphQL query sent to the server. You are responsible for sending the query to the server and getting the result.

For example (this uses the `graphql-tag` library):

```js
import gql from 'graphql-tag'

const query = gql`
  query {
    user {
      id
      name
    }
  }
`

const response = await fetch(/* your graph API */, {
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: print(query) }),
})

const result = await response.json()
```

`result` would be something like this:

```js
{
  data: {
    user: {
      id: '10',
      name: 'John Smith'
    }
  }
}
```

Now to get this data into the cache, we need to pass in the current cache (which at the moment is an empty object `{}`), the result data above, and also the original query:

```js
cache = cacheQueryResult(cache, query, result.data) // cacheQueryResult is immutable
```

The result of that query is now cached. Next time you want to make a query to a GraphQL server, you need to run the query through `passThroughQuery` so that any fields which are already in the cache are removed from the query:

```js
const nextQuery = gql`
  query {
    user {
      id
      name
      about
    }
  }
`

const queryForServer = passThroughQuery(cache, nextQuery)
```

`queryForServer` would now be something like:

```graphql
{
  query {
    user {
      about
    }
  }
}
```

Notice how the `id` and `name` fields have been removed since they're in the cache.

You can now send `queryForServer` off to your GraphQL server, and pass the result through `cacheQueryResult` just like we did earlier.

The `cache` will now contain the data from both queries. You can query the cache by doing:

```js
const query = gql`
  query {
    user {
      name
      about
    }
  }
`

const data = queryCache(cache, query)
```

```js
{
  name: 'John Smith',
  about: 'Foo',
}
```


## Middleware

There is currently a very simple middleware API which is likely to change in the future.
This allows for things like entity normalization and pagination to be pluggined in a modular way.

At the moment, the only example of middleware is entity normalization.

### Entity normalization

```js
const query = gql`
  query {
    user {
      id
      name
      about
    }
    theSameUser {
      id
      interests
    }
  }
`

const variables = {}

const data = {
  user: {
    id: '10',
    name: 'John Smith',
    about: 'Foo',
  },
  theSameUser: {
    id: '10',
    interests: 'GraphQL',
  },
}

const cache = cacheQueryResult({}, query, data, variables, normalizeEntitiesMiddleware)

const result = queryCache(cache, gql`
  query {
    user {
      interests # this was originally on theSameUser, not user.
    }
  }
`, variables, normalizeEntitiesMiddleware)

// result:
{
  user: {
    interests: 'GraphQL',
  },
}
```

## API

### cacheQueryResult(previousCache: Object, query: DocumentAST, data: Object, variables: ?Object, ...middleware: ?Middleware): Object

Takes a `previousCache` object, `query` AST and `data` from the server (or any other GraphQL source), and merges `data` into the cache immutably.

`variables` should be the variables sent along with the `query`, if any.

### passThroughQuery(cache: Object, query: DocumentAST, variables: ?Object, ...middleware: ?Middleware): ?DocumentAST

Takes a `query` AST and returns a new query AST with fields removed based on what's already in the cache. If there is nothing left to query, `null` will be returned.

### queryCache(cache: Object, query: DocumentAST, variables: ?Object, ...middleware: ?Middleware): Object

Runs the given `query` against the `cache`. Variables can also be provided.

## Roadmap

- Middleware for efficient pagination and connections
- More docs
- More tests

## License

Licensed under the MIT License.

[View the full license here](https://raw.githubusercontent.com/madjam002/graphql-cache/master/LICENSE).
