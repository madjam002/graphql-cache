graphql-cache [![Build Status](https://img.shields.io/travis/madjam002/graphql-cache/master.svg?style=flat)](https://travis-ci.org/madjam002/graphql-cache)  [![NPM](https://img.shields.io/npm/v/graphql-cache.svg)](https://npmjs.com/package/graphql-cache) [![Github Issues](https://img.shields.io/github/license/madjam002/graphql-cache.svg)](https://github.com/madjam002/graphql-cache)
==================

> A simple, modular GraphQL cache for Javascript

**This project is a work in progress and is not ready for production yet. The API is likely to change over the next couple of weeks.**

This is a simple GraphQL cache for Javascript. It is primarily aimed at being used in GraphQL clients for powering their underlying cache.

At the moment this is a very simple cache which only caches the tree returned by a GraphQL server, but support for normalizing entities and pagination will be coming shortly.

This library doesn't enforce state and you are responsible for handling the cache object.

## Usage

```js
import {cacheQueryResult, queryCache, passThroughQuery} from 'graphql-cache'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'

const query = gql`
  query {
    user {
      id
      name
    }
  }
`

// This is just a quick example demonstrating fetching from a GraphQL server

const response = await fetch(/* your graph API */, {
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: print(query) }),
})

const result = await response.json()

// Store the result in a cache object

let cache = {} // empty cache to start with

cache = cacheQueryResult(cache, query, result) // cacheQueryResult is immutable

// We can now query the cache directly
const localQuery = queryCache(cache, gql`
  query {
    user {
      name
    }
  }
`)

// Now when we go to fetch another query from the server, we can skip fields which have already
// been fetched and are in the cache

const newQuery = passThroughQuery(cache, gql`
  query {
    user {
      id
      name
      about
    }
  }
`)

/**
 * newQuery: (id and name are in the cache)
 *
 *  query {
 *    user {
 *      about
 *    }
 *  }
 */

const newResult = /* fetch from the graphql server again with newQuery */

cache = cacheQueryResult(cache, newQuery, newResult)
```

All methods which manipulate the cache are immutable (at the moment it's just `cacheQueryResult` which manipulates the cache).

This means that you can easily revert the cache to an old state.

## Roadmap

- Middleware for features like:
  - Entity normalizing
  - Efficient pagination/connections
- More docs
- More tests

## License

Licensed under the MIT License.

[View the full license here](https://raw.githubusercontent.com/madjam002/graphql-cache/master/LICENSE).
