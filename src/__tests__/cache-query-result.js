/* eslint-env mocha */

import {expect} from 'chai'
import gql from 'graphql-tag'
import {cacheQueryResult} from '../cache-query-result'

function cacheKey(field, args) {
  if (!args) {
    return field
  }

  const stringifiableArgs = {}

  for (const k in args) {
    stringifiableArgs[k] = args[k].toString()
  }

  return `${field}|${JSON.stringify(stringifiableArgs)}`
}

describe('cacheQueryResult', function () {

  describe('with fresh cache', function () {
    it('should take a simple query result and return it in a cached format', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
          }
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result)

      expect(cache).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          dateOfBirth: '2016-09-20 10:00',
        },
      })
    })

    it('should take a query result with an array and return it in a cached format', function () {
      const query = gql`
        query {
          user {
            id
            name
            friends { id, name }
            dateOfBirth
          }
        }
      `

      const result = {
        user: {
          id: '10',
          name: 'John Smith',
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          dateOfBirth: '2016-09-20 10:00',
        },
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result)

      expect(cache).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          dateOfBirth: '2016-09-20 10:00',
        },
      })
    })

    it('should take a complex query and result and return it in a cached format', function () {
      const query = gql`
        query {
          user {
            id
            theUserName: name
            myOtherName: name
            about
            myFriends: friends { id, name }
            sameFriends: friends { id, name }
            otherFriends: friends(limit: 10) { id, name }
            otherFriendsDynamic: friends(limit: $someLimit) { id, name }
            relatedFriends { id, name }
            ...Foo
            ...on User {
              interests
            }
            dateOfBirth
          }
        }

        fragment Foo on User {
          someOtherConnection {
            id
            name
          }
          ...Baz
        }

        fragment Bar on User {
          andAnotherConnection {
            id
            name
          }
        }

        fragment Baz on User {
          reallyAnotherConnection {
            id
            name
          }
        }
      `

      const variables = {
        someLimit: 2,
      }

      const result = {
        user: {
          id: '10',
          theUserName: 'John Smith',
          myOtherName: 'John Smith',
          about: null,
          interests: 'Woop',
          myFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          sameFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          otherFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
          otherFriendsDynamic: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          relatedFriends: null,
          someOtherConnection: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          reallyAnotherConnection: [
            { id: '11', name: 'Person 1' },
          ],
          dateOfBirth: '2016-09-20 10:00',
        },
      }

      const previousCache = {}
      const cache = cacheQueryResult(previousCache, query, result, variables)

      expect(cache).to.eql({
        user: {
          id: '10',
          name: 'John Smith',
          about: null,
          interests: 'Woop',
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          [cacheKey('friends', { limit: 10 })]: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
          [cacheKey('friends', { limit: 2 })]: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          relatedFriends: null,
          someOtherConnection: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
          ],
          reallyAnotherConnection: [
            { id: '11', name: 'Person 1' },
          ],
          dateOfBirth: '2016-09-20 10:00',
        },
      })
    })
  })

  describe('with existing data in cache', function () {
    it('should take a complex query and result and return it in a cached format whilst respecting old cache data', function () {
      const query = gql`
        query {
          user {
            id
            theUserName: name
            myOtherName: name
            about
            myFriends: friends { id, name }
            sameFriends: friends { id, name }
            otherFriends: friends(limit: 10) { id, name }
            relatedFriends { id, name }
            dateOfBirth
          }
        }
      `

      const result = {
        user: {
          id: '10',
          theUserName: 'John Smith',
          myOtherName: 'John Smith',
          about: null,
          myFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          sameFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          otherFriends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
          relatedFriends: null,
          dateOfBirth: '2016-09-20 10:00',
        },
      }

      const previousCache = {
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 11',
        },
        user: {
          about: 'This is awesome!',
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
        },
      }

      const cache = cacheQueryResult(previousCache, query, result)

      expect(cache).to.eql({
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 11',
        },
        user: {
          id: '10',
          name: 'John Smith',
          about: null,
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
          ],
          [cacheKey('friends', { limit: 10 })]: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
          relatedFriends: null,
          dateOfBirth: '2016-09-20 10:00',
        },
      })

      // ensure old cache wasn't mutated
      expect(previousCache).to.eql({
        [cacheKey('node', { id: '11' })]: {
          id: '11',
          name: 'Person 11',
        },
        user: {
          about: 'This is awesome!',
          friends: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
            { id: '14', name: 'Person 4' },
            { id: '15', name: 'Person 5' },
            { id: '16', name: 'Person 6' },
          ],
        },
      })

      expect(previousCache.user).to.not.equal(cache.user)
    })
  })

})
