/* eslint-env mocha */

import {expect} from 'chai'
import gql from 'graphql-tag'
import {print} from 'graphql-tag/printer'
import {passThroughQuery} from '../pass-through-query'

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

describe('passThroughQuery', function () {

  describe('with fresh cache', function () {
    it('should take a simple cache state and query and remove unnecessary fields', function () {
      const query = gql`
        query {
          user {
            id
            name
            dateOfBirth
          }
        }
      `

      const cache = {
        user: {
          name: 'John Smith',
        },
      }

      const newQuery = print(passThroughQuery(cache, query)).trim()

      expect(newQuery).to.eql(`{
  user {
    id
    dateOfBirth
  }
}`)
    })

    it('should take a complex query and result and return it in a cached format', function () {
      const query = gql`
        fragment Bar on User {
          andAnotherConnection {
            id
            name
          }
        }

        fragment Foo on User {
          someOtherConnection {
            id
            name
          }
          ...Baz
        }

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
            moreFriendsDynamic: friends(limit: $someOtherLimit) { id, name }
            relatedFriends {
              id
              name
              friends(limit: $justOne) { name }
              ...Another
              ...AndAnother
            }
            ...Foo
            ...on User {
              interests
            }
            dateOfBirth
          }
        }

        fragment Baz on User {
          reallyAnotherConnection {
            id
            name
          }
        }

        fragment Another on User {
          about
          interests
        }

        fragment AndAnother on User {
          id
        }
      `

      const variables = {
        justOne: 1,
        someLimit: 2,
        someOtherLimit: 3,
      }

      const cache = {
        user: {
          id: '10',
          name: 'John Smith',
          interests: 'Hi',
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
          [cacheKey('friends', { limit: 3 })]: [
            { id: '11', name: 'Person 1' },
            { id: '12', name: 'Person 2' },
            { id: '13', name: 'Person 3' },
          ],
          relatedFriends: [
            {
              id: '11',
              name: 'Person 1',
              [cacheKey('friends', { limit: 1 })]: [
                { id: '12', name: 'Person 2' },
              ],
              interests: 'Some',
            },
            {
              id: '12',
              // This friend doesn't have a name, so we need to fetch name field
              [cacheKey('friends', { limit: 1 })]: [
                { id: '11', name: 'Person 1' },
              ],
              interests: 'Some',
            },
            {
              id: '13',
              name: 'Person 3',
              [cacheKey('friends', { limit: 1 })]: [
                { id: '11', name: 'Person 1' },
              ],
              interests: 'Some',
            },
          ],
          someOtherConnection: [
            { name: 'Person 1' },
            { name: 'Person 2' },
          ],
          reallyAnotherConnection: [
            { id: '20' },
          ],
        },
      }

      const newQuery = print(passThroughQuery(cache, query, variables))

      expect(newQuery).to.equal(print(gql`
        fragment Foo on User {
          someOtherConnection {
            id
          }
          ...Baz
        }

        query {
          user {
            about
            otherFriendsDynamic: friends(limit: $someLimit) { id, name }
            relatedFriends { name, ...Another }
            ...Foo
            dateOfBirth
          }
        }

        fragment Baz on User {
          reallyAnotherConnection {
            name
          }
        }

        fragment Another on User {
          about
        }
      `))
    })
  })

})
